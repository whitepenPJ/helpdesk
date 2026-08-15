"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";

export type DecideApprovalState = { error?: string; success?: boolean } | undefined;

// Supervisor decides a pending TicketApproval — restores the ticket to
// whatever status it had before entering WAITING (see requestTicketApproval
// in app/actions/tickets.ts, which snapshots it into preApprovalStatus).
export async function decideTicketApproval(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  _prevState: DecideApprovalState,
  formData: FormData
): Promise<DecideApprovalState> {
  const session = await requireUser();

  const approval = await prisma.ticketApproval.findUnique({
    where: { id: approvalId },
    include: { Ticket: { select: { id: true, preApprovalStatus: true } } },
  });
  if (!approval) return { error: "Approval request not found." };
  if (approval.supervisorId !== session.user.id) return { error: "You are not the reviewing supervisor." };
  if (approval.status !== "PENDING") return { error: "This request has already been decided." };

  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" && reasonValue.trim() ? reasonValue.trim() : null;
  if (decision === "REJECTED" && !reason) {
    return { error: "Enter a reason for rejecting." };
  }

  const now = new Date();
  const restoredStatus = approval.Ticket.preApprovalStatus ?? "ASSIGNED";
  const label = decision === "APPROVED" ? "Approval approved" : "Approval rejected";

  await prisma.$transaction([
    prisma.ticketApproval.update({
      where: { id: approvalId },
      data: { status: decision, comments: reason, decidedAt: now, updatedAt: now },
    }),
    prisma.ticket.update({
      where: { id: approval.ticketId },
      data: { status: restoredStatus, preApprovalStatus: null, updatedAt: now },
    }),
    prisma.ticketHistory.create({
      data: {
        id: randomUUID(),
        ticketId: approval.ticketId,
        actorId: session.user.id,
        action: reason ? `${label}: ${reason}` : label,
        previousState: "WAITING",
        newState: restoredStatus,
      },
    }),
  ]);

  revalidatePath("/tickets/approval");
  revalidatePath(`/tickets/${approval.ticketId}`);
  revalidatePath("/transaction/ticket-management");
  revalidatePath("/tickets");
  return { success: true };
}
