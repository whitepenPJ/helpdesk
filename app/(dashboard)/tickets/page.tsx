import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { deleteTicket } from "@/app/actions/tickets";
import { DeleteButton } from "../_components/delete-button";
import { SortableTh } from "../_components/sortable-th";
import { Select2Select } from "../_components/select2-select";
import { FormVendorScripts } from "../_components/form-vendor-scripts";
import { Pagination } from "../_components/pagination";
import { TicketSearchInput } from "./ticket-search-input";
import type { SortDir } from "@/app/lib/table-sort";
import { Prisma, type TicketStatus } from "@/app/generated/prisma/client";
import { STATUS_BADGE, PRIORITY_BADGE, STATUSES } from "./ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";

export const metadata: Metadata = { title: "Tickets" };

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

const ticketInclude = { Category: true, Company: true, Department: true } satisfies Prisma.TicketInclude;

// Status sets behind each clickable summary card, below.
const ACTIVE_STATUSES: TicketStatus[] = STATUSES.filter((s) => s !== "CLOSED");
const ON_TRACK_STATUSES: TicketStatus[] = ["ASSIGNED", "RESOLVED"];
const WAITING_STATUSES: TicketStatus[] = ["WAITING"];
const COMPLETED_STATUSES: TicketStatus[] = ["CLOSED"];

