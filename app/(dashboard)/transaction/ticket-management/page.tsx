import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { formatAssignment } from "@/app/lib/ticket-format";
import { Prisma } from "@/app/generated/prisma/client";
import { SortableTh } from "../../_components/sortable-th";
import { type SortDir } from "@/app/lib/table-sort";
import { STATUS_BADGE, PRIORITY_BADGE } from "../../tickets/ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import { TicketRowActions } from "./_components/ticket-row-actions";

export const metadata: Metadata = { title: "Ticket Management" };

const PAGE_SIZE = 15;

// The required *default* display order doesn't match the enum's declared
// order in the schema (which Prisma's `orderBy` would otherwise use), so
// ranking is done below in a raw ORDER BY CASE rather than by reordering the
// live enum — keep this in sync with STATUSES in
// ../../tickets/ticket-badges.ts: NEW, WAITING, REOPENED, RESOLVED,
// ASSIGNED, VERIFIED, CLOSED, then createdAt ASC. Clicking a column header
// (below) overrides this default with a plain column sort instead.

const SORT_COLUMNS = ["ticketNumber", "title", "company", "priority", "createdAt", "status", "assignee"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.TicketOrderByWithRelationInput {
  switch (sortBy) {
    case "company":
      return { Company: { name: sortDir } };
    case "assignee":
      return { User_Ticket_assigneeIdToUser: { name: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

export default async function TicketManagementPage({ searchParams }: PageProps<"/transaction/ticket-management">) {
  await requireAdmin();

  const { q, page, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const sortParam = typeof sort === "string" ? sort : undefined;
  const isSorted = sortParam !== undefined && (SORT_COLUMNS as readonly string[]).includes(sortParam);
  const sortBy = isSorted ? (sortParam as SortColumn) : "createdAt";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  // Headers render as "unsorted" when the default status-priority order is
  // active, since that's not a plain single-column sort.
  const activeSortBy = isSorted ? sortBy : "";

  const where: Prisma.TicketWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { ticketNumber: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const ticketInclude = {
    Category: true,
    Company: true,
    Department: { include: { User_Department_supervisorIdToUser: { select: { name: true, email: true } } } },
    User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
    User_Ticket_assigneeIdToUser: { select: { name: true } },
    UserGroup: { select: { name: true } },
  } satisfies Prisma.TicketInclude;

  const [assignees, groups] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPERVISOR"] }, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.userGroup.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
    const searchFragment = query
      ? Prisma.sql`AND (title ILIKE ${`%${query}%`} OR "ticketNumber" ILIKE ${`%${query}%`})`
      : Prisma.empty;

    const [idRows, count] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Ticket"
        WHERE 1=1 ${searchFragment}
        ORDER BY CASE status
          WHEN 'NEW' THEN 0
          WHEN 'WAITING' THEN 1
          WHEN 'REOPENED' THEN 2
          WHEN 'RESOLVED' THEN 3
          WHEN 'ASSIGNED' THEN 4
          WHEN 'VERIFIED' THEN 5
          WHEN 'CLOSED' THEN 6
        END,
        "createdAt" ASC
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
  const linkQuery = query ? { q: query } : {};

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Ticket Management</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Transaction</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Ticket Management
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
                  <form method="get" className="d-flex gap-2 align-items-center flex-wrap">
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
                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                      Filter
                    </button>
                  </form>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Title" column="title" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Priority" column="priority" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Created" column="createdAt" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Assignee" column="assignee" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="fw-medium">{ticket.ticketNumber}</td>
                            <td>{ticket.title}</td>
                            <td>
                              {ticket.Company.name}
                              <div className="fs-7 text-secondary">{ticket.Department.name}</div>
                            </td>
                            <td>
                              <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
                            </td>
                            <td>{formatDateTime(ticket.createdAt)}</td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                            </td>
                            <td>{formatAssignment(ticket.User_Ticket_assigneeIdToUser?.name, ticket.UserGroup?.name)}</td>
                            <td className="text-end">
                              <TicketRowActions
                                ticket={{
                                  id: ticket.id,
                                  ticketNumber: ticket.ticketNumber,
                                  status: ticket.status,
                                  priority: ticket.priority,
                                  description: ticket.description,
                                  createdAt: ticket.createdAt,
                                  creatorName: ticket.User_Ticket_createdByIdToUser.name,
                                  creatorEmail: ticket.User_Ticket_createdByIdToUser.email,
                                  assigneeId: ticket.assigneeId,
                                  assignedGroupId: ticket.assignedGroupId,
                                  supervisor: ticket.Department.User_Department_supervisorIdToUser,
                                  problem: ticket.problem,
                                  solution: ticket.solution,
                                }}
                                assignees={assignees}
                                groups={groups}
                              />
                            </td>
                          </tr>
                        ))}
                        {tickets.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center text-secondary py-4">
                              No tickets found.
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
                  {totalPages > 1 && (
                    <ul className="pagination pagination-sm m-0 float-end">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                          <Link
                            className="page-link"
                            href={{
                              pathname: "/transaction/ticket-management",
                              query: { ...linkQuery, ...(isSorted ? { sort: sortBy, dir: sortDir } : {}), page: p },
                            }}
                          >
                            {p}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
