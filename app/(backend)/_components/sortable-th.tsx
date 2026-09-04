import Link from "next/link";
import type { SortDir } from "@/app/lib/table-sort";

// A clickable `<th>` for the sortable data-table pattern used across the
// app: clicking toggles asc/desc for that column (starting at asc) and
// resets to page 1, while preserving whatever other query params (search,
// status filter, etc.) the caller passes in.
export function SortableTh({
  label,
  column,
  pathname,
  query,
  sortBy,
  sortDir,
  className,
}: {
  label: string;
  column: string;
  pathname: string;
  query: Record<string, string | string[] | undefined>;
  sortBy: string;
  sortDir: SortDir;
  className?: string;
}) {
  const isActive = sortBy === column;
  const nextDir: SortDir = isActive && sortDir === "asc" ? "desc" : "asc";
  const icon = !isActive ? "bi-arrow-down-up" : sortDir === "asc" ? "bi-sort-up" : "bi-sort-down";

  return (
    <th className={className}>
      <Link
        href={{ pathname, query: { ...query, sort: column, dir: nextDir, page: "1" } }}
        className="text-reset text-decoration-none d-inline-flex align-items-center gap-1"
      >
        {label}
        <i className={`bi ${icon} fs-7 ${isActive ? "" : "text-secondary opacity-50"}`} aria-hidden="true"></i>
      </Link>
    </th>
  );
}
