import "server-only";
import { prisma } from "@/app/lib/db";
import { Prisma, type TicketStatus, type Priority } from "@/app/generated/prisma/client";
import { STATUSES, PRIORITIES } from "@/app/(backend)/tickets/ticket-badges";
import type { ReportFilters } from "@/app/lib/report-filters";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportTicketRow = {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  categoryName: string;
  companyName: string;
  departmentName: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  ratingScore: number | null;
};

export type ReportCategoryRow = {
  categoryId: string;
  categoryName: string;
  count: number;
  avgResolutionHours: number | null;
  avgRating: number | null;
};

export type ReportData = {
  tickets: ReportTicketRow[];
  kpis: {
    total: number;
    open: number;
    closed: number;
    avgResolutionHours: number | null;
    avgCsat: number | null;
  };
  statusBreakdown: { status: TicketStatus; count: number }[];
  priorityBreakdown: { priority: Priority; count: number }[];
  trend: { date: string; created: number; closed: number }[];
  byCategory: ReportCategoryRow[];
};

function buildWhere(filters: ReportFilters): Prisma.TicketWhereInput {
  return {
    deletedAt: null,
    ...(filters.categoryIds.length ? { categoryId: { in: filters.categoryIds } } : {}),
    ...(filters.statuses.length ? { status: { in: filters.statuses } } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.userId ? { createdById: filters.userId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Everything below is reduced in JS from one bounded fetch, mirroring
// getAdminDashboardData in app/lib/dashboard-data.ts — Prisma has no
// duration aggregate, and per-category resolution-time/CSAT averages would
// otherwise mean one groupBy per category.
export async function getReportData(filters: ReportFilters): Promise<ReportData> {
  const where = buildWhere(filters);

  const raw = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      ratingScore: true,
      categoryId: true,
      Category: { select: { name: true } },
      companyId: true,
      Company: { select: { name: true } },
      departmentId: true,
      Department: { select: { name: true } },
      createdById: true,
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const tickets: ReportTicketRow[] = raw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    categoryName: t.Category.name,
    companyName: t.Company.name,
    departmentName: t.Department.name,
    requesterName: t.User_Ticket_createdByIdToUser.name,
    requesterEmail: t.User_Ticket_createdByIdToUser.email,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    ratingScore: t.ratingScore,
  }));

  const total = tickets.length;
  const closed = tickets.filter((t) => t.status === "CLOSED").length;
  const open = total - closed;

  const resolutionHours = tickets
    .filter((t) => t.resolvedAt)
    .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (60 * 60 * 1000));
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length
    : null;

  const ratings = tickets.filter((t) => t.ratingScore !== null).map((t) => t.ratingScore as number);
  const avgCsat = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

  const statusCounts = new Map<TicketStatus, number>();
  for (const t of tickets) statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  const statusBreakdown = STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  const priorityCounts = new Map<Priority, number>();
  for (const t of tickets) priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
  const priorityBreakdown = PRIORITIES.map((priority) => ({ priority, count: priorityCounts.get(priority) ?? 0 }));

  // Trend spans the filtered date range when both bounds are given
  // (matching what the admin actually asked to see); otherwise falls back
  // to the same 14-day window the Dashboard uses, anchored on today.
  const trendEnd = filters.dateTo ?? new Date();
  const trendStart = filters.dateFrom ?? new Date(trendEnd.getTime() - 13 * DAY_MS);
  const trendDays = Math.max(1, Math.round((trendEnd.getTime() - trendStart.getTime()) / DAY_MS) + 1);
  const trendMap = new Map<string, { date: string; created: number; closed: number }>();
  for (let i = 0; i < trendDays; i++) {
    const key = dayKey(new Date(trendStart.getTime() + i * DAY_MS));
    trendMap.set(key, { date: key, created: 0, closed: 0 });
  }
  for (const t of tickets) {
    const point = trendMap.get(dayKey(t.createdAt));
    if (point) point.created += 1;
  }
  for (const t of tickets) {
    if (!t.closedAt) continue;
    const point = trendMap.get(dayKey(t.closedAt));
    if (point) point.closed += 1;
  }
  const trend = Array.from(trendMap.values());

  const byCategoryAcc = new Map<
    string,
    { categoryName: string; count: number; resolutionHours: number[]; ratings: number[] }
  >();
  for (const t of raw) {
    const entry = byCategoryAcc.get(t.categoryId) ?? {
      categoryName: t.Category.name,
      count: 0,
      resolutionHours: [],
      ratings: [],
    };
    entry.count += 1;
    if (t.resolvedAt) entry.resolutionHours.push((t.resolvedAt.getTime() - t.createdAt.getTime()) / (60 * 60 * 1000));
    if (t.ratingScore !== null) entry.ratings.push(t.ratingScore);
    byCategoryAcc.set(t.categoryId, entry);
  }
  const byCategory: ReportCategoryRow[] = Array.from(byCategoryAcc.entries())
    .map(([categoryId, entry]) => ({
      categoryId,
      categoryName: entry.categoryName,
      count: entry.count,
      avgResolutionHours: entry.resolutionHours.length
        ? entry.resolutionHours.reduce((sum, h) => sum + h, 0) / entry.resolutionHours.length
        : null,
      avgRating: entry.ratings.length ? entry.ratings.reduce((sum, r) => sum + r, 0) / entry.ratings.length : null,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    tickets,
    kpis: { total, open, closed, avgResolutionHours, avgCsat },
    statusBreakdown,
    priorityBreakdown,
    trend,
    byCategory,
  };
}

export type ReportFilterOptions = {
  categories: { value: string; label: string }[];
  companies: { value: string; label: string }[];
  departments: { value: string; label: string; companyId: string }[];
  users: { value: string; label: string }[];
};

export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const [categories, companies, departments, users] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
    companies: companies.map((c) => ({ value: c.id, label: c.name })),
    departments: departments.map((d) => ({ value: d.id, label: d.name, companyId: d.companyId })),
    users: users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
  };
}
