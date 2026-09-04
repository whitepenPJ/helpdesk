import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/app/lib/dal";
import { searchTickets } from "@/app/lib/ticket-search";
import { Pagination } from "../_components/pagination";
import { PageSizeSelect } from "../_components/page-size-select";
import { STATUS_BADGE, PRIORITY_BADGE, PROGRAM_BADGE } from "../tickets/ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import { parsePageSize } from "@/app/lib/page-size";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const session = await requireUser();

  const { q, page, pageSize: pageSizeParam } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);

  const allResults = await searchTickets(session.user.id, session.user.role, query);
  const total = allResults.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const results = allResults.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  const backHref = `/search?${new URLSearchParams({ q: query, ...(currentPage > 1 ? { page: String(currentPage) } : {}) }).toString()}`;

  return (
    <>
      <PageHeader title="Search" role={session.user.role} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
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
                        placeholder="Search by ticket no, title, user, department, or company"
                        aria-label="Search tickets"
                      />
                    </div>
                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                      <i className="bi bi-search me-1" aria-hidden="true"></i>
                      Search
                    </button>
                  </form>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <th>Ticket No</th>
                          <th>Title</th>
                          <th>Category</th>
                          <th>Company / Department</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Transaction Date</th>
                          <th>Assignee</th>
                          <th>Program</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row) => (
                          <tr key={`${row.program}-${row.id}`}>
                            <td className="fw-medium">
                              <Link href={`${row.href}?back=${encodeURIComponent(backHref)}`}>
                                {row.ticketNumber}
                              </Link>
                            </td>
                            <td>{row.title}</td>
                            <td>{row.categoryName}</td>
                            <td>
                              {row.companyName}
                              <div className="fs-7 text-secondary">{row.departmentName}</div>
                            </td>
                            <td>
                              <span className={`badge ${PRIORITY_BADGE[row.priority]}`}>{row.priority}</span>
                            </td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[row.status]}`}>{row.status}</span>
                            </td>
                            <td>{formatDateTime(row.transactionDate)}</td>
                            <td>{row.assignee}</td>
                            <td>
                              <span className={`badge ${PROGRAM_BADGE[row.program]}`}>{row.program}</span>
                            </td>
                          </tr>
                        ))}
                        {results.length === 0 && (
                          <tr>
                            <td colSpan={9} className="text-center text-secondary py-4">
                              {query.trim() ? "No tickets found." : "Enter a search term to find tickets."}
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
                      Showing {results.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + results.length} of {total} results
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({ pathname: "/search", query: { q: query, page: p, pageSize: String(pageSize) } })}
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
