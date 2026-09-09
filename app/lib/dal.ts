import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";

// Centralizes the "is this an admin" check so every Master page and Server
// Action re-verifies it server-side — proxy.ts only confirms a session
// exists, not the role, and pages alone don't stop a direct POST to a
// Server Action.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== Role.ADMIN) {
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
// individually to the user (via TicketAssignee). Approval Ticket only
// applies to supervisors.
export async function getTicketMenuCounts(userId: string, role: Role): Promise<TicketMenuCounts> {
  const [ticketCount, memberships, approvalCount] = await Promise.all([
    prisma.ticket.count({ where: { createdById: userId, status: { not: "CLOSED" }, deletedAt: null } }),
    prisma.userGroupMember.findMany({ where: { userId }, select: { userGroupId: true } }),
    role === Role.SUPERVISOR
      ? prisma.ticketApproval.count({
          where: {
            status: "PENDING",
            Ticket: { deletedAt: null, Department: { DepartmentApprover: { some: { userId } } } },
          },
        })
      : Promise.resolve(0),
  ]);

  const assignedCount = await prisma.ticket.count({
    where: {
      status: { not: "CLOSED" },
      deletedAt: null,
      OR: [
        ...(memberships.length
          ? [{ TicketAssignedGroup: { some: { userGroupId: { in: memberships.map((m) => m.userGroupId) } } } }]
          : []),
        { TicketAssignee: { some: { userId } } },
      ],
    },
  });

  return { ticketCount, assignedCount, approvalCount };
}
