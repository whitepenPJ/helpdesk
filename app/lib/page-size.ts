// Shared "rows per page" control for every paginated table — one small set
// of choices app-wide rather than each page inventing its own.
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 20;

export function parsePageSize(value: string | undefined): number {
  const n = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
