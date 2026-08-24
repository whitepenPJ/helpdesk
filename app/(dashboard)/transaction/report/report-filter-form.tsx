"use client";

import { useState } from "react";
import { Select2Select } from "../../_components/select2-select";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { STATUSES } from "../../tickets/ticket-badges";

type Option = { value: string; label: string };

export function ReportFilterForm({
  categories,
  companies,
  departments,
  users,
  current,
}: {
  categories: Option[];
  companies: Option[];
  departments: (Option & { companyId: string })[];
  users: Option[];
  current: {
    categoryIds: string[];
    dateFrom: string;
    dateTo: string;
    statuses: string[];
    companyId: string;
    departmentId: string;
    userId: string;
    groupByCategory: boolean;
  };
}) {
  const [companyId, setCompanyId] = useState(current.companyId);
  const departmentOptions = departments
    .filter((d) => !companyId || d.companyId === companyId)
    .map((d) => ({ value: d.value, label: d.label }));

  return (
    <div className="card mb-4">
      <div className="card-header">
        <div className="card-title">Filters</div>
      </div>
      <form method="get" action="/transaction/report">
        <FormVendorScripts />
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Category</label>
              <Select2Select
                name="categoryId"
                multiple
                defaultValues={current.categoryIds}
                placeholder="All categories"
                options={categories}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Status</label>
              <Select2Select
                name="status"
                multiple
                defaultValues={current.statuses}
                placeholder="All statuses"
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Requester (User)</label>
              <Select2Select name="userId" defaultValue={current.userId} placeholder="All users" options={users} />
            </div>

            <div className="col-md-3">
              <label htmlFor="dateFrom" className="form-label">
                Date From
              </label>
              <input type="date" id="dateFrom" name="dateFrom" className="form-control" defaultValue={current.dateFrom} />
            </div>
            <div className="col-md-3">
              <label htmlFor="dateTo" className="form-label">
                Date To
              </label>
              <input type="date" id="dateTo" name="dateTo" className="form-control" defaultValue={current.dateTo} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Company</label>
              <Select2Select
                name="companyId"
                defaultValue={companyId}
                placeholder="All companies"
                options={companies}
                onChange={(value) => setCompanyId(value as string)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Department</label>
              <Select2Select
                key={companyId || "no-company"}
                name="departmentId"
                defaultValue={companyId ? current.departmentId : ""}
                placeholder={companyId ? "All departments" : "Select a company first"}
                options={departmentOptions}
                disabled={!companyId}
              />
            </div>

            <div className="col-12">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="groupByCategory"
                  name="groupByCategory"
                  value="1"
                  defaultChecked={current.groupByCategory}
                />
                <label className="form-check-label" htmlFor="groupByCategory">
                  Group by Category
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer d-flex flex-wrap gap-2 justify-content-end">
          <button type="submit" className="btn btn-primary">
            <i className="bi bi-funnel me-1" aria-hidden="true"></i>
            Apply Filters
          </button>
          <button type="submit" formAction="/api/report/export" formMethod="get" name="format" value="xlsx" className="btn btn-outline-success">
            <i className="bi bi-file-earmark-excel me-1" aria-hidden="true"></i>
            Export to Excel
          </button>
          <button type="submit" formAction="/api/report/export" formMethod="get" name="format" value="pdf" className="btn btn-outline-danger">
            <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>
            Export to PDF
          </button>
        </div>
      </form>
    </div>
  );
}
