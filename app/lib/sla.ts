import "server-only";
import { prisma } from "@/app/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

// The Ticket table has no dedicated "assigned at" column, so this derives
// it from the earliest "Ticket assigned" TicketHistory entry per ticket —
// the same event createTicket/updateTicket already log whenever a ticket
// gets an assignee. Returns a Map so callers can look up many tickets at
// once instead of one query per ticket.
export async function getFirstAssignedAtByTicket(ticketIds: string[]): Promise<Map<string, Date>> {
  if (ticketIds.length === 0) return new Map();
  const rows = await prisma.ticketHistory.findMany({
    where: { ticketId: { in: ticketIds }, action: "Ticket assigned" },
    select: { ticketId: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (!map.has(row.ticketId)) map.set(row.ticketId, row.timestamp);
  }
  return map;
}

// SLA Time = Assigned Date Time → Resolved Date Time, expressed in days
// (can be fractional — e.g. 0.5 for same-day turnaround).
export function slaDays(assignedAt: Date, resolvedAt: Date): number {
  return (resolvedAt.getTime() - assignedAt.getTime()) / DAY_MS;
}

export function slaDaysLabel(days: number | null): string {
  return days !== null ? `${days.toFixed(1)}d` : "—";
}
