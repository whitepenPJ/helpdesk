import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import type { Role } from "@/app/generated/prisma/client";

// Centralizes the "is this an admin" check so every Master page and Server
// Action re-verifies it server-side — proxy.ts only confirms a session
// exists, not the role, and pages alone don't stop a direct POST to a
// Server Action.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}

// Same re-verification for pages/actions open to any signed-in role (e.g.
// Tickets) — proxy.ts's session check alone doesn't stop a direct POST to a
// Server Action.
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export type TicketMenuCounts = {
  ticketCount: number;
  assignedCount: number;
  approvalCount: number;
};

// Badge counts for the sidebar's Ticket / Assigned Ticket / Approval Ticket
// items. "Incomplete" = anything not yet CLOSED. Assigned Ticket counts
// tickets assigned to the user's own UserGroup (pool assignment) OR
// individually to the user (assigneeId — only ADMIN/SUPERVISOR can be picked
// as an individual assignee). Approval Ticket only applies to supervisors.
export async function getTicketMenuCounts(userId: string, role: Role): Promise<TicketMenuCounts> {
  const [ticketCount, me, approvalCount] = await Promise.all([
    prisma.ticket.count({ where: { createdById: userId, status: { not: "CLOSED" } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { userGroupId: true } }),
    role === "SUPERVISOR"
      ? prisma.ticketApproval.count({ where: { supervisorId: userId, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  const assignedCount = await prisma.ticket.count({
    where: {
      status: { not: "CLOSED" },
      OR: [...(me?.userGroupId ? [{ assignedGroupId: me.userGroupId }] : []), { assigneeId: userId }],
    },
  });

  return { ticketCount, assignedCount, approvalCount };
}
