import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { SortableTh } from "../../_components/sortable-th";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma, TicketStatus } from "@/app/generated/prisma/client";
import { STATUS_BADGE, PRIORITY_BADGE, STATUSES } from "../ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";

export const metadata: Metadata = { title: "Assigned Ticket" };

const PAGE_SIZE = 10;

const SORT_COLUMNS = ["ticketNumber", "title", "category", "company", "priority", "status", "createdAt"] as const;
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
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "createdAt", dir: "desc" }
  );

  // Assigned to the user's group (pool) or individually (assigneeId — only
  // ADMIN/SUPERVISOR can be picked as an individual assignee), combined via
  // AND with the search/status filters below rather than a second top-level
  // OR, which would just overwrite this one.
  const where: Prisma.TicketWhereInput = {
    AND: [
      { OR: [...(me?.userGroupId ? [{ assignedGroupId: me.userGroupId }] : []), { assigneeId: session.user.id }] },
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

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { Category: true, Company: true, Department: true },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ticket.count({ where }),
  ]);

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
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Title" column="title" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Category" column="category" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Priority" column="priority" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Created" column="createdAt" pathname="/tickets/assigned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
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
                            <td>{formatDateTime(ticket.createdAt)}</td>
                            <td className="text-end">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                className="btn btn-sm btn-outline-secondary"
                                title="View"
                                aria-label={`View ${ticket.ticketNumber}`}
                              >
                                <i className="bi bi-eye" aria-hidden="true"></i>
                              </Link>
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
                  {totalPages > 1 && (
                    <ul className="pagination pagination-sm m-0 float-end">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                          <Link
                            className="page-link"
                            href={{
                              pathname: "/tickets/assigned",
                              query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p },
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
