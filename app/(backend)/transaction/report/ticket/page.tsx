import type { Metadata } from "next";
import { requireAdmin } from "@/app/lib/dal";
import { getTicketReportData } from "@/app/lib/ticket-report-data";
import { parseDate } from "@/app/lib/report-filters";
import { formatDateTime } from "@/app/lib/date-format";
import { STATUS_BADGE, PRIORITY_BADGE } from "../../../tickets/ticket-badges";
import { DateRangeFilterForm } from "../_components/date-range-filter-form";
import { TicketReportCharts } from "./ticket-report-charts";
import { PageHeader } from "../../../_components/page-header";

export const metadata: Metadata = { title: "Ticket Report" };

const TABLE_LIMIT = 50;

export default async function TicketReportPage({ searchParams }: PageProps<"/transaction/report/ticket">) {
  const session = await requireAdmin();

  const params = await searchParams;
  const dateFromRaw = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateToRaw = typeof params.dateTo === "string" ? params.dateTo : "";
  const dateFrom = parseDate(dateFromRaw, false);
  const dateTo = parseDate(dateToRaw, true);

  const data = await getTicketReportData(dateFrom, dateTo);
  const visibleTickets = data.tickets.slice(0, TABLE_LIMIT);

  return (
    <>
      <TicketReportCharts ratingDistribution={data.ratingDistribution} monthly={data.monthly} />

      <PageHeader
        title="Ticket Report"
        role={session.user.role}
        breadcrumbs={[{ label: "Report" }, { label: "Ticket Report" }]}
      />

      <div className="app-content">
        <div className="container-fluid">
          <DateRangeFilterForm
            formHref="/transaction/report/ticket"
            exportHref="/api/report/ticket/export"
            dateFrom={dateFromRaw}
            dateTo={dateToRaw}
          />

          <div className="row">
            <div className="col-md-5">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Satisfaction Distribution</h5>
                </div>
                <div className="card-body">
                  <div id="ticket-report-rating-pie"></div>
                </div>
              </div>
            </div>
            <div className="col-md-7">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Satisfaction by Month</h5>
                </div>
                <div className="card-body">
                  <div id="ticket-report-monthly-chart"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Satisfaction by Category</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Rated Tickets</th>
                          <th>Avg Satisfaction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byCategory.map((row) => (
                          <tr key={row.categoryName}>
                            <td className="fw-medium">{row.categoryName}</td>
                            <td>{row.count}</td>
                            <td>{row.avgRating !== null ? `${row.avgRating.toFixed(1)} / 5` : "—"}</td>
                          </tr>
                        ))}
                        {data.byCategory.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center text-secondary py-4">
                              No rated tickets in range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Tickets</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
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
                          <th>Assignment</th>
                          <th>Transaction Date</th>
                          <th>Resolved</th>
                          <th>Closed</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTickets.map((t) => (
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
                            <td>{t.assignment}</td>
                            <td>{formatDateTime(t.transactionDate)}</td>
                            <td>{t.resolvedAt ? formatDateTime(t.resolvedAt) : "—"}</td>
                            <td>{t.closedAt ? formatDateTime(t.closedAt) : "—"}</td>
                            <td>{t.ratingScore !== null ? `${t.ratingScore} / 5` : "—"}</td>
                          </tr>
                        ))}
                        {visibleTickets.length === 0 && (
                          <tr>
                            <td colSpan={12} className="text-center text-secondary py-4">
                              No tickets match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {data.tickets.length > TABLE_LIMIT && (
                  <div className="card-footer text-center fs-7 text-secondary">
                    Showing {TABLE_LIMIT} of {data.tickets.length} tickets — export to Excel or PDF for the full set
                    (Excel includes every ticket field).
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
