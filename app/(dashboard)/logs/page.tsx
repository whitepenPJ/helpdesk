import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { SortableTh } from "../_components/sortable-th";
import { Pagination } from "../_components/pagination";
import { PageSizeSelect } from "../_components/page-size-select";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma } from "@/app/generated/prisma/client";
import { parsePageSize } from "@/app/lib/page-size";

export const metadata: Metadata = { title: "Logs" };

// TicketHistory is the only audit trail this app actually writes to today
// (AuditLog exists in the schema but nothing populates it) — this page is
// that same per-ticket Timeline tab, but system-wide across every ticket,
// for admins auditing what happened and who did it.
const SORT_COLUMNS = ["timestamp", "ticketNumber", "action", "actor"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.TicketHistoryOrderByWithRelationInput {
  switch (sortBy) {
    case "ticketNumber":
      return { Ticket: { ticketNumber: sortDir } };
    case "actor":
      return { User: { name: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  await requireAdmin();

  const { q, page, pageSize: pageSizeParam, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "timestamp", dir: "desc" }
  );

  const where: Prisma.TicketHistoryWhereInput = query
    ? {
        OR: [
          { action: { contains: query, mode: "insensitive" } },
          { Ticket: { ticketNumber: { contains: query, mode: "insensitive" } } },
          { User: { name: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [entries, total] = await Promise.all([
    prisma.ticketHistory.findMany({
      where,
      include: { Ticket: { select: { id: true, ticketNumber: true } }, User: { select: { name: true } } },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticketHistory.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const linkQuery = { ...(query ? { q: query } : {}), pageSize: String(pageSize) };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Logs</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Logs
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
                    <div className="col-12">
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
                            placeholder="Search ticket #, action, or actor"
                            aria-label="Search logs"
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-search me-1" aria-hidden="true"></i>
                          Search
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
                          <SortableTh label="Time" column="timestamp" pathname="/logs" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/logs" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Action" column="action" pathname="/logs" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Actor" column="actor" pathname="/logs" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="text-nowrap">{formatDateTime(entry.timestamp)}</td>
                            <td>
                              <Link href={`/transaction/ticket-management/${entry.Ticket.id}`}>
                                {entry.Ticket.ticketNumber}
                              </Link>
                            </td>
                            <td>{entry.action}</td>
                            <td>{entry.User?.name ?? <span className="text-secondary">System</span>}</td>
                            <td>
                              {entry.previousState && entry.newState ? (
                                <span className="fs-7 text-secondary">
                                  {entry.previousState} → {entry.newState}
                                </span>
                              ) : entry.newState ? (
                                <span className="fs-7 text-secondary">{entry.newState}</span>
                              ) : (
                                <span className="text-secondary">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {entries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center text-secondary py-4">
                              No log entries found.
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
                      Showing {entries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + entries.length} of {total} entries
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({ pathname: "/logs", query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p } })}
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
