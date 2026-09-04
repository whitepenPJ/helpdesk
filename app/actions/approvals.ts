"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { notifyTicketApproved, notifyTicketRejected } from "@/app/lib/notifications";

export type DecideApprovalState = { error?: string; success?: boolean } | undefined;

// Supervisor decides a pending TicketApproval. Reject closes the ticket
// outright (the admin's request didn't hold up, so there's nothing left to
// keep working); approve restores whatever status the ticket had before
// entering WAITING (see requestTicketApproval in app/actions/tickets.ts,
// which snapshots it into preApprovalStatus) and re-notifies the category's
// admins so they know it's clear to proceed.
export async function decideTicketApproval(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  _prevState: DecideApprovalState,
  formData: FormData
): Promise<DecideApprovalState> {
  const session = await requireUser();

  const approval = await prisma.ticketApproval.findUnique({
    where: { id: approvalId },
    include: {
      Ticket: { select: { id: true, preApprovalStatus: true, departmentId: true } },
    },
  });
  if (!approval) return { error: "Approval request not found." };
  if (approval.status !== "PENDING") return { error: "This request has already been decided." };

  const decider = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      DepartmentApprover: { where: { departmentId: approval.Ticket.departmentId }, select: { id: true } },
    },
  });
  if (!decider || decider.DepartmentApprover.length === 0) {
    return { error: "You are not an approver for this ticket's department." };
  }

  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" && reasonValue.trim() ? reasonValue.trim() : null;
  if (decision === "REJECTED" && !reason) {
    return { error: "Enter a reason for rejecting." };
  }

  const supervisorName = decider.name;
  const now = new Date();
  const newStatus = decision === "REJECTED" ? "CLOSED" : (approval.Ticket.preApprovalStatus ?? "ASSIGNED");

  // Guards against two approvers deciding at once — the update only
  // succeeds if the request is still PENDING at the moment of the write; if
  // another approver beat this one to it, `count` comes back 0 and the
  // ticket/history writes are skipped rather than double-applying a decision.
  const decided = await prisma.$transaction(async (tx) => {
    const { count } = await tx.ticketApproval.updateMany({
      where: { id: approvalId, status: "PENDING" },
      data: { supervisorId: session.user.id, status: decision, comments: reason, decidedAt: now, updatedAt: now },
    });
    if (count === 0) return false;

    await tx.ticket.update({
      where: { id: approval.ticketId },
      data: {
        status: newStatus,
        preApprovalStatus: null,
        updatedAt: now,
        ...(newStatus === "CLOSED" ? { closedAt: now } : {}),
      },
    });
    await tx.ticketHistory.create({
      data: {
        id: randomUUID(),
        ticketId: approval.ticketId,
        actorId: session.user.id,
        // Just the status transition — who decided is now shown via the
        // normal actor-name prefix everywhere this history renders, and the
        // reason/comment (if any) is still saved on the TicketApproval row
        // itself (see the approval banner at the top of the ticket page).
        action: decision === "REJECTED" ? "Approver Rejected" : "Approver Approved",
        previousState: "WAITING",
        newState: newStatus,
      },
    });
    return true;
  });

  if (!decided) {
    return { error: "Another approver already decided this request." };
  }

  revalidatePath("/tickets/approval");
  revalidatePath(`/tickets/approval/${approval.ticketId}`);
  revalidatePath(`/tickets/${approval.ticketId}`);
  revalidatePath(`/tickets/assigned/${approval.ticketId}`);
  revalidatePath("/transaction/ticket-management");
  revalidatePath(`/transaction/ticket-management/${approval.ticketId}`);
  revalidatePath("/tickets");

  if (decision === "APPROVED") {
    await notifyTicketApproved(approval.ticketId, supervisorName).catch((error) =>
      console.error("decideTicketApproval: notifyTicketApproved failed", error)
    );
  } else {
    await notifyTicketRejected(approval.ticketId, supervisorName, reason).catch((error) =>
      console.error("decideTicketApproval: notifyTicketRejected failed", error)
    );
  }

  return { success: true };
}
