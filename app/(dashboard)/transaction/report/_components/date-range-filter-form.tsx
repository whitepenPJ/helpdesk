// Plain server-rendered filter — Assignee/Category/Ticket reports only need
// a Date From/To pair (no Select2 dropdowns), so unlike report-filter-form
// this needs no client-side state or cascading logic.
export function DateRangeFilterForm({
  formHref,
  exportHref,
  dateFrom,
  dateTo,
}: {
  formHref: string;
  exportHref: string;
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <div className="card mb-4">
      <div className="card-header">
        <div className="card-title">Filters</div>
      </div>
      <form method="get" action={formHref}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label htmlFor="dateFrom" className="form-label">
                Date From
              </label>
              <input type="date" id="dateFrom" name="dateFrom" className="form-control" defaultValue={dateFrom} />
            </div>
            <div className="col-md-4">
              <label htmlFor="dateTo" className="form-label">
                Date To
              </label>
              <input type="date" id="dateTo" name="dateTo" className="form-control" defaultValue={dateTo} />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex flex-wrap gap-2 justify-content-end">
          <button type="submit" className="btn btn-primary">
            <i className="bi bi-funnel me-1" aria-hidden="true"></i>
            Apply Filters
          </button>
          <button
            type="submit"
            formAction={exportHref}
            formMethod="get"
            name="format"
            value="xlsx"
            className="btn btn-outline-success"
          >
            <i className="bi bi-file-earmark-excel me-1" aria-hidden="true"></i>
            Export to Excel
          </button>
          <button
            type="submit"
            formAction={exportHref}
            formMethod="get"
            name="format"
            value="pdf"
            className="btn btn-outline-danger"
          >
            <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>
            Export to PDF
          </button>
        </div>
      </form>
    </div>
  );
}