function sameStatusSet(a: TicketStatus[], b: TicketStatus[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((s, i) => s === sortedB[i]);
}

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  const { q, status, page, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const statusParam = typeof status === "string" ? [status] : (status ?? []);
  const statusFilters = statusParam.filter((s): s is TicketStatus => (STATUSES as readonly string[]).includes(s));
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const sortParam = typeof sort === "string" ? sort : undefined;
  const isSorted = sortParam !== undefined && (SORT_COLUMNS as readonly string[]).includes(sortParam);
  const sortBy = isSorted ? (sortParam as SortColumn) : "transactionDate";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  // Headers render as "unsorted" when the default status-priority order is
  // active, since that's not a plain single-column sort.
  const activeSortBy = isSorted ? sortBy : "";

  const where: Prisma.TicketWhereInput = {
    ...(isAdmin ? {} : { createdById: session.user.id }),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { ticketNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statusFilters.length > 0 ? { status: { in: statusFilters } } : {}),
  };

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
    // Default order: NEW, REOPENED, ASSIGNED, RESOLVED, WAITING, CLOSED,
    // then most-recent transaction date first within each status — keep
    // this in sync if the requested priority ever changes.
    const ownerFragment = isAdmin ? Prisma.empty : Prisma.sql`AND "createdById" = ${session.user.id}`;
    const searchFragment = query
      ? Prisma.sql`AND (title ILIKE ${`%${query}%`} OR "ticketNumber" ILIKE ${`%${query}%`})`
      : Prisma.empty;
    const statusFragment =
      statusFilters.length > 0
        ? Prisma.sql`AND status IN (${Prisma.join(statusFilters.map((s) => Prisma.sql`${s}::"TicketStatus"`))})`
        : Prisma.empty;

    const [idRows, count] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Ticket"
        WHERE 1=1 ${ownerFragment} ${searchFragment} ${statusFragment}
        ORDER BY CASE status
          WHEN 'NEW' THEN 0
          WHEN 'REOPENED' THEN 1
          WHEN 'ASSIGNED' THEN 2
          WHEN 'RESOLVED' THEN 3
          WHEN 'WAITING' THEN 4
          WHEN 'CLOSED' THEN 5
        END,
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
  const linkQuery = { ...(query ? { q: query } : {}), ...(statusFilters.length > 0 ? { status: statusFilters } : {}) };

  // Summary cards reflect the caller's own scope (own tickets, or every
  // ticket for an admin) but — like the search/status filters below the
  // cards — aren't themselves affected by the search/status filters, so
  // they stay a stable "at a glance" overview of the whole list.
  const scopeWhere: Prisma.TicketWhereInput = isAdmin ? {} : { createdById: session.user.id };
  const statusGroups = await prisma.ticket.groupBy({ by: ["status"], where: scopeWhere, _count: { _all: true } });
  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Partial<
    Record<TicketStatus, number>
  >;
  const ticketTotal = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const closedCount = statusCounts.CLOSED ?? 0;
  // "On track" = actively progressing: assigned or resolved — as opposed to
  // not-yet-picked-up (NEW/REOPENED), blocked (WAITING), or already done
  // (CLOSED).
  const onTrackCount = (statusCounts.ASSIGNED ?? 0) + (statusCounts.RESOLVED ?? 0);
  const waitingApprovalCount = statusCounts.WAITING ?? 0;

  // Each card doubles as a quick filter: clicking it sets the status filter
  // to that card's status set (clicking an already-active card clears it).
  const summaryCards = [
    { label: "Active", count: ticketTotal - closedCount, statuses: ACTIVE_STATUSES, colorClass: "" },
    { label: "On track", count: onTrackCount, statuses: ON_TRACK_STATUSES, colorClass: "text-success" },
    { label: "Waiting for Approval", count: waitingApprovalCount, statuses: WAITING_STATUSES, colorClass: "text-warning" },
    { label: "Completed", count: closedCount, statuses: COMPLETED_STATUSES, colorClass: "text-secondary" },
  ];

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Tickets</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Tickets
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <FormVendorScripts />
          <div className="row g-3 mb-3">
            {summaryCards.map((card) => {
              const isActiveFilter = sameStatusSet(statusFilters, card.statuses);
              return (
                <div className="col-md-3 col-6" key={card.label}>
                  <Link
                    href={{
                      pathname: "/tickets",
                      query: isActiveFilter ? {} : { status: card.statuses },
                    }}
                    className={`card h-100 text-decoration-none text-reset ${isActiveFilter ? "border-primary border-2" : ""}`}
                  >
                    <div className="card-body">
                      <p className="text-secondary small mb-1">{card.label}</p>
                      <h3 className={`mb-0 fw-bold ${card.colorClass}`}>{card.count}</h3>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-12">
                      <form method="get" className="d-flex gap-2 align-items-center flex-column flex-md-row flex-wrap">
                        <TicketSearchInput defaultValue={query} />
                        <div style={{ minWidth: "16rem" }}>
                          <Select2Select
                            name="status"
                            multiple
                            small
                            defaultValues={statusFilters}
                            placeholder="All statuses"
                            options={STATUSES.map((s) => ({ value: s, label: s }))}
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-funnel me-1" aria-hidden="true"></i>
                          Filter
                        </button>
                        <Link href="/tickets/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-ticket-perforated me-1" aria-hidden="true"></i>
                          New ticket
                        </Link>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Title" column="title" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Category" column="category" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Priority" column="priority" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Transaction Date" column="transactionDate" pathname="/tickets" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((ticket) => {
                          const canEditDelete = ticket.status === "NEW" && (isAdmin || ticket.createdById === session.user.id);
                          return (
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
                            <td className="text-center">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/tickets/${ticket.id}`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${ticket.ticketNumber}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                {canEditDelete && (
                                  <>
                                    <Link
                                      href={`/tickets/${ticket.id}/edit`}
                                      className="btn btn-outline-secondary"
                                      title="Edit"
                                      aria-label={`Edit ${ticket.ticketNumber}`}
                                    >
                                      <i className="bi bi-pencil" aria-hidden="true"></i>
                                    </Link>
                                    <DeleteButton
                                      action={deleteTicket.bind(null, ticket.id)}
                                      confirmMessage={`Delete ticket "${ticket.ticketNumber}"? This cannot be undone.`}
                                      label={`Delete ${ticket.ticketNumber}`}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          );
                        })}
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
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    makeHref={(p) => ({
                      pathname: "/tickets",
                      query: { ...linkQuery, ...(isSorted ? { sort: sortBy, dir: sortDir } : {}), page: p },
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/tickets/new"
        className="btn btn-primary rounded-circle shadow position-fixed d-flex align-items-center justify-content-center"
        style={{ width: 56, height: 56, bottom: 24, right: 24, zIndex: 1030 }}
        title="New ticket"
        aria-label="New ticket"
      >
        <i className="bi bi-plus-lg fs-4" aria-hidden="true"></i>
      </Link>
    </>
  );
}
