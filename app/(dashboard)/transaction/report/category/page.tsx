import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/app/lib/dal";
import { getCategoryReportData } from "@/app/lib/category-report-data";
import { parseDate } from "@/app/lib/report-filters";
import { slaDaysLabel } from "@/app/lib/sla";
import { DateRangeFilterForm } from "../_components/date-range-filter-form";
import { CategoryReportCharts } from "./category-report-charts";

export const metadata: Metadata = { title: "Category Report" };

export default async function CategoryReportPage({ searchParams }: PageProps<"/transaction/report/category">) {
  await requireAdmin();

  const params = await searchParams;
  const dateFromRaw = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateToRaw = typeof params.dateTo === "string" ? params.dateTo : "";
  const dateFrom = parseDate(dateFromRaw, false);
  const dateTo = parseDate(dateToRaw, true);

  const data = await getCategoryReportData(dateFrom, dateTo);

  return (
    <>
      <CategoryReportCharts rows={data.rows} />

      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Category Report</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Report</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Category Report
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
            <div className="col-12 col-sm-4">
              <div className="info-box">
                <span className="info-box-icon text-bg-info shadow-sm">
                  <i className="bi bi-tag" aria-hidden="true"></i>
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
            formHref="/transaction/report/category"
            exportHref="/api/report/category/export"
            dateFrom={dateFromRaw}
            dateTo={dateToRaw}
          />

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Tickets by Category</h5>
                </div>
                <div className="card-body">
                  <div id="category-report-chart"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Categories</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Active</th>
                          <th>Processing</th>
                          <th>Done</th>
                          <th>Total</th>
                          <th>Avg SLA Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row) => (
                          <tr key={row.categoryId}>
                            <td className="fw-medium">{row.categoryName}</td>
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
                              No categories found.
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
