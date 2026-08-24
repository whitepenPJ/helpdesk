import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/app/lib/dal";
import { getReportData, getReportFilterOptions } from "@/app/lib/report-data";
import { parseReportFilters, toURLSearchParams } from "@/app/lib/report-filters";
import { STATUS_BADGE, PRIORITY_BADGE } from "../../tickets/ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import { ReportCharts } from "./report-charts";
import { ReportFilterForm } from "./report-filter-form";

export const metadata: Metadata = { title: "Main Report" };

const PAGE_SIZE = 20;

export default async function ReportPage({ searchParams }: PageProps<"/transaction/report">) {
  await requireAdmin();

  const rawSearchParams = await searchParams;
  const params = toURLSearchParams(rawSearchParams);
  const filters = parseReportFilters(params);

  const [options, data] = await Promise.all([getReportFilterOptions(), getReportData(filters)]);

  const current = {
    categoryIds: params.getAll("categoryId"),
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    statuses: params.getAll("status"),
    companyId: params.get("companyId") ?? "",
    departmentId: params.get("departmentId") ?? "",
    userId: params.get("userId") ?? "",
    groupByCategory: filters.groupByCategory,
  };

  const totalRows = filters.groupByCategory ? data.byCategory.length : data.tickets.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(params.get("page")) || 1), totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedCategories = filters.groupByCategory ? data.byCategory.slice(pageStart, pageStart + PAGE_SIZE) : [];
  const flatTickets = filters.groupByCategory ? [] : data.tickets.slice(pageStart, pageStart + PAGE_SIZE);

  function pageHref(page: number): string {
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    return `/transaction/report?${p.toString()}`;
  }

  // Windowed page numbers (current ± 2, plus first/last) so a large result
  // set doesn't render hundreds of page links — "…" fills the gaps.
  const pageNumbers: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2) {
      pageNumbers.push(p);
    } else if (pageNumbers[pageNumbers.length - 1] !== "ellipsis") {
      pageNumbers.push("ellipsis");
    }
  }

  return (
    <>
      <ReportCharts trend={data.trend} statusBreakdown={data.statusBreakdown} priorityBreakdown={data.priorityBreakdown} />

      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Main Report</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Report</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Main Report
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row g-3 mb-1">
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-primary shadow-sm">
                  <i className="bi bi-ticket-perforated" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Total Tickets</span>
                  <span className="info-box-number">{data.kpis.total}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-info shadow-sm">
                  <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Open</span>
                  <span className="info-box-number">{data.kpis.open}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-dark shadow-sm">
                  <i className="bi bi-check-circle" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Closed</span>
                  <span className="info-box-number">{data.kpis.closed}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-success shadow-sm">
                  <i className="bi bi-emoji-smile" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Avg CSAT</span>
                  <span className="info-box-number">
                    {data.kpis.avgCsat !== null ? `${data.kpis.avgCsat.toFixed(1)} / 5` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ReportFilterForm
            categories={options.categories}
            companies={options.companies}
            departments={options.departments}
            users={options.users}
            current={current}
          />

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Ticket Volume</h5>
                </div>
                <div className="card-body">
                  <div id="report-trend-chart"></div>
                </div>
                <div className="card-footer">
                  <div className="row">
                    <div className="col-md-4 col-6">
                      <div className="text-center border-end">
                        <h5 className="fw-bold mb-0">{data.kpis.total}</h5>
                        <span className="text-uppercase fs-8">Matching Tickets</span>
                      </div>
                    </div>
                    <div className="col-md-4 col-6">
                      <div className="text-center border-end">
                        <h5 className="fw-bold mb-0">
                          {data.kpis.avgResolutionHours !== null ? `${data.kpis.avgResolutionHours.toFixed(1)}h` : "—"}
                        </h5>
                        <span className="text-uppercase fs-8">Avg Resolution Time</span>
                      </div>
                    </div>
                    <div className="col-md-4 col-6">
                      <div className="text-center">
                        <h5 className="fw-bold mb-0">
                          {data.kpis.avgCsat !== null ? `${data.kpis.avgCsat.toFixed(1)} / 5` : "—"}
                        </h5>
                        <span className="text-uppercase fs-8">Avg CSAT</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Tickets by Status</h5>
                </div>
                <div className="card-body">
                  <div id="report-status-donut-chart"></div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Tickets by Priority</h5>
                </div>
                <div className="card-body">
                  <div id="report-priority-bar-chart"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">{filters.groupByCategory ? "Tickets by Category" : "Tickets"}</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    {filters.groupByCategory ? (
                      <table className="table table-hover align-middle m-0">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Ticket Count</th>
                            <th>Avg Resolution</th>
                            <th>Avg CSAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCategories.map((row) => (
                            <tr key={row.categoryId}>
                              <td>{row.categoryName}</td>
                              <td>{row.count}</td>
                              <td>{row.avgResolutionHours !== null ? `${row.avgResolutionHours.toFixed(1)}h` : "—"}</td>
                              <td>{row.avgRating !== null ? `${row.avgRating.toFixed(1)} / 5` : "—"}</td>
                            </tr>
                          ))}
                          {data.byCategory.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center text-secondary py-4">
                                No tickets match these filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="table table-hover align-middle m-0">
                        <thead>
                          <tr>
                            <th>Ticket #</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Company / Department</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Requester</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flatTickets.map((t) => (
                            <tr key={t.id}>
                              <td className="fw-medium">{t.ticketNumber}</td>
                              <td>{t.title}</td>
                              <td>{t.categoryName}</td>
                              <td>
                                {t.companyName}
                                <div className="fs-7 text-secondary">{t.departmentName}</div>
                              </td>
                              <td>
                                <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                              </td>
                              <td>
                                <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                              </td>
                              <td>{t.requesterName}</td>
                              <td>{formatDateTime(t.createdAt)}</td>
                            </tr>
                          ))}
                          {flatTickets.length === 0 && (
                            <tr>
                              <td colSpan={8} className="text-center text-secondary py-4">
                                No tickets match these filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                {totalRows > 0 && (
                  <div className="card-footer d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <span className="fs-7 text-secondary">
                      Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, totalRows)} of {totalRows}{" "}
                      {filters.groupByCategory ? "categories" : "tickets"}
                    </span>
                    {totalPages > 1 && (
                      <nav aria-label="Report table pagination">
                        <ul className="pagination pagination-sm m-0">
                          <li className={`page-item ${currentPage <= 1 ? "disabled" : ""}`}>
                            <Link className="page-link" href={pageHref(currentPage - 1)} aria-disabled={currentPage <= 1}>
                              Previous
                            </Link>
                          </li>
                          {pageNumbers.map((p, i) =>
                            p === "ellipsis" ? (
                              <li key={`ellipsis-${i}`} className="page-item disabled">
                                <span className="page-link">…</span>
                              </li>
                            ) : (
                              <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                                <Link className="page-link" href={pageHref(p)}>
                                  {p}
                                </Link>
                              </li>
                            )
                          )}
                          <li className={`page-item ${currentPage >= totalPages ? "disabled" : ""}`}>
                            <Link className="page-link" href={pageHref(currentPage + 1)} aria-disabled={currentPage >= totalPages}>
                              Next
                            </Link>
                          </li>
                        </ul>
                      </nav>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
