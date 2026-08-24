"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { notifyTicketApproved } from "@/app/lib/notifications";

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
      Ticket: { select: { id: true, preApprovalStatus: true } },
      User: { select: { name: true } },
    },
  });
  if (!approval) return { error: "Approval request not found." };
  if (approval.supervisorId !== session.user.id) return { error: "You are not the reviewing supervisor." };
  if (approval.status !== "PENDING") return { error: "This request has already been decided." };

  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" && reasonValue.trim() ? reasonValue.trim() : null;
  if (decision === "REJECTED" && !reason) {
    return { error: "Enter a reason for rejecting." };
  }

  const supervisorName = approval.User.name;
  const now = new Date();
  const newStatus = decision === "REJECTED" ? "CLOSED" : (approval.Ticket.preApprovalStatus ?? "ASSIGNED");
  const label = decision === "REJECTED" ? `Closed by ${supervisorName} (Supervisor)` : `Approved by ${supervisorName} (Supervisor)`;

  await prisma.$transaction([
    prisma.ticketApproval.update({
      where: { id: approvalId },
      data: { status: decision, comments: reason, decidedAt: now, updatedAt: now },
    }),
    prisma.ticket.update({
      where: { id: approval.ticketId },
      data: {
        status: newStatus,
        preApprovalStatus: null,
        updatedAt: now,
        ...(newStatus === "CLOSED" ? { closedAt: now } : {}),
      },
    }),
    prisma.ticketHistory.create({
      data: {
        id: randomUUID(),
        ticketId: approval.ticketId,
        actorId: session.user.id,
        action: reason ? `${label}: ${reason}` : label,
        previousState: "WAITING",
        newState: newStatus,
      },
    }),
  ]);

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
  }

  return { success: true };
}
