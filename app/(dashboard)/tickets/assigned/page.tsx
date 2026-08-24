import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { type SortDir } from "@/app/lib/table-sort";
import { Prisma, type TicketStatus } from "@/app/generated/prisma/client";
import { STATUS_BADGE, PRIORITY_BADGE, STATUSES } from "../ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";

export const metadata: Metadata = { title: "Assigned Ticket" };

const PAGE_SIZE = 10;

const SORT_COLUMNS = ["ticketNumber", "title", "category", "company", "priority", "status", "transactionDate"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.TicketOrderByWithRelationInput {
  switch (sortBy) {
    case "category":
      return { Category: { name: sortDir } };
    case "company":
      return { Company: { name: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

export default async function AssignedTicketsPage({ searchParams }: PageProps<"/tickets/assigned">) {
  const session = await requireUser();

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { userGroupId: true } });

  const { q, status, page, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const statusFilter = typeof status === "string" && status !== "all" ? (status as TicketStatus) : "";
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const sortParam = typeof sort === "string" ? sort : undefined;
  const isSorted = sortParam !== undefined && (SORT_COLUMNS as readonly string[]).includes(sortParam);
  const sortBy = isSorted ? (sortParam as SortColumn) : "transactionDate";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  // Headers render as "unsorted" when the default status-priority order is
  // active, since that's not a plain single-column sort — same pattern as
  // Ticket Management's own default view.
  const activeSortBy = isSorted ? sortBy : "";

  // Assigned to the user's group (pool) or individually (via TicketAssignee),
  // combined via AND with the search/status filters below rather than a
  // second top-level OR, which would just overwrite this one.
  const where: Prisma.TicketWhereInput = {
    AND: [
      {
        OR: [
          ...(me?.userGroupId ? [{ TicketAssignedGroup: { some: { userGroupId: me.userGroupId } } }] : []),
          { TicketAssignee: { some: { userId: session.user.id } } },
        ],
      },
      ...(query
        ? [
            {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { ticketNumber: { contains: query, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      ...(statusFilter ? [{ status: statusFilter }] : []),
    ],
  };

  const ticketInclude = { Category: true, Company: true, Department: true } satisfies Prisma.TicketInclude;

  let tickets: Prisma.TicketGetPayload<{ include: typeof ticketInclude }>[];
  let total: number;

  if (isSorted) {
    [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: buildOrderBy(sortBy, sortDir),
        skip,
        take: PAGE_SIZE,
      }),
      prisma.ticket.count({ where }),
    ]);
  } else {
    // Default view: assignee-actionability order rather than a plain column
    // sort — ASSIGNED/REOPENED/NEW need the assignee's attention now,
    // RESOLVED is done-but-awaiting-the-customer, WAITING is blocked on a
    // supervisor (not actionable by the assignee despite sounding urgent),
    // CLOSED last. Deliberately different ranking from Ticket Management's
    // admin-triage default order.
    const groupFragment = me?.userGroupId
      ? Prisma.sql`OR EXISTS (SELECT 1 FROM "TicketAssignedGroup" tg WHERE tg."ticketId" = "Ticket".id AND tg."userGroupId" = ${me.userGroupId})`
      : Prisma.empty;
    const searchFragment = query
      ? Prisma.sql`AND (title ILIKE ${`%${query}%`} OR "ticketNumber" ILIKE ${`%${query}%`})`
      : Prisma.empty;
    const statusFragment = statusFilter ? Prisma.sql`AND status = ${statusFilter}::"TicketStatus"` : Prisma.empty;

    const [idRows, count] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Ticket"
        WHERE (
          EXISTS (SELECT 1 FROM "TicketAssignee" ta WHERE ta."ticketId" = "Ticket".id AND ta."userId" = ${session.user.id})
          ${groupFragment}
        )
        ${searchFragment} ${statusFragment}
        ORDER BY
          CASE status
            WHEN 'ASSIGNED' THEN 0 WHEN 'REOPENED' THEN 1 WHEN 'NEW' THEN 2
            WHEN 'RESOLVED' THEN 3 WHEN 'WAITING' THEN 4 WHEN 'CLOSED' THEN 5
          END,
          CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END,
          "transactionDate" DESC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `),
      prisma.ticket.count({ where }),
    ]);
    total = count;

    const orderedIds = idRows.map((row) => row.id);
    const hydrated = await prisma.ticket.findMany({ where: { id: { in: orderedIds } }, include: ticketInclude });
    const ticketsById = new Map(hydrated.map((ticket) => [ticket.id, ticket]));
    tickets = orderedIds.map((id) => ticketsById.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkQuery = { ...(query ? { q: query } : {}), ...(statusFilter ? { status: statusFilter } : {}) };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Assigned Ticket</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Assigned Ticket
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-12">
                      <form method="get" className="d-flex gap-2 align-items-center flex-column flex-md-row flex-wrap">
                        <div className="input-group input-group-sm w-auto flex-grow-1">
                          <span className="input-group-text">
                            <i className="bi bi-search" aria-hidden="true"></i>
                          </span>
                          <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            className="form-control form-control-sm"
                            placeholder="Search tickets"
                            aria-label="Search tickets"
                          />
                        </div>
                        <select
                          name="status"
                          defaultValue={statusFilter || "all"}
                          className="form-select form-select-sm w-auto"
                          aria-label="Filter by status"
                        >
                          <option value="all">All statuses</option>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-funnel me-1" aria-hidden="true"></i>
                          Filter
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Title" column="title" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Category" column="category" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Priority" column="priority" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Transaction Date" column="transactionDate" pathname="/tickets/assigned" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="fw-medium">{ticket.ticketNumber}</td>
                            <td>{ticket.title}</td>
                            <td>{ticket.Category.name}</td>
                            <td>
                              {ticket.Company.name}
                              <div className="fs-7 text-secondary">{ticket.Department.name}</div>
                            </td>
                            <td>
                              <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
                            </td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                            </td>
                            <td>{formatDateTime(ticket.transactionDate)}</td>
                            <td className="text-end">
                              <div className="btn-group">
                                <Link
                                  href={`/tickets/assigned/${ticket.id}`}
                                  className="btn btn-sm btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${ticket.ticketNumber}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                {ticket.status !== "CLOSED" && (
                                  <Link
                                    href={`/tickets/assigned/${ticket.id}`}
                                    className="btn btn-sm btn-outline-secondary"
                                    title="Edit"
                                    aria-label={`Edit ${ticket.ticketNumber}`}
                                  >
                                    <i className="bi bi-pencil" aria-hidden="true"></i>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {tickets.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center text-secondary py-4">
                              No tickets assigned to you.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer clearfix">
                  <div className="float-start pt-1 fs-7 text-body-secondary">
                    Showing {tickets.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {(currentPage - 1) * PAGE_SIZE + tickets.length} of {total} tickets
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    makeHref={(p) => ({
                      pathname: "/tickets/assigned",
                      query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p },
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
