import "server-only";
import { prisma } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { toStatusBucket } from "@/app/lib/ticket-status-groups";
import { getFirstAssignedAtByTicket, slaDays } from "@/app/lib/sla";

export type AssigneeReportRow = {
  assigneeId: string;
  assigneeName: string;
  active: number;
  processing: number;
  done: number;
  total: number;
  avgSlaDays: number | null;
};

export type AssigneeReportData = {
  rows: AssigneeReportRow[];
  totals: { active: number; processing: number; done: number };
};

// Base row set is every active assignee-eligible user (User.isAssignee),
// not just the ones with tickets in range — so someone carrying zero load
// this period still shows up as a 0/0/0 row rather than silently
// disappearing from the report.
export async function getAssigneeReportData(dateFrom: Date | null, dateTo: Date | null): Promise<AssigneeReportData> {
  const [assignees, tickets] = await Promise.all([
    prisma.user.findMany({
      where: { isAssignee: true, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        TicketAssignee: { some: {} },
        ...(dateFrom || dateTo
          ? {
              transactionDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      } satisfies Prisma.TicketWhereInput,
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        TicketAssignee: { select: { userId: true, User: { select: { name: true } } } },
      },
    }),
  ]);

  const assignedAtByTicket = await getFirstAssignedAtByTicket(tickets.map((t) => t.id));

  const acc = new Map<string, { name: string; active: number; processing: number; done: number; slas: number[] }>();
  for (const a of assignees) acc.set(a.id, { name: a.name, active: 0, processing: 0, done: 0, slas: [] });

  for (const t of tickets) {
    const bucket = toStatusBucket(t.status);
    const assignedAt = assignedAtByTicket.get(t.id);
    for (const a of t.TicketAssignee) {
      const entry = acc.get(a.userId) ?? { name: a.User.name, active: 0, processing: 0, done: 0, slas: [] };
      if (bucket === "Active") entry.active += 1;
      else if (bucket === "Processing") entry.processing += 1;
      else entry.done += 1;
      if (assignedAt && t.resolvedAt) entry.slas.push(slaDays(assignedAt, t.resolvedAt));
      acc.set(a.userId, entry);
    }
  }

  const rows: AssigneeReportRow[] = Array.from(acc.entries())
    .map(([assigneeId, e]) => ({
      assigneeId,
      assigneeName: e.name,
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
