export type SortDir = "asc" | "desc";

// Shared by every sortable data table: resolves the `sort`/`dir` query
// params against a page's allowed columns, falling back to that page's
// default column/direction when neither is present (or the column isn't
// recognized — e.g. a stale/hand-edited URL).
export function parseSort<T extends string>(
  sortParam: string | undefined,
  dirParam: string | undefined,
  allowed: readonly T[],
  fallback: { column: T; dir: SortDir }
): { sortBy: T; sortDir: SortDir } {
  const sortBy = sortParam && (allowed as readonly string[]).includes(sortParam) ? (sortParam as T) : fallback.column;
  const sortDir: SortDir = dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : fallback.dir;
  return { sortBy, sortDir };
}
