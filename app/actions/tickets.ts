"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser, requireAdmin } from "@/app/lib/dal";
import { Prisma, type TicketStatus, type Priority } from "@/app/generated/prisma/client";
import { STATUSES, PRIORITIES } from "@/app/(dashboard)/tickets/ticket-badges";
import {
  notifyTicketAssigned,
  notifyTicketCreated,
  notifyApprovalRequested,
  notifyTicketResolved,
} from "@/app/lib/notifications";
import { formatAssignment } from "@/app/lib/ticket-format";
import { saveAttachments } from "@/app/lib/attachments";
import { mapScoreToRating } from "@/app/lib/rating";
import { stripHtml, textToSafeHtml } from "@/app/lib/text";

export type TicketFormValues = {
  title: string;
  description: string;
  categoryId: string;
  telephone: string;
  companyId: string;
  departmentId: string;
  creatorId: string;
  transactionDate: string;
};

// The transaction date field is a plain `<input type="datetime-local">`
// ("YYYY-MM-DDTHH:mm", no timezone) — falls back to now on anything blank
// or unparseable rather than rejecting the submission, since the field
// defaults to "now" client-side anyway.
function parseTransactionDate(formData: FormData): Date {
  const raw = formData.get("transactionDate");
  if (typeof raw === "string" && raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export type TicketFormState =
  | {
      errors?: Record<string, string[]>;
      values?: TicketFormValues;
    }
  | undefined;

// TK + YYMMDD + a 4-digit sequence that runs per calendar month (UTC) and
// resets to 0001 when the month changes — e.g. TK2608140001, ...,
// TK2608310042, then TK2609010001 on September 1st. The day still appears
// in the number, but doesn't reset the counter on its own.
export async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const monthPrefix = `TK${yy}${mm}`;

  const monthTickets = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: monthPrefix } },
    select: { ticketNumber: true },
  });
  const lastSeq = monthTickets.reduce((max, { ticketNumber }) => {
    const seq = Number(ticketNumber.slice(-4));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  const nextSeq = String(lastSeq + 1).padStart(4, "0");
  return `${monthPrefix}${dd}${nextSeq}`;
}


export async function createTicket(_prevState: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const session = await requireUser();

  const title = formData.get("title");
  const description = formData.get("description");
  const categoryId = formData.get("categoryId");
  const telephone = formData.get("telephone");
  const companyId = formData.get("companyId");
  const departmentId = formData.get("departmentId");
  const requestedCreatorId = formData.get("creatorId");
  const attachmentFiles = formData.getAll("attachments").filter((f) => f instanceof File) as File[];

  // Only an admin's chosen value is honored — anyone else's submission is
  // ignored server-side regardless of what the (disabled) field contained,
  // since a direct POST can send whatever it wants.
  const isAdmin = session.user.role === "ADMIN";
  const creatorId = isAdmin && typeof requestedCreatorId === "string" && requestedCreatorId ? requestedCreatorId : session.user.id;

  const transactionDateRaw = formData.get("transactionDate");
  const transactionDate = parseTransactionDate(formData);

  const values: TicketFormValues = {
    title: typeof title === "string" ? title : "",
    description: typeof description === "string" ? description : "",
    categoryId: typeof categoryId === "string" ? categoryId : "",
    telephone: typeof telephone === "string" ? telephone : "",
    companyId: typeof companyId === "string" ? companyId : "",
    departmentId: typeof departmentId === "string" ? departmentId : "",
    creatorId,
    transactionDate: typeof transactionDateRaw === "string" ? transactionDateRaw : "",
  };

  const errors: Record<string, string[]> = {};

  if (typeof title !== "string" || title.trim().length === 0) {
    errors.title = ["Enter a title."];
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    errors.description = ["Enter a description."];
  }
  if (typeof telephone !== "string" || telephone.trim().length === 0) {
    errors.telephone = ["Enter a telephone number."];
  }
  if (typeof categoryId !== "string" || !categoryId) {
    errors.categoryId = ["Select a category."];
  }
  if (typeof companyId !== "string" || !companyId) {
    errors.companyId = ["Select a company."];
  }
  if (typeof departmentId !== "string" || !departmentId) {
    errors.departmentId = ["Select a department."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const [category, department, creator, categoryAdmins, categoryGroups] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId as string } }),
    prisma.department.findUnique({ where: { id: departmentId as string } }),
    prisma.user.findUnique({ where: { id: creatorId } }),
    prisma.categoryAdmin.findMany({
      where: { categoryId: categoryId as string, User: { status: "ACTIVE" } },
      select: { adminId: true, User: { select: { name: true } } },
    }),
    prisma.categoryUserGroup.findMany({
      where: { categoryId: categoryId as string, UserGroup: { isActive: true } },
      select: { userGroupId: true, UserGroup: { select: { name: true } } },
    }),
  ]);

  if (!category) {
    return { errors: { categoryId: ["Selected category was not found."] }, values };
  }
  if (!department) {
    return { errors: { departmentId: ["Selected department was not found."] }, values };
  }
  if (department.companyId !== companyId) {
    return { errors: { departmentId: ["Selected department does not belong to the selected company."] }, values };
  }
  if (!creator) {
    return { errors: { creatorId: ["Selected creator was not found."] }, values };
  }

  // A category with responsible users and/or user groups configured
  // (Master Category's "Responsible Users"/"Responsible User Groups")
  // auto-assigns a new ticket to them instead of leaving it NEW — filtered
  // to still-active users/groups so a stale responsible-but-deactivated row
  // doesn't produce an ASSIGNED ticket with nobody real behind it.
  const shouldAutoAssign = categoryAdmins.length > 0 || categoryGroups.length > 0;
  const initialStatus = shouldAutoAssign ? "ASSIGNED" : "NEW";

  const ticketId = randomUUID();
  const attachments = await saveAttachments("tickets", ticketId, attachmentFiles);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.ticket.create({
        data: {
          id: ticketId,
          ticketNumber: await generateTicketNumber(),
          title: (title as string).trim(),
          description: (description as string).trim(),
          categoryId: categoryId as string,
          companyId: companyId as string,
          departmentId: departmentId as string,
          telephone: (telephone as string).trim(),
          attachments,
          createdById: creatorId,
          status: initialStatus,
          transactionDate,
          updatedAt: new Date(),
        },
      });
      await prisma.ticketHistory.create({
        data: {
          id: randomUUID(),
          ticketId,
          actorId: session.user.id,
          action: "Ticket created",
          newState: initialStatus,
        },
      });
      if (shouldAutoAssign) {
        await prisma.$transaction([
          ...(categoryAdmins.length
            ? [
                prisma.ticketAssignee.createMany({
                  data: categoryAdmins.map((a) => ({ id: randomUUID(), ticketId, userId: a.adminId })),
                }),
              ]
            : []),
          ...(categoryGroups.length
            ? [
                prisma.ticketAssignedGroup.createMany({
                  data: categoryGroups.map((g) => ({ id: randomUUID(), ticketId, userGroupId: g.userGroupId })),
                }),
              ]
            : []),
        ]);
        await prisma.ticketHistory.create({
          data: {
            id: randomUUID(),
            ticketId,
            actorId: session.user.id,
            action: "Ticket assigned",
            newState: formatAssignment(
              categoryAdmins.map((a) => a.User.name),
              categoryGroups.map((g) => g.UserGroup.name)
            ),
          },
        });
      }
      break;
    } catch (error) {
      const isDuplicateTicketNumber =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | undefined)?.includes("ticketNumber");
      if (isDuplicateTicketNumber && attempt < 2) continue;
      throw error;
    }
  }

  // Auto-assigned tickets notify the assignees directly rather than also
  // notifying the category's admins to triage — when auto-assigned, those
  // are typically the same people (the category's own responsible
  // users/groups), so sending both would double-notify them about one
  // ticket. Matches how a human admin manually assigning a ticket already
  // fires only notifyTicketAssigned, not notifyTicketCreated too.
  if (shouldAutoAssign) {
    await notifyTicketAssigned(ticketId, {
      assigneeIds: categoryAdmins.map((a) => a.adminId),
      assignedGroupIds: categoryGroups.map((g) => g.userGroupId),
    }).catch((error) => console.error("createTicket: notifyTicketAssigned failed", error));
  } else {
    await notifyTicketCreated(ticketId).catch((error) => console.error("createTicket: notifyTicketCreated failed", error));
  }

  revalidatePath("/tickets");
  if (shouldAutoAssign) {
    revalidatePath("/tickets/assigned");
  }
  redirect(`/tickets/${ticketId}`);
}

