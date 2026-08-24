import { STATUSES } from "@/app/(dashboard)/tickets/ticket-badges";
import type { TicketStatus } from "@/app/generated/prisma/client";

export type ReportFilters = {
  categoryIds: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
  statuses: TicketStatus[];
  companyId: string | null;
  departmentId: string | null;
  userId: string | null;
  groupByCategory: boolean;
};

// Exported for the Assignee/Category/Ticket reports too — they only need a
// plain Date From/To pair, not the rest of ReportFilters.
export function parseDate(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Shared by the report page (server component) and the export Route
// Handler so the two can never interpret the same query string
// differently — both read straight off `URLSearchParams`.
export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    categoryIds: searchParams.getAll("categoryId").filter(Boolean),
    dateFrom: parseDate(searchParams.get("dateFrom") ?? undefined, false),
    dateTo: parseDate(searchParams.get("dateTo") ?? undefined, true),
    statuses: searchParams
      .getAll("status")
      .filter((s): s is TicketStatus => (STATUSES as readonly string[]).includes(s)),
    companyId: searchParams.get("companyId") || null,
    departmentId: searchParams.get("departmentId") || null,
    userId: searchParams.get("userId") || null,
    groupByCategory: searchParams.get("groupByCategory") === "1",
  };
}

// Reuses the same field names the report page's <form method="get"> and the
// export route's <button formAction> both submit under (see
// report-filter-form.tsx), so building a plain query object from
// `PageProps` searchParams (string | string[] | undefined per key) goes
// through this instead of duplicating the shape.
export function toURLSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.append(key, value);
    }
  }
  return params;
}
