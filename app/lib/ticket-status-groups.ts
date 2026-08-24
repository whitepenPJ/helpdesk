import type { TicketStatus } from "@/app/generated/prisma/client";

// Shared between the admin dashboard's KPI tiles (which link into Ticket
// Management pre-filtered) and Ticket Management's own Status filter
// dropdown, so "Open" / "Awaiting Customer Close" etc. never drift out of
// sync between the two places that define them.
export const OPEN_STATUSES: TicketStatus[] = ["NEW", "ASSIGNED", "REOPENED"];
export const AWAITING_CLOSE_STATUSES: TicketStatus[] = ["RESOLVED"];

export type StatusFilterPreset = { label: string; statuses: TicketStatus[] };

export const STATUS_FILTER_PRESETS: StatusFilterPreset[] = [
  { label: "Open (New / Assigned / Reopened)", statuses: OPEN_STATUSES },
  { label: "Pending Approval", statuses: ["WAITING"] },
  { label: "Awaiting Customer Close", statuses: AWAITING_CLOSE_STATUSES },
];

export type StatusBucket = "Active" | "Processing" | "Done";

// Three-way status grouping for the Assignee/Category reports: Active =
// needs attention now (NEW/ASSIGNED/REOPENED), Processing = blocked on a
// supervisor's approval (WAITING), Done = the work is over
// (RESOLVED/CLOSED). Shared so the two reports' bucket breakdowns never
// define these differently.
export function toStatusBucket(status: TicketStatus): StatusBucket {
  if (status === "WAITING") return "Processing";
  if (status === "RESOLVED" || status === "CLOSED") return "Done";
  return "Active";
}
