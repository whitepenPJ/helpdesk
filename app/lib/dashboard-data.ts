import "server-only";
import { prisma } from "@/app/lib/db";
import { STATUSES, PRIORITIES } from "@/app/(backend)/tickets/ticket-badges";
import { OPEN_STATUSES, AWAITING_CLOSE_STATUSES } from "@/app/lib/ticket-status-groups";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;
const RECAP_DAYS = 30;

export type TrendPoint = { date: string; created: number; closed: number };

export type NeedsAttentionTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  companyName: string;
  createdAt: Date;
};

export type AgentWorkloadRow = {
  userId: string;
  name: string;
  active: number;
  resolved30d: number;
  avgRating: number | null;
};

export type RecentTicketRow = {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  companyName: string;
  assigneeName: string | null;
  createdAt: Date;
};

export type AdminDashboardData = {
  openCount: number;
  unassignedCount: number;
  pendingApprovalCount: number;
  awaitingCloseCount: number;
  trend: TrendPoint[];
  recap: {
    totalCreated: number;
    totalClosed: number;
    avgResolutionHours: number | null;
    avgCsat: number | null;
  };
  statusBreakdown: { status: TicketStatus; count: number }[];
  priorityBreakdown: { priority: Priority; count: number }[];
  needsAttention: NeedsAttentionTicket[];
  agentWorkload: AgentWorkloadRow[];
  recentTickets: RecentTicketRow[];
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const now = new Date();
  const trendSince = new Date(now.getTime() - (TREND_DAYS - 1) * DAY_MS);
  const recapSince = new Date(now.getTime() - RECAP_DAYS * DAY_MS);

  const [
    openCount,
    unassignedCount,
    pendingApprovalCount,
    awaitingCloseCount,
    createdInTrendWindow,
    closedInTrendWindow,
    totalCreatedRecap,
    totalClosedRecap,
    resolvedRecap,
    csatRecap,
    statusGroups,
    priorityGroups,
    needsAttentionRaw,
    activeByAssignee,
    resolved30dByAssignee,
    ratingRowsByAssignee,
    recentTicketsRaw,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: OPEN_STATUSES }, deletedAt: null } }),
    // Matches the "Unassigned" KPI's link target 1:1 (Ticket Management's
    // `unassigned=1` filter) — deliberately not narrowed by status, so the
    // tile's number always equals the row count on the page it links to.
    prisma.ticket.count({ where: { TicketAssignee: { none: {} }, deletedAt: null } }),
    prisma.ticket.count({ where: { status: "WAITING", deletedAt: null } }),
    prisma.ticket.count({ where: { status: { in: AWAITING_CLOSE_STATUSES }, deletedAt: null } }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: trendSince }, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.ticket.findMany({
      where: { closedAt: { gte: trendSince }, deletedAt: null },
      select: { closedAt: true },
    }),
    prisma.ticket.count({ where: { createdAt: { gte: recapSince }, deletedAt: null } }),
    prisma.ticket.count({ where: { closedAt: { gte: recapSince }, deletedAt: null } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { gte: recapSince }, deletedAt: null },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.ticket.aggregate({
      where: { ratingScore: { not: null }, closedAt: { gte: recapSince }, deletedAt: null },
      _avg: { ratingScore: true },
    }),
    prisma.ticket.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { status: { not: "CLOSED" }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { TicketAssignee: { none: {} }, status: { notIn: ["CLOSED"] }, deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        Company: { select: { name: true } },
      },
    }),
    prisma.ticketAssignee.groupBy({
      by: ["userId"],
      where: { Ticket: { status: "ASSIGNED", deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.ticketAssignee.groupBy({
      by: ["userId"],
      where: { Ticket: { resolvedAt: { gte: recapSince }, deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.ticketAssignee.findMany({
      where: { Ticket: { ratingScore: { not: null }, deletedAt: null } },
      select: { userId: true, Ticket: { select: { ratingScore: true } } },
    }),
    prisma.ticket.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        Company: { select: { name: true } },
        TicketAssignee: { select: { User: { select: { name: true } } } },
      },
    }),
  ]);

  // Bucket the raw created/closed timestamps into per-day counts for the
  // trend chart — cheaper to fetch the raw rows once and reduce in JS than
  // to run 14 separate count() queries per series.
  const trendMap = new Map<string, TrendPoint>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const key = dayKey(new Date(trendSince.getTime() + i * DAY_MS));
    trendMap.set(key, { date: key, created: 0, closed: 0 });
  }
  for (const { createdAt } of createdInTrendWindow) {
    const point = trendMap.get(dayKey(createdAt));
    if (point) point.created += 1;
  }
  for (const { closedAt } of closedInTrendWindow) {
    if (!closedAt) continue;
    const point = trendMap.get(dayKey(closedAt));
    if (point) point.closed += 1;
  }
  const trend = Array.from(trendMap.values());

  const resolutionHours = resolvedRecap
    .filter((t) => t.resolvedAt)
    .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (60 * 60 * 1000));
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length
    : null;

  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const statusBreakdown = STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  const priorityCounts = new Map(priorityGroups.map((g) => [g.priority, g._count._all]));
  const priorityBreakdown = PRIORITIES.map((priority) => ({ priority, count: priorityCounts.get(priority) ?? 0 }));

  const needsAttention: NeedsAttentionTicket[] = needsAttentionRaw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    priority: t.priority,
    status: t.status,
    companyName: t.Company.name,
    createdAt: t.createdAt,
  }));

  const ratingAcc = new Map<string, { sum: number; count: number }>();
  for (const { userId, Ticket } of ratingRowsByAssignee) {
    const entry = ratingAcc.get(userId) ?? { sum: 0, count: 0 };
    entry.sum += Ticket.ratingScore!;
    entry.count += 1;
    ratingAcc.set(userId, entry);
  }

  const assigneeIds = new Set<string>();
  for (const g of activeByAssignee) assigneeIds.add(g.userId);
  for (const g of resolved30dByAssignee) assigneeIds.add(g.userId);
  for (const userId of ratingAcc.keys()) assigneeIds.add(userId);

  const assigneeUsers = assigneeIds.size
    ? await prisma.user.findMany({ where: { id: { in: Array.from(assigneeIds) } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(assigneeUsers.map((u) => [u.id, u.name]));
  const activeById = new Map(activeByAssignee.map((g) => [g.userId, g._count._all]));
  const resolved30dById = new Map(resolved30dByAssignee.map((g) => [g.userId, g._count._all]));
  const avgRatingById = new Map(
    Array.from(ratingAcc.entries()).map(([userId, { sum, count }]) => [userId, sum / count])
  );

  const agentWorkload: AgentWorkloadRow[] = Array.from(assigneeIds)
    .map((userId) => ({
      userId,
      name: nameById.get(userId) ?? "Unknown",
      active: activeById.get(userId) ?? 0,
      resolved30d: resolved30dById.get(userId) ?? 0,
      avgRating: avgRatingById.get(userId) ?? null,
    }))
    .sort((a, b) => b.active - a.active || b.resolved30d - a.resolved30d)
    .slice(0, 8);

  const recentTickets: RecentTicketRow[] = recentTicketsRaw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    companyName: t.Company.name,
    assigneeName: t.TicketAssignee.map((a) => a.User.name).join(", ") || null,
    createdAt: t.createdAt,
  }));

  return {
    openCount,
    unassignedCount,
    pendingApprovalCount,
    awaitingCloseCount,
    trend,
    recap: {
      totalCreated: totalCreatedRecap,
      totalClosed: totalClosedRecap,
      avgResolutionHours,
      avgCsat: csatRecap._avg.ratingScore,
    },
    statusBreakdown,
    priorityBreakdown,
    needsAttention,
    agentWorkload,
    recentTickets,
  };
}