// Ticket owner (or an admin) edits the ticket's own content — title,
// description, category, telephone, company/department — while it's still
// unactioned. Re-verifies ownership and status server-side, same defensive
// pattern as closeTicket: the edit link/button is only rendered for eligible
// tickets, but a direct POST could target any ticket id.
export async function editTicket(
  ticketId: string,
  _prevState: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { errors: { form: ["Ticket not found."] } };
  if (ticket.createdById !== session.user.id && !isAdmin) {
    return { errors: { form: ["You don't have permission to edit this ticket."] } };
  }
  if (ticket.status !== "NEW") {
    return { errors: { form: ["Only tickets with status NEW can be edited."] } };
  }

  const title = formData.get("title");
  const description = formData.get("description");
  const categoryId = formData.get("categoryId");
  const telephone = formData.get("telephone");
  const companyId = formData.get("companyId");
  const departmentId = formData.get("departmentId");
  const transactionDateRaw = formData.get("transactionDate");
  const transactionDate = parseTransactionDate(formData);

  const values: TicketFormValues = {
    title: typeof title === "string" ? title : "",
    description: typeof description === "string" ? description : "",
    categoryId: typeof categoryId === "string" ? categoryId : "",
    telephone: typeof telephone === "string" ? telephone : "",
    companyId: typeof companyId === "string" ? companyId : "",
    departmentId: typeof departmentId === "string" ? departmentId : "",
    creatorId: ticket.createdById,
    transactionDate: typeof transactionDateRaw === "string" ? transactionDateRaw : "",
  };

  const errors: Record<string, string[]> = {};

  if (typeof title !== "string" || title.trim().length === 0) {
    errors.title = ["Enter a title."];
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    errors.description = ["Enter a description."];
  }
  if (typeof telephone !== "string" || telephone.trim().length === 0) {
    errors.telephone = ["Enter a telephone number."];
  }
  if (typeof categoryId !== "string" || !categoryId) {
    errors.categoryId = ["Select a category."];
  }
  if (typeof companyId !== "string" || !companyId) {
    errors.companyId = ["Select a company."];
  }
  if (typeof departmentId !== "string" || !departmentId) {
    errors.departmentId = ["Select a department."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const [category, department] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId as string } }),
    prisma.department.findUnique({ where: { id: departmentId as string } }),
  ]);

  if (!category) {
    return { errors: { categoryId: ["Selected category was not found."] }, values };
  }
  if (!department) {
    return { errors: { departmentId: ["Selected department was not found."] }, values };
  }
  if (department.companyId !== companyId) {
    return { errors: { departmentId: ["Selected department does not belong to the selected company."] }, values };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      title: (title as string).trim(),
      description: (description as string).trim(),
      categoryId: categoryId as string,
      companyId: companyId as string,
      departmentId: departmentId as string,
      telephone: (telephone as string).trim(),
      transactionDate,
      updatedAt: new Date(),
    },
  });

  await prisma.ticketHistory.create({
    data: {
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Ticket edited",
    },
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
  redirect(`/tickets/${ticketId}`);
}

// Ticket owner (or an admin) deletes a ticket that's still NEW — same
// eligibility check as editTicket, re-verified server-side since this is a
// public endpoint reachable directly, not just from the button that's hidden
// once a ticket moves past NEW.
export async function deleteTicket(ticketId: string): Promise<void> {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { createdById: true, status: true },
  });
  if (!ticket) return;
  if (ticket.createdById !== session.user.id && !isAdmin) return;
  if (ticket.status !== "NEW") return;

  await prisma.ticket.delete({ where: { id: ticketId } });

  revalidatePath("/tickets");
  redirect("/tickets");
}

