import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { formatAssignment } from "@/app/lib/ticket-format";
import { Prisma } from "@/app/generated/prisma/client";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { PageSizeSelect } from "../../_components/page-size-select";
import { parsePageSize } from "@/app/lib/page-size";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { type SortDir } from "@/app/lib/table-sort";
import { STATUS_BADGE, PRIORITY_BADGE, STATUSES } from "../../tickets/ticket-badges";
import { STATUS_FILTER_PRESETS } from "@/app/lib/ticket-status-groups";
import { formatDateTime } from "@/app/lib/date-format";
import { TicketRowActions } from "./_components/ticket-row-actions";

export const metadata: Metadata = { title: "Ticket Management" };


// The required *default* display order doesn't match the enum's declared
// order in the schema (which Prisma's `orderBy` would otherwise use), so
// ranking is done below in a raw ORDER BY CASE rather than by reordering the
// live enum — keep this in sync with STATUSES in
// ../../tickets/ticket-badges.ts: NEW, WAITING, REOPENED, RESOLVED,
// ASSIGNED, CLOSED, then transactionDate ASC. Clicking a column header
// (below) overrides this default with a plain column sort instead.

const SORT_COLUMNS = ["ticketNumber", "title", "company", "priority", "transactionDate", "status"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(
  sortBy: SortColumn,
  sortDir: SortDir
): Prisma.TicketOrderByWithRelationInput | Prisma.TicketOrderByWithRelationInput[] {
  switch (sortBy) {
    case "company":
      return { Company: { name: sortDir } };
    // Status ascending already starts with NEW (the enum's declared order —
    // see schema.prisma's TicketStatus) — transactionDate asc breaks ties
    // within the same status so same-status tickets read oldest-first.
    case "status":
      return [{ status: sortDir }, { transactionDate: "asc" }];
    default:
      return { [sortBy]: sortDir };
  }
}

export default async function TicketManagementPage({ searchParams }: PageProps<"/transaction/ticket-management">) {
  await requireAdmin();

  const { q, page, pageSize: pageSizeParam, sort, dir, status, unassigned, showDeleted } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * pageSize;
  const sortParam = typeof sort === "string" ? sort : undefined;
  const isSorted = sortParam !== undefined && (SORT_COLUMNS as readonly string[]).includes(sortParam);
  const sortBy = isSorted ? (sortParam as SortColumn) : "transactionDate";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  // Headers render as "unsorted" when the default status-priority order is
  // active, since that's not a plain single-column sort.
  const activeSortBy = isSorted ? sortBy : "";

  // Comma-separated status list, e.g. from the dashboard's KPI tiles
  // (?status=NEW,ASSIGNED,REOPENED) or the Status dropdown below — see
  // app/lib/ticket-status-groups.ts for the shared presets.
  const statusParam = typeof status === "string" ? status : "";
  const statusList = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is (typeof STATUSES)[number] => (STATUSES as readonly string[]).includes(s));
  const unassignedOnly = unassigned === "1";
  const showDeletedOnly = showDeleted === "1";

  const where: Prisma.TicketWhereInput = {
    deletedAt: showDeletedOnly ? { not: null } : null,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { ticketNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statusList.length > 0 ? { status: { in: statusList } } : {}),
    ...(unassignedOnly ? { TicketAssignee: { none: {} } } : {}),
  };

  const ticketInclude = {
    Category: true,
    Company: true,
    Department: { include: { DepartmentApprover: { select: { User: { select: { name: true, email: true } } } } } },
    User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
    User_Ticket_deletedByIdToUser: { select: { name: true } },
    TicketAssignee: { select: { User: { select: { id: true, name: true } } } },
    TicketAssignedGroup: { select: { UserGroup: { select: { id: true, name: true } } } },
    TicketHistory: { orderBy: { timestamp: "asc" }, include: { User: { select: { name: true } } } },
  } satisfies Prisma.TicketInclude;

  const [assignees, groups] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
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
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);
  } else {
    const searchFragment = query
      ? Prisma.sql`AND (title ILIKE ${`%${query}%`} OR "ticketNumber" ILIKE ${`%${query}%`})`
      : Prisma.empty;
    const statusFragment =
      statusList.length > 0 ? Prisma.sql`AND status = ANY(${statusList}::"TicketStatus"[])` : Prisma.empty;
    const unassignedFragment = unassignedOnly
      ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "TicketAssignee" ta WHERE ta."ticketId" = "Ticket".id)`
      : Prisma.empty;
    const deletedFragment = showDeletedOnly ? Prisma.sql`"deletedAt" IS NOT NULL` : Prisma.sql`"deletedAt" IS NULL`;

    const [idRows, count] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Ticket"
        WHERE ${deletedFragment} ${searchFragment} ${statusFragment} ${unassignedFragment}
        ORDER BY CASE status
          WHEN 'NEW' THEN 0
          WHEN 'WAITING' THEN 1
          WHEN 'REOPENED' THEN 2
          WHEN 'RESOLVED' THEN 3
          WHEN 'ASSIGNED' THEN 4
          WHEN 'CLOSED' THEN 5
        END,
        "transactionDate" ASC
        LIMIT ${pageSize} OFFSET ${skip}
      `),
      prisma.ticket.count({ where }),
    ]);
    total = count;

    const orderedIds = idRows.map((row) => row.id);
    const hydrated = await prisma.ticket.findMany({ where: { id: { in: orderedIds } }, include: ticketInclude });
    const ticketsById = new Map(hydrated.map((ticket) => [ticket.id, ticket]));
    tickets = orderedIds.map((id) => ticketsById.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const linkQuery = {
    ...(query ? { q: query } : {}),
    ...(statusParam ? { status: statusParam } : {}),
    ...(unassignedOnly ? { unassigned: "1" } : {}),
    ...(showDeletedOnly ? { showDeleted: "1" } : {}),
    pageSize: String(pageSize),
  };
  const hasActiveFilter = Boolean(query || statusParam || unassignedOnly || showDeletedOnly);

  return (
    <>
      <FormVendorScripts />
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
                    <select
                      name="status"
                      defaultValue={statusParam}
                      className="form-select form-select-sm w-auto"
                      aria-label="Filter by status"
                    >
                      <option value="">All Statuses</option>
                      {STATUS_FILTER_PRESETS.map((preset) => (
                        <option key={preset.statuses.join(",")} value={preset.statuses.join(",")}>
                          {preset.label}
                        </option>
                      ))}
                      <optgroup label="Single status">
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="form-check d-flex align-items-center gap-1 mb-0">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        id="unassigned-filter"
                        name="unassigned"
                        value="1"
                        defaultChecked={unassignedOnly}
                      />
                      <label className="form-check-label fs-7" htmlFor="unassigned-filter">
                        Unassigned only
                      </label>
                    </div>
                    <div className="form-check d-flex align-items-center gap-1 mb-0">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        id="show-deleted-filter"
                        name="showDeleted"
                        value="1"
                        defaultChecked={showDeletedOnly}
                      />
                      <label className="form-check-label fs-7" htmlFor="show-deleted-filter">
                        Show deleted
                      </label>
                    </div>
                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                      <i className="bi bi-funnel me-1" aria-hidden="true"></i>
                      Filter
                    </button>
                    {hasActiveFilter && (
                      <Link href="/transaction/ticket-management" className="btn btn-sm btn-outline-danger">
                        Clear filters
                      </Link>
                    )}
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
                          <SortableTh label="Transaction Date" column="transactionDate" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/transaction/ticket-management" query={linkQuery} sortBy={activeSortBy} sortDir={sortDir} />
                          <th>Assignee</th>
                          {showDeletedOnly && <th>Deleted</th>}
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
                            <td>{formatDateTime(ticket.transactionDate)}</td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                            </td>
                            <td>
                              {formatAssignment(
                                ticket.TicketAssignee.map((a) => a.User.name),
                                ticket.TicketAssignedGroup.map((g) => g.UserGroup.name)
                              )}
                            </td>
                            {showDeletedOnly && (
                              <td>
                                <div className="fs-7">
                                  {ticket.User_Ticket_deletedByIdToUser?.name ?? "—"}
                                  {ticket.deletedAt && <> · {formatDateTime(ticket.deletedAt)}</>}
                                </div>
                                {ticket.deletedReason && (
                                  <div className="fs-7 text-secondary">{ticket.deletedReason}</div>
                                )}
                              </td>
                            )}
                            <td className="text-end">
                              {showDeletedOnly ? (
                                <Link
                                  href={`/transaction/ticket-management/${ticket.id}`}
                                  className="btn btn-sm btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${ticket.ticketNumber}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                              ) : (
                                <TicketRowActions
                                  ticket={{
                                    id: ticket.id,
                                    ticketNumber: ticket.ticketNumber,
                                    status: ticket.status,
                                    priority: ticket.priority,
                                    companyId: ticket.companyId,
                                    assigneeIds: ticket.TicketAssignee.map((a) => a.User.id),
                                    assignedGroupIds: ticket.TicketAssignedGroup.map((g) => g.UserGroup.id),
                                    approvers: ticket.Department.DepartmentApprover.map((a) => a.User),
                                    deletedAt: ticket.deletedAt,
                                  }}
                                  history={ticket.TicketHistory.map((h) => ({
                                    id: h.id,
                                    action: h.action,
                                    previousState: h.previousState,
                                    newState: h.newState,
                                    timestamp: h.timestamp,
                                    actorName: h.User?.name ?? null,
                                  }))}
                                  assignees={assignees}
                                  groups={groups}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                        {tickets.length === 0 && (
                          <tr>
                            <td colSpan={showDeletedOnly ? 9 : 8} className="text-center text-secondary py-4">
                              {showDeletedOnly ? "No deleted tickets." : "No tickets found."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="fs-7 text-body-secondary">
                      Showing {tickets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + tickets.length} of {total} tickets
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({
                      pathname: "/transaction/ticket-management",
                      query: { ...linkQuery, ...(isSorted ? { sort: sortBy, dir: sortDir } : {}), page: p },
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
