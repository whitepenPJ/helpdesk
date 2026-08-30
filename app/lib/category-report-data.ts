import "server-only";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { toStatusBucket } from "@/app/lib/ticket-status-groups";
import { getFirstAssignedAtByTicket, slaDays } from "@/app/lib/sla";

export type CategoryReportRow = {
  categoryId: string;
  categoryName: string;
  active: number;
  processing: number;
  done: number;
  total: number;
  avgSlaDays: number | null;
};

export type CategoryReportData = {
  rows: CategoryReportRow[];
  totals: { active: number; processing: number; done: number };
};

// Base row set is every active category, not just the ones with tickets in
// range — so a quiet category still shows up as a 0/0/0 row rather than
// silently disappearing from the report.
export async function getCategoryReportData(dateFrom: Date | null, dateTo: Date | null): Promise<CategoryReportData> {
  const [categories, tickets] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ticket.findMany({
      where: {
        deletedAt: null,
        ...(dateFrom || dateTo
          ? {
              transactionDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      } satisfies Prisma.TicketWhereInput,
      select: { id: true, status: true, resolvedAt: true, categoryId: true, Category: { select: { name: true } } },
    }),
  ]);

  const assignedAtByTicket = await getFirstAssignedAtByTicket(tickets.map((t) => t.id));

  const acc = new Map<string, { name: string; active: number; processing: number; done: number; slas: number[] }>();
  for (const c of categories) acc.set(c.id, { name: c.name, active: 0, processing: 0, done: 0, slas: [] });

  for (const t of tickets) {
    const bucket = toStatusBucket(t.status);
    const entry = acc.get(t.categoryId) ?? { name: t.Category.name, active: 0, processing: 0, done: 0, slas: [] };
    if (bucket === "Active") entry.active += 1;
    else if (bucket === "Processing") entry.processing += 1;
    else entry.done += 1;
    const assignedAt = assignedAtByTicket.get(t.id);
    if (assignedAt && t.resolvedAt) entry.slas.push(slaDays(assignedAt, t.resolvedAt));
    acc.set(t.categoryId, entry);
  }

  const rows: CategoryReportRow[] = Array.from(acc.entries())
    .map(([categoryId, e]) => ({
      categoryId,
      categoryName: e.name,
      active: e.active,
      processing: e.processing,
      done: e.done,
      total: e.active + e.processing + e.done,
      avgSlaDays: e.slas.length ? e.slas.reduce((sum, v) => sum + v, 0) / e.slas.length : null,
    }))
    .sort((a, b) => b.total - a.total);

  const totals = rows.reduce(
    (sum, r) => ({
      active: sum.active + r.active,
      processing: sum.processing + r.processing,
      done: sum.done + r.done,
    }),
    { active: 0, processing: 0, done: 0 }
  );

  return { rows, totals };
}