// Admin-only edit from the Ticket Management screen: reassign to a user
// and/or a user group, and optionally transition status, in one save. Only
// fires a notification when the assignment actually changed, not on every
// save. `status` is optional — the modal's "Save" button omits it to mean
// "just update the assignment," which still auto-promotes a NEW/REOPENED
// ticket to ASSIGNED the moment it gets an assignee or group; the
// Resolved/Verified/Re-Open buttons send an explicit status instead.
function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

export async function updateTicket(ticketId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();

  const statusValue = formData.get("status");
  const requestedAssigneeIds = [
    ...new Set(formData.getAll("assigneeId").filter((v): v is string => typeof v === "string" && v.length > 0)),
  ];
  const requestedGroupIds = [
    ...new Set(formData.getAll("assignedGroupId").filter((v): v is string => typeof v === "string" && v.length > 0)),
  ];
  const priorityValue = formData.get("priority");

  const explicitStatus =
    typeof statusValue === "string" && STATUSES.includes(statusValue as TicketStatus)
      ? (statusValue as TicketStatus)
      : null;
  const requestedPriority =
    typeof priorityValue === "string" && PRIORITIES.includes(priorityValue as Priority)
      ? (priorityValue as Priority)
      : null;

  const before = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      TicketAssignee: { select: { userId: true, User: { select: { name: true } } } },
      TicketAssignedGroup: { select: { userGroupId: true, UserGroup: { select: { name: true } } } },
    },
  });
  if (!before) return;

  // The Assign modal (Ticket Management's row actions and the ticket detail
  // page) no longer edits Problem/Solution — it simply doesn't send those
  // keys at all, which must mean "leave as-is," not "clear them." Only a
  // caller that actually sends `problem`/`solution` can change them.
  const problemValue = formData.get("problem");
  const solutionValue = formData.get("solution");
  // Tiptap's empty state serializes to "<p></p>", not "" — normalize any
  // effectively-empty value to null so an untouched field never registers
  // as "changed" against a `before.problem`/`before.solution` of null.
  const normalizedProblem = formData.has("problem")
    ? typeof problemValue === "string" && stripHtml(problemValue).length > 0
      ? problemValue
      : null
    : before.problem;
  const normalizedSolution = formData.has("solution")
    ? typeof solutionValue === "string" && stripHtml(solutionValue).length > 0
      ? solutionValue
      : null
    : before.solution;

  const [resolvedAssignees, resolvedGroups] = await Promise.all([
    requestedAssigneeIds.length
      ? prisma.user.findMany({ where: { id: { in: requestedAssigneeIds } }, select: { id: true, name: true } })
      : [],
    requestedGroupIds.length
      ? prisma.userGroup.findMany({ where: { id: { in: requestedGroupIds } }, select: { id: true, name: true } })
      : [],
  ]);
  // Silently drop any id that no longer resolves (e.g. stale dropdown from a
  // second admin's tab) rather than let a bad FK reference throw.
  const resolvedAssigneeIds = resolvedAssignees.map((a) => a.id);
  const resolvedGroupIds = resolvedGroups.map((g) => g.id);
  const beforeAssigneeIds = before.TicketAssignee.map((a) => a.userId);
  const beforeGroupIds = before.TicketAssignedGroup.map((g) => g.userGroupId);

  const hadNoAssignment = beforeAssigneeIds.length === 0 && beforeGroupIds.length === 0;
  const nowHasAssignment = resolvedAssigneeIds.length > 0 || resolvedGroupIds.length > 0;
  const autoPromote =
    hadNoAssignment && nowHasAssignment && (before.status === "NEW" || before.status === "REOPENED");
  const status = explicitStatus ?? (autoPromote ? "ASSIGNED" : before.status);
  const priority = requestedPriority ?? before.priority;

  const statusChanged = status !== before.status;
  const assignmentChanged =
    !sameIdSet(resolvedAssigneeIds, beforeAssigneeIds) || !sameIdSet(resolvedGroupIds, beforeGroupIds);
  const priorityChanged = priority !== before.priority;
  const problemChanged = normalizedProblem !== before.problem;
  const solutionChanged = normalizedSolution !== before.solution;

  if (!statusChanged && !assignmentChanged && !priorityChanged && !problemChanged && !solutionChanged) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        priority,
        problem: normalizedProblem,
        solution: normalizedSolution,
        updatedAt: now,
        ...(status === "RESOLVED" && before.status !== "RESOLVED" ? { resolvedAt: now } : {}),
        ...(status === "CLOSED" && before.status !== "CLOSED" ? { closedAt: now } : {}),
      },
    }),
    prisma.ticketAssignee.deleteMany({ where: { ticketId } }),
    prisma.ticketAssignedGroup.deleteMany({ where: { ticketId } }),
    ...(resolvedAssigneeIds.length
      ? [
          prisma.ticketAssignee.createMany({
            data: resolvedAssigneeIds.map((userId) => ({ id: randomUUID(), ticketId, userId })),
          }),
        ]
      : []),
    ...(resolvedGroupIds.length
      ? [
          prisma.ticketAssignedGroup.createMany({
            data: resolvedGroupIds.map((userGroupId) => ({ id: randomUUID(), ticketId, userGroupId })),
          }),
        ]
      : []),
  ]);

  const historyEntries: Prisma.TicketHistoryCreateManyInput[] = [];
  if (statusChanged) {
    historyEntries.push({
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Status changed",
      previousState: before.status,
      newState: status,
    });
  }
  if (assignmentChanged) {
    historyEntries.push({
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Ticket assigned",
      previousState: formatAssignment(
        before.TicketAssignee.map((a) => a.User.name),
        before.TicketAssignedGroup.map((g) => g.UserGroup.name)
      ),
      newState: formatAssignment(
        resolvedAssignees.map((a) => a.name),
        resolvedGroups.map((g) => g.name)
      ),
    });
  }
  if (priorityChanged) {
    historyEntries.push({
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Priority changed",
      previousState: before.priority,
      newState: priority,
    });
  }
  // No previousState/newState — these are rendered inline elsewhere as
  // "(prev → new)" for short state labels, and dumping long HTML there
  // would corrupt that display (same reasoning as editTicket's "Ticket
  // edited" row, which also logs action-only).
  if (problemChanged) {
    historyEntries.push({ id: randomUUID(), ticketId, actorId: session.user.id, action: "Problem updated" });
  }
  if (solutionChanged) {
    historyEntries.push({ id: randomUUID(), ticketId, actorId: session.user.id, action: "Solution updated" });
  }
  await prisma.ticketHistory.createMany({ data: historyEntries });

  if (assignmentChanged && nowHasAssignment) {
    await notifyTicketAssigned(ticketId, {
      assigneeIds: resolvedAssigneeIds,
      assignedGroupIds: resolvedGroupIds,
    }).catch((error) => console.error("updateTicket: notifyTicketAssigned failed", error));
  }

  revalidatePath("/transaction/ticket-management");
  revalidatePath(`/transaction/ticket-management/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/tickets/assigned");
  revalidatePath(`/tickets/assigned/${ticketId}`);
}

export type ResolveTicketState = { error?: string; success?: boolean } | undefined;

// The individual assignee marks an ASSIGNED ticket as Resolved, recording
// what the problem was and how it was fixed, and hands it back to the owner
// for closure. Re-verifies assignment and status server-side — the button's
// visibility isn't the security boundary. Group assignment alone doesn't
// grant this (only whoever is the individual assignee), matching how the
// assignee dropdown itself only ever contains individuals, never groups, as
// a target. `problem`/`solution` come from a plain textarea (not the admin's
// Tiptap editor) but land in the same HTML-rendered columns, so they're run
// through textToSafeHtml rather than stored raw.
export async function resolveTicket(
  ticketId: string,
  _prevState: ResolveTicketState,
  formData: FormData
): Promise<ResolveTicketState> {
  const session = await requireUser();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  const isAssignee = await prisma.ticketAssignee.findFirst({ where: { ticketId, userId: session.user.id } });
  if (!isAssignee) return { error: "This ticket isn't assigned to you." };
  if (ticket.status !== "ASSIGNED") return { error: "This ticket isn't awaiting resolution." };

  const problem = String(formData.get("problem") ?? "").trim();
  const solution = String(formData.get("solution") ?? "").trim();
  if (!problem || !solution) {
    return { error: "Enter both the problem and the solution before resolving." };
  }

  const now = new Date();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "RESOLVED",
      resolvedAt: now,
      updatedAt: now,
      problem: textToSafeHtml(problem),
      solution: textToSafeHtml(solution),
    },
  });

  await prisma.ticketHistory.create({
    data: {
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Status changed",
      previousState: "ASSIGNED",
      newState: "RESOLVED",
    },
  });

  await notifyTicketResolved(ticketId).catch((error) => console.error("resolveTicket: notifyTicketResolved failed", error));

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/assigned/${ticketId}`);
  revalidatePath(`/transaction/ticket-management/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/tickets/assigned");
  return { success: true };
}

export type CancelAssignmentState = { error?: string; success?: boolean } | undefined;

// The individual assignee reports they were wrongly assigned and backs out
// of the ticket, with a required reason (kept in TicketHistory for whoever
// reassigns it next). If that was the ticket's last assignee/group, it
// reverts to NEW and re-notifies the category's admins exactly like a
// fresh, unassigned ticket; otherwise it stays ASSIGNED for whoever's left.
// Re-verifies assignment and status server-side — the button's visibility
// isn't the security boundary.
export async function cancelAssignment(
  ticketId: string,
  _prevState: CancelAssignmentState,
  formData: FormData
): Promise<CancelAssignmentState> {
  const session = await requireUser();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { TicketAssignee: true, TicketAssignedGroup: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  const myAssignment = ticket.TicketAssignee.find((a) => a.userId === session.user.id);
  if (!myAssignment) return { error: "This ticket isn't assigned to you." };
  if (ticket.status !== "ASSIGNED") return { error: "This ticket isn't awaiting action." };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Enter a reason for cancelling this assignment." };

  const remainingAssignees = ticket.TicketAssignee.filter((a) => a.id !== myAssignment.id);
  const fullyUnassigned = remainingAssignees.length === 0 && ticket.TicketAssignedGroup.length === 0;
  const newStatus: TicketStatus = fullyUnassigned ? "NEW" : "ASSIGNED";

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketAssignee.delete({ where: { id: myAssignment.id } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { status: newStatus, updatedAt: now } }),
  ]);

  await prisma.ticketHistory.create({
    data: {
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Assignment cancelled",
      newState: reason,
    },
  });
  if (fullyUnassigned) {
    await prisma.ticketHistory.create({
      data: {
        id: randomUUID(),
        ticketId,
        actorId: session.user.id,
        action: "Status changed",
        previousState: "ASSIGNED",
        newState: "NEW",
      },
    });
  }

  if (fullyUnassigned) {
    await notifyTicketCreated(ticketId).catch((error) =>
      console.error("cancelAssignment: notifyTicketCreated failed", error)
    );
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/assigned/${ticketId}`);
  revalidatePath(`/transaction/ticket-management/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/tickets/assigned");
  revalidatePath("/transaction/ticket-management");
  return { success: true };
}

export type CloseTicketState = { error?: string; success?: boolean } | undefined;

// Ticket owner confirms a RESOLVED ticket is done: leaves a 1-5 satisfaction
// score (+ optional comment) and the ticket moves to CLOSED. Re-verifies
// ownership and status server-side — the button's visibility isn't the
// security boundary.
export async function closeTicket(
  ticketId: string,
  _prevState: CloseTicketState,
  formData: FormData
): Promise<CloseTicketState> {
  const session = await requireUser();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  if (ticket.createdById !== session.user.id) return { error: "You don't own this ticket." };
  if (ticket.status !== "RESOLVED") {
    return { error: "This ticket isn't awaiting your confirmation." };
  }

  const scoreValue = Number(formData.get("score"));
  if (!Number.isInteger(scoreValue) || scoreValue < 1 || scoreValue > 5) {
    return { error: "Choose a rating." };
  }
  const comment = formData.get("comment");
  const ratingComment = typeof comment === "string" && comment.trim() ? comment.trim() : null;

  const now = new Date();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "CLOSED",
      closedAt: now,
      updatedAt: now,
      ratingScore: scoreValue,
      rating: mapScoreToRating(scoreValue),
      ratingComment,
    },
  });

  await prisma.ticketHistory.create({
    data: {
      id: randomUUID(),
      ticketId,
      actorId: session.user.id,
      action: "Status changed",
      previousState: ticket.status,
      newState: "CLOSED",
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/assigned/${ticketId}`);
  revalidatePath(`/transaction/ticket-management/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/tickets/assigned");
  return { success: true };
}

export type RequestApprovalState = { error?: string; success?: boolean } | undefined;

// Routes a ticket to its department's supervisor for sign-off — an admin,
// or the ticket's own individual assignee (e.g. from Assigned Ticket, when
// they need a supervisor's sign-off on how they're resolving it). The
// current status is snapshotted (preApprovalStatus) so it can be restored
// once the supervisor decides — see decideTicketApproval in
// app/actions/approvals.ts.
export async function requestTicketApproval(
  ticketId: string,
  _prevState: RequestApprovalState,
  formData: FormData
): Promise<RequestApprovalState> {
  const session = await requireUser();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { Department: { select: { supervisorId: true } } },
  });
  if (!ticket) return { error: "Ticket not found." };

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin) {
    const isAssignee = await prisma.ticketAssignee.findFirst({ where: { ticketId, userId: session.user.id } });
    if (!isAssignee) return { error: "You don't have permission to request approval on this ticket." };
  }

  if (ticket.status === "CLOSED" || ticket.status === "WAITING") {
    return { error: `Can't request approval while the ticket is ${ticket.status}.` };
  }
  const supervisorId = ticket.Department.supervisorId;
  if (!supervisorId) return { error: "This ticket's department has no supervisor assigned." };

  const messageValue = formData.get("message");
  const requestMessage = typeof messageValue === "string" && messageValue.trim() ? messageValue.trim() : null;

  await prisma.$transaction([
    prisma.ticketApproval.upsert({
      where: { ticketId },
      create: {
        id: randomUUID(),
        ticketId,
        supervisorId,
        status: "PENDING",
        requestMessage,
        updatedAt: new Date(),
      },
      update: {
        supervisorId,
        status: "PENDING",
        requestMessage,
        decidedAt: null,
        comments: null,
        updatedAt: new Date(),
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "WAITING", preApprovalStatus: ticket.status, updatedAt: new Date() },
    }),
    prisma.ticketHistory.create({
      data: {
        id: randomUUID(),
        ticketId,
        actorId: session.user.id,
        action: "Status changed",
        previousState: ticket.status,
        newState: "WAITING",
      },
    }),
  ]);

  revalidatePath("/transaction/ticket-management");
  revalidatePath(`/transaction/ticket-management/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets/approval");
  revalidatePath(`/tickets/approval/${ticketId}`);

  await notifyApprovalRequested(ticketId, supervisorId).catch((error) =>
    console.error("requestTicketApproval: notifyApprovalRequested failed", error)
  );

  return { success: true };
}
