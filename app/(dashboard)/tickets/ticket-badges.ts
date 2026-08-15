import type { TicketStatus, Priority } from "@/app/generated/prisma/client";

export const STATUS_BADGE: Record<TicketStatus, string> = {
  NEW: "text-bg-secondary",
  ASSIGNED: "text-bg-info",
  RESOLVED: "text-bg-primary",
  VERIFIED: "text-bg-success",
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
// customer), then RESOLVED/ASSIGNED/VERIFIED, then CLOSED last.
export const STATUSES: TicketStatus[] = ["NEW", "WAITING", "REOPENED", "RESOLVED", "ASSIGNED", "VERIFIED", "CLOSED"];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
