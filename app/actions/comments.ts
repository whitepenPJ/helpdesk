"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { saveAttachments } from "@/app/lib/attachments";

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

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { createdById: true } });
  if (!ticket) {
    return { errors: { message: ["Ticket not found."] } };
  }
  if (session.user.role !== "ADMIN" && ticket.createdById !== session.user.id) {
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
  return { success: true };
}
