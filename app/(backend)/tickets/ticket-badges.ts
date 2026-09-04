import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import type { SearchProgram } from "@/app/lib/ticket-search";

export const STATUS_BADGE: Record<TicketStatus, string> = {
  NEW: "text-bg-secondary",
  ASSIGNED: "text-bg-info",
  RESOLVED: "text-bg-primary",
  REOPENED: "text-bg-warning",
  CLOSED: "text-bg-dark",
  WAITING: "text-bg-danger",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "text-bg-secondary",
  MEDIUM: "text-bg-info",
  HIGH: "text-bg-warning",
  URGENT: "text-bg-danger",
};

// NEW/WAITING/REOPENED need eyes soonest (nothing is happening for the
// customer), then RESOLVED/ASSIGNED, then CLOSED last.
export const STATUSES: TicketStatus[] = ["NEW", "WAITING", "REOPENED", "RESOLVED", "ASSIGNED", "CLOSED"];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const PROGRAM_BADGE: Record<SearchProgram, string> = {
  Ticket: "text-bg-secondary",
  "Assign Ticket": "text-bg-info",
  "Approval Ticket": "text-bg-warning",
  "Ticket Management": "text-bg-dark",
};
