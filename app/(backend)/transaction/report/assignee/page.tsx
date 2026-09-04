import type { Metadata } from "next";
import { requireAdmin } from "@/app/lib/dal";
import { getAssigneeReportData } from "@/app/lib/assignee-report-data";
import { parseDate } from "@/app/lib/report-filters";
import { slaDaysLabel } from "@/app/lib/sla";
import { DateRangeFilterForm } from "../_components/date-range-filter-form";
import { AssigneeReportCharts } from "./assignee-report-charts";
import { PageHeader } from "../../../_components/page-header";

export const metadata: Metadata = { title: "Assignee Report" };

export default async function AssigneeReportPage({ searchParams }: PageProps<"/transaction/report/assignee">) {
  const session = await requireAdmin();

  const params = await searchParams;
  const dateFromRaw = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateToRaw = typeof params.dateTo === "string" ? params.dateTo : "";
  const dateFrom = parseDate(dateFromRaw, false);
  const dateTo = parseDate(dateToRaw, true);

  const data = await getAssigneeReportData(dateFrom, dateTo);

  return (
    <>
      <AssigneeReportCharts rows={data.rows} />

      <PageHeader
        title="Assignee Report"
        role={session.user.role}
        breadcrumbs={[{ label: "Report" }, { label: "Assignee Report" }]}
      />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row g-3 mb-1">
            <div className="col-12 col-sm-4">
              <div className="info-box">
                <span className="info-box-icon text-bg-info shadow-sm">
                  <i className="bi bi-person-check" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Active</span>
                  <span className="info-box-number">{data.totals.active}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-4">
              <div className="info-box">
                <span className="info-box-icon text-bg-danger shadow-sm">
                  <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Processing</span>
                  <span className="info-box-number">{data.totals.processing}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-4">
              <div className="info-box">
                <span className="info-box-icon text-bg-success shadow-sm">
                  <i className="bi bi-check-circle" aria-hidden="true"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Done</span>
                  <span className="info-box-number">{data.totals.done}</span>
                </div>
              </div>
            </div>
          </div>

          <DateRangeFilterForm
            formHref="/transaction/report/assignee"
            exportHref="/api/report/assignee/export"
            dateFrom={dateFromRaw}
            dateTo={dateToRaw}
          />

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Workload by Assignee</h5>
                </div>
                <div className="card-body">
                  <div id="assignee-report-chart"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Assignees</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <th>Assignee</th>
                          <th>Active</th>
                          <th>Processing</th>
                          <th>Done</th>
                          <th>Total</th>
                          <th>Avg SLA Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row) => (
                          <tr key={row.assigneeId}>
                            <td className="fw-medium">{row.assigneeName}</td>
                            <td>{row.active}</td>
                            <td>{row.processing}</td>
                            <td>{row.done}</td>
                            <td>{row.total}</td>
                            <td>{slaDaysLabel(row.avgSlaDays)}</td>
                          </tr>
                        ))}
                        {data.rows.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-secondary py-4">
                              No assignees found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer fs-7 text-secondary">
                  SLA Time = Assigned Date Time → Resolved Date Time, in days. Active = New/Assigned/Reopened,
                  Processing = Waiting on Approval, Done = Resolved/Closed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
