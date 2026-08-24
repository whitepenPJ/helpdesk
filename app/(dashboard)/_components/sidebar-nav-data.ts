export type NavLeaf = {
  icon: string;
  label: string;
  href?: string;
  badge?: string;
};

export type NavParent = {
  icon: string;
  label: string;
  badge?: string;
  adminOnly?: boolean;
  children: NavNode[];
};

export type NavHeader = { header: string };

export type NavNode = NavLeaf | NavParent | NavHeader;

export function isHeader(node: NavNode): node is NavHeader {
  return "header" in node;
}

export function isParent(node: NavNode): node is NavParent {
  return "children" in node;
}

import type { Role } from "@/app/generated/prisma/client";
import type { TicketMenuCounts } from "@/app/lib/dal";
import { CHAT_ENABLED } from "@/app/lib/feature-flags";

// Admins keep Dashboard + a plain Tickets link, plus Assigned Ticket for
// tickets individually assigned to them (badged, like everyone else's).
// Everyone else has no dashboard — Supervisors land on Approval Ticket,
// everyone else on Ticket — and gets Ticket / Assigned Ticket (Supervisors
// additionally get Approval Ticket) with live incomplete-ticket counts as
// badges.
export function buildSidebarNav({ role, ticketCount, assignedCount, approvalCount }: TicketMenuCounts & { role: Role }): NavNode[] {
  const items: NavNode[] = [];

  if (role === "ADMIN") {
    items.push({ icon: "bi-speedometer", label: "Dashboard", href: "/dashboard" });
    items.push({ icon: "bi-ticket-perforated", label: "Tickets", href: "/tickets" });
    items.push({
      icon: "bi-person-check",
      label: "Assigned Ticket",
      href: "/tickets/assigned",
      ...(assignedCount > 0 ? { badge: String(assignedCount) } : {}),
    });
    items.push({
      icon: "bi-file-earmark-bar-graph",
      label: "Report",
      children: [
        { icon: "bi-graph-up", label: "Main Report", href: "/transaction/report" },
        { icon: "bi-person-lines-fill", label: "Assignee Report", href: "/transaction/report/assignee" },
        { icon: "bi-tags", label: "Category Report", href: "/transaction/report/category" },
        { icon: "bi-receipt", label: "Ticket Report", href: "/transaction/report/ticket" },
      ],
    });
  } else {
    if (role === "SUPERVISOR") {
      items.push({
        icon: "bi-clipboard-check",
        label: "Approval Ticket",
        href: "/tickets/approval",
        ...(approvalCount > 0 ? { badge: String(approvalCount) } : {}),
      });
    }
    items.push({
      icon: "bi-ticket-perforated",
      label: "Ticket",
      href: "/tickets",
      ...(ticketCount > 0 ? { badge: String(ticketCount) } : {}),
    });
    items.push({
      icon: "bi-person-check",
      label: "Assigned Ticket",
      href: "/tickets/assigned",
      ...(assignedCount > 0 ? { badge: String(assignedCount) } : {}),
    });
  }

  // Role-agnostic knowledge-base browse — otherwise only reachable via the
  // Profile page's Lesson Learned card.
  items.push({ icon: "bi-lightbulb", label: "Lesson Learned", href: "/lesson-learned" });
  if (CHAT_ENABLED) {
    items.push({ icon: "bi-robot", label: "Ask AI", href: "/chat" });
  }

  items.push({
    icon: "bi-arrow-left-right",
    label: "Transaction",
    adminOnly: true,
    children: [{ icon: "bi-kanban", label: "Ticket Management", href: "/transaction/ticket-management" }],
  });
  items.push({
    icon: "bi-diagram-3-fill",
    label: "Master",
    adminOnly: true,
    children: [
      { icon: "bi-people", label: "User", href: "/master/user" },
      { icon: "bi-building", label: "Company", href: "/master/company" },
      { icon: "bi-collection", label: "User Group", href: "/master/user-group" },
      { icon: "bi-tags", label: "Category", href: "/master/category" },
      { icon: "bi-journal-check", label: "Lesson Learned", href: "/master/lesson-learned" },
    ],
  });

  return items;
}
