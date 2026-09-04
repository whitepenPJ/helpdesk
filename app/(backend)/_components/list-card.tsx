import Link from "next/link";
import { SortableTh } from "./sortable-th";
import { Pagination } from "./pagination";
import { PageSizeSelect } from "./page-size-select";
import type { SortDir } from "@/app/lib/table-sort";

type LinkQuery = Record<string, string | string[] | undefined>;

const DEFAULT_NEW_ICON = "bi-plus-lg";
const DEFAULT_NEW_LABEL = "Add New";
const DEFAULT_ITEM_NOUN = "Items";
const DEFAULT_EMPTY_MESSAGE = "No records found.";

// One column of the list table's header row. Give a `sort` key to render a
// clickable <SortableTh>; omit it for a plain <th> (e.g. the "Actions"
// column).
export type ListColumn = {
  label: string;
  sort?: string;
  className?: string;
};

// The shared scaffold behind every master list page: a card with a GET
// search/filter form in the header, a sortable table in the body, and a
// "Showing x–y of n" + page-size + pagination footer. Callers supply the
// column definitions and render their own <tr> rows as `children`;
// everything structural (markup, query-string plumbing, empty state,
// pagination hrefs) lives here.
export function ListCard({
  pathname,
  query,
  linkQuery,
  searchPlaceholder,
  submitLabel = "Search",
  submitIcon = "bi-search",
  filters,
  actions,
  newHref,
  newLabel = DEFAULT_NEW_LABEL,
  newIcon = DEFAULT_NEW_ICON,
  columns,
  sortBy,
  sortDir,
  children,
  itemCount,
  total,
  itemNoun = DEFAULT_ITEM_NOUN,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  currentPage,
  pageSize,
  totalPages,
}: {
  pathname: string;
  query: string;
  linkQuery: LinkQuery;
  searchPlaceholder: string;
  /** Submit button text — "Search" by default, "Filter" when there are extra filter controls. */
  submitLabel?: string;
  /** Bootstrap Icons class for the submit button. */
  submitIcon?: string;
  /** Extra filter controls (selects, etc.) placed after the search input. */
  filters?: React.ReactNode;
  /** Extra buttons (export, import, …) placed between the submit and "New" buttons. */
  actions?: React.ReactNode;
  newHref: string;
  /** "New" button text — defaults to "Add New". */
  newLabel?: string;
  /** Bootstrap Icons class for the "New" button — defaults to "bi-plus-lg". */
  newIcon?: string;
  columns: ListColumn[];
  sortBy: string;
  sortDir: SortDir;
  /** The rendered <tr> rows for the current page. */
  children: React.ReactNode;
  /** Number of rows on the current page (drives the "Showing" range and empty state). */
  itemCount: number;
  total: number;
  /** Plural noun for the footer count, e.g. "categories" — defaults to "Items". */
  itemNoun?: string;
  /** Empty-state text — defaults to "No records found.". */
  emptyMessage?: string;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}) {
  const from = itemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = (currentPage - 1) * pageSize + itemCount;

  return (
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
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </div>
              {filters}
              <button type="submit" className="btn btn-sm btn-outline-secondary">
                <i className={`bi ${submitIcon} me-1`} aria-hidden="true"></i>
                {submitLabel}
              </button>
              {actions}
              <Link href={newHref} className="btn btn-sm btn-primary">
                <i className={`bi ${newIcon} me-1`} aria-hidden="true"></i>
                {newLabel}
              </Link>
            </form>
          </div>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle m-0">
            <thead>
              <tr>
                {columns.map((col) =>
                  col.sort ? (
                    <SortableTh
                      key={col.label}
                      label={col.label}
                      column={col.sort}
                      pathname={pathname}
                      query={linkQuery}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      className={col.className}
                    />
                  ) : (
                    <th key={col.label} className={col.className}>
                      {col.label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {children}
              {itemCount === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center text-secondary py-4">
                    {emptyMessage}
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
            Showing {from} to {to} of {total} {itemNoun}
          </div>
          <PageSizeSelect pageSize={pageSize} />
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          className="pagination pagination-sm m-0"
          makeHref={(p) => ({ pathname, query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p } })}
        />
      </div>
    </div>
  );
}
