"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { saveAttachments } from "@/app/lib/attachments";
import { notifyCommentAdded } from "@/app/lib/notifications";

export type CommentFormState =
  | {
      errors?: Record<string, string[]>;
      values?: { message: string };
      success?: boolean;
    }
  | undefined;

export async function createComment(
  ticketId: string,
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const session = await requireUser();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      createdById: true,
      TicketAssignee: { select: { userId: true } },
      TicketAssignedGroup: { select: { userGroupId: true } },
    },
  });
  if (!ticket) {
    return { errors: { message: ["Ticket not found."] } };
  }

  // Same "who can see this ticket" rule as the non-admin visibility gate in
  // ticket-detail-content.tsx — anyone who can view the ticket can comment
  // on it: the owner, an individual assignee, a member of the assigned
  // group, or the reviewing supervisor.
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = ticket.createdById === session.user.id;
  const isAssignee = ticket.TicketAssignee.some((a) => a.userId === session.user.id);
  let canComment = isAdmin || isOwner || isAssignee;
  if (!canComment) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { userGroupId: true } });
    canComment = Boolean(me?.userGroupId) && ticket.TicketAssignedGroup.some((g) => g.userGroupId === me?.userGroupId);
  }
  if (!canComment) {
    const approval = await prisma.ticketApproval.findUnique({
      where: { ticketId },
      select: { Ticket: { select: { departmentId: true } } },
    });
    if (approval) {
      const isDeptApprover = await prisma.departmentApprover.findUnique({
        where: { departmentId_userId: { departmentId: approval.Ticket.departmentId, userId: session.user.id } },
      });
      canComment = Boolean(isDeptApprover);
    }
  }
  if (!canComment) {
    return { errors: { message: ["You don't have permission to comment on this ticket."] } };
  }

  const message = formData.get("message");
  if (typeof message !== "string" || message.trim().length === 0) {
    return { errors: { message: ["Enter a comment."] }, values: { message: typeof message === "string" ? message : "" } };
  }

  const attachmentFiles = formData.getAll("attachments").filter((f) => f instanceof File) as File[];
  const commentId = randomUUID();
  const attachments = await saveAttachments("comments", commentId, attachmentFiles);

  await prisma.ticketComment.create({
    data: {
      id: commentId,
      ticketId,
      authorId: session.user.id,
      message: message.trim(),
      attachments,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/assigned/${ticketId}`);
  revalidatePath(`/transaction/ticket-management/${ticketId}`);

  await notifyCommentAdded(ticketId, session.user.id).catch((error) =>
    console.error("createComment: notifyCommentAdded failed", error)
  );

  return { success: true };
}
