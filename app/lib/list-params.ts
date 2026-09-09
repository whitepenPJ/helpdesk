import { parsePageSize } from "./page-size";
import { parseSort, type SortDir } from "./table-sort";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListParams<SortColumn extends string> = {
  query: string;
  currentPage: number;
  pageSize: number;
  sortBy: SortColumn;
  sortDir: SortDir;
  /** Base query-string params (`q`, `pageSize`) every list link/pagination href needs to preserve. */
  linkQuery: Record<string, string>;
};

/**
 * Parses the `q`/`page`/`pageSize`/`sort`/`dir` search params every master-data
 * list page reads, into the shape `ListCard` and its Prisma query need.
 * Page-specific filters (e.g. a `role` select) aren't handled here — read
 * those from `searchParams` separately and merge them into `linkQuery`.
 */
export function parseListParams<SortColumn extends string>(
  searchParams: RawSearchParams,
  sortColumns: readonly SortColumn[],
  defaultSort: { column: SortColumn; dir: SortDir }
): ListParams<SortColumn> {
  const { q, page, pageSize: pageSizeParam, sort, dir } = searchParams;
  const query = typeof q === "string" ? q : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    sortColumns,
    defaultSort
  );
  const linkQuery = { ...(query ? { q: query } : {}), pageSize: String(pageSize) };

  return { query, currentPage, pageSize, sortBy, sortDir, linkQuery };
}
