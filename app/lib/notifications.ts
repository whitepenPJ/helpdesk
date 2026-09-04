import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { sendEmail } from "@/app/lib/email";
import { renderNewTicketEmail, renderTicketNotificationEmail, type TicketPriority } from "@/app/lib/email-templates";
import { sendPushToUser } from "@/app/lib/push";
import { sendTeamsNotification } from "@/app/lib/msteams";
import { formatDateTime } from "@/app/lib/date-format";
import { PUSH_NOTIFICATIONS_ENABLED, TEAMS_NOTIFICATIONS_ENABLED } from "@/app/lib/feature-flags";

type Recipient = { id: string; email: string };

async function resolveBaseUrl(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

type EmailPayload = { subject: string; html: string; text: string };

// Low-level primitive behind every event below: writes the bell/
// notifications-page row (see the read side further down) synchronously —
// so it's reflected the instant the mutation's response comes back — then
// defers the real browser push + optional email via `after()` so their
// network I/O (Mailgun's HTTP API in particular) never adds to the Server
// Action's own response time. Each failure is logged rather than thrown, so
// one bad recipient/channel never blocks the rest of a fan-out. `message`/
// `href` are frozen into the Notification row at write time (not re-derived
// when read), which is exactly why this table exists instead of reusing
// TicketHistory — see the model's doc comment in prisma/schema.prisma.
async function notify({
  userId,
  ticketId,
  message,
  href,
  email,
}: {
  userId: string;
  ticketId: string;
  message: string;
  href: string;
  email?: { to: string; payload: EmailPayload };
}): Promise<void> {
  await prisma.notification.create({ data: { id: randomUUID(), userId, ticketId, message, href } });
  after(() =>
    Promise.all([
      email
        ? sendEmail({ to: email.to, ...email.payload }).catch((error) =>
            console.error(`notify: email to ${email.to} failed`, error)
          )
        : Promise.resolve(),
      PUSH_NOTIFICATIONS_ENABLED
        ? sendPushToUser(userId, { title: "Helpdesk", body: message, url: href }).catch((error) =>
            console.error(`notify: push to user ${userId} failed`, error)
          )
        : Promise.resolve(),
    ])
  );
}

// Resolves a set of assignee/group ids (as known at the moment of
// assignment — see notifyTicketAssigned) into deduped recipients.
async function resolveAssigneeRecipients(assigneeIds: string[], assignedGroupIds: string[]): Promise<Recipient[]> {
  const [assignees, groupMembers] = await Promise.all([
    assigneeIds.length
      ? prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, email: true } })
      : Promise.resolve([]),
    assignedGroupIds.length
      ? prisma.user.findMany({
          where: { userGroupId: { in: assignedGroupIds }, status: "ACTIVE" },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
  ]);
  const recipients = new Map<string, Recipient>();
  for (const assignee of assignees) recipients.set(assignee.id, assignee);
  for (const member of groupMembers) recipients.set(member.id, member);
  return Array.from(recipients.values());
}

// Same as above, but looks up a ticket's *current* assignment rather than
// taking freshly-known ids — used by events that fire well after the
// assignment happened (reject/approve/close/comment).
async function getTicketAssigneeRecipients(ticketId: string): Promise<Recipient[]> {
  const [assignees, groups] = await Promise.all([
    prisma.ticketAssignee.findMany({ where: { ticketId }, select: { userId: true } }),
    prisma.ticketAssignedGroup.findMany({ where: { ticketId }, select: { userGroupId: true } }),
  ]);
  return resolveAssigneeRecipients(
    assignees.map((a) => a.userId),
    groups.map((g) => g.userGroupId)
  );
}

// Scoped to the admins assigned to a Category (via CategoryAdmin, set on
// the category's Master page) rather than every admin, so category-related
// triage notifications only reach the people who actually own that
// category. Falls back to every active admin when a category has no
// CategoryAdmin rows yet, so a not-yet-configured category doesn't
// silently notify nobody.
async function getCategoryAdminRecipients(categoryId: string, excludeUserId?: string): Promise<Recipient[]> {
  const excludeClause = excludeUserId ? { id: { not: excludeUserId } } : {};

  const categoryAdmins = await prisma.user.findMany({
    where: { role: Role.ADMIN, status: "ACTIVE", ...excludeClause, CategoryAdmin: { some: { categoryId } } },
    select: { id: true, email: true },
  });
  if (categoryAdmins.length > 0) return categoryAdmins;

  return prisma.user.findMany({
    where: { role: Role.ADMIN, status: "ACTIVE", ...excludeClause },
    select: { id: true, email: true },
  });
}

type TicketSummary = {
  ticketNumber: string;
  title: string;
  priority: TicketPriority;
  categoryName: string;
  departmentName: string;
};

// Shared shape for the branded email built by every event below —
// everything renderTicketNotificationEmail needs besides the
// event-specific subject/heading/intro/CTA.
async function buildTicketEmail(
  ticket: TicketSummary,
  opts: { subject: string; heading: string; intro: string; ctaLabel: string; ctaUrl: string; baseUrl: string }
): Promise<EmailPayload> {
  return renderTicketNotificationEmail({
    subject: opts.subject,
    heading: opts.heading,
    intro: opts.intro,
    ticket,
    ctaLabel: opts.ctaLabel,
    ctaUrl: opts.ctaUrl,
    preferencesUrl: `${opts.baseUrl}/notifications`,
    logoUrl: `${opts.baseUrl}/help-desk.png`,
  });
}

// --- 1/2. Ticket created + assigned (EM01, EM02) ---------------------------

type AssignmentTarget = { assigneeIds?: string[]; assignedGroupIds?: string[] };

// EM01 — notifies every current assignee (individual + group members,
// deduped) that a ticket needs their attention. Used both when a ticket is
// auto-assigned on creation and when an admin manually assigns one.
export async function notifyTicketAssigned(ticketId: string, target: AssignmentTarget): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      priority: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
    },
  });
  if (!ticket) return;

  const recipients = await resolveAssigneeRecipients(target.assigneeIds ?? [], target.assignedGroupIds ?? []);
  if (recipients.length === 0) return;

  const baseUrl = await resolveBaseUrl();
  const href = `${baseUrl}/tickets/${ticketId}`;
  const message = `${ticket.ticketNumber} ticket assigned to you`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };
  const emailPayload = await buildTicketEmail(summary, {
    subject: `[Helpdesk] - You have new ticket no ${ticket.ticketNumber} to verify`,
    heading: "New ticket assigned to you",
    intro: "A ticket has been assigned to you — take a look.",
    ctaLabel: "View ticket",
    ctaUrl: href,
    baseUrl,
  });

  await Promise.all(
    recipients.map((user) =>
      notify({ userId: user.id, ticketId, message, href, email: { to: user.email, payload: emailPayload } })
    )
  );
  // One channel post for the whole assignment (not per-recipient — a Teams
  // webhook targets a shared channel, unlike email/push). Deferred like the
  // email/push above so this outbound HTTP call never adds to the caller's
  // response time.
  if (TEAMS_NOTIFICATIONS_ENABLED) {
    after(() =>
      sendTeamsNotification(`${emailPayload.subject}: ${message}`).catch((error) =>
        console.error("notifyTicketAssigned: Teams notification failed", error)
      )
    );
  }
}

// Bell + push only (no email) to the ticket's owner when an admin manually
// (re)assigns their ticket — distinct from notifyTicketAssigned above,
// which is also used at creation time when the owner doesn't need telling
// (they just filed it themselves).
export async function notifyOwnerTicketAssigned(ticketId: string, ownerId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { ticketNumber: true } });
  if (!ticket) return;

  const baseUrl = await resolveBaseUrl();
  await notify({
    userId: ownerId,
    ticketId,
    message: `${ticket.ticketNumber} is assigned`,
    href: `${baseUrl}/tickets/${ticketId}`,
  });
}

// EM02 — notifies the admins responsible for triaging a new ticket. Fires
// unconditionally on creation (regardless of whether it was auto-assigned)
// — auto-assigned tickets additionally get notifyTicketAssigned above.
export async function notifyTicketCreated(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      description: true,
      priority: true,
      createdById: true,
      createdAt: true,
      categoryId: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
    },
  });
  if (!ticket) return;

  const admins = await getCategoryAdminRecipients(ticket.categoryId, ticket.createdById);
  if (admins.length === 0) return;

  const baseUrl = await resolveBaseUrl();
  const href = `${baseUrl}/transaction/ticket-management/${ticketId}?edit=1`;
  const message = `${ticket.ticketNumber} is created`;

  const emailPayload = renderNewTicketEmail({
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
    requesterName: ticket.User_Ticket_createdByIdToUser.name,
    requesterEmail: ticket.User_Ticket_createdByIdToUser.email,
    submittedAt: formatDateTime(ticket.createdAt),
    url: href,
    preferencesUrl: `${baseUrl}/notifications`,
    logoUrl: `${baseUrl}/help-desk.png`,
  });

  await Promise.all(
    admins.map((admin) =>
      notify({ userId: admin.id, ticketId, message, href, email: { to: admin.email, payload: emailPayload } })
    )
  );
}

// --- 3. Approval requested (EM03) ------------------------------------------

// A department can have several approvers now — the request goes out to all
// of them; whoever decides first is the one recorded on the TicketApproval.
export async function notifyApprovalRequested(ticketId: string, approverIds: string[]): Promise<void> {
  if (approverIds.length === 0) return;

  const [ticket, approvers] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        title: true,
        priority: true,
        Category: { select: { name: true } },
        Department: { select: { name: true } },
      },
    }),
    prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, email: true } }),
  ]);
  if (!ticket || approvers.length === 0) return;

  const baseUrl = await resolveBaseUrl();
  const href = `${baseUrl}/tickets/approval`;
  const message = `${ticket.ticketNumber} ticket requires approval`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };
  const emailPayload = await buildTicketEmail(summary, {
    subject: `[Helpdesk] - Ticket ${ticket.ticketNumber} requires your approval`,
    heading: "Approval requested",
    intro: "A ticket is waiting on your approval decision.",
    ctaLabel: "Review approval",
    ctaUrl: href,
    baseUrl,
  });

  await Promise.all(
    approvers.map((approver) =>
      notify({ userId: approver.id, ticketId, message, href, email: { to: approver.email, payload: emailPayload } })
    )
  );
}

// --- 4/5. Approval decided (EM04, EM05) -------------------------------------

async function notifyApprovalDecision(
  ticketId: string,
  supervisorName: string,
  decision: "REJECTED" | "APPROVED",
  reason: string | null
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      priority: true,
      categoryId: true,
      createdById: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
    },
  });
  if (!ticket) return;

  const isRejected = decision === "REJECTED";
  const [admins, assignees] = await Promise.all([
    getCategoryAdminRecipients(ticket.categoryId),
    getTicketAssigneeRecipients(ticketId),
  ]);

  const baseUrl = await resolveBaseUrl();
  const message = isRejected ? `${ticket.ticketNumber} ticket is rejected` : `${ticket.ticketNumber} ticket is approved`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };
  const decisionLine = isRejected
    ? `Rejected by ${supervisorName} (Approver)${reason ? `: ${reason}` : ""}.`
    : `Approved by ${supervisorName} (Approver).`;

  const managementHref = `${baseUrl}/transaction/ticket-management/${ticketId}`;
  const assignedHref = `${baseUrl}/tickets/assigned/${ticketId}`;
  const ownerHref = `${baseUrl}/tickets/${ticketId}`;

  async function emailFor(ctaUrl: string): Promise<EmailPayload> {
    return buildTicketEmail(summary, {
      subject: isRejected
        ? `[Helpdesk] - Ticket ${summary.ticketNumber} was rejected`
        : `[Helpdesk] - Ticket ${summary.ticketNumber} was approved`,
      heading: isRejected ? "Ticket rejected" : "Ticket approved",
      intro: decisionLine,
      ctaLabel: "View ticket",
      ctaUrl,
      baseUrl,
    });
  }

  const sends: Promise<void>[] = [];

  for (const admin of admins) {
    sends.push(
      emailFor(managementHref).then((payload) =>
        notify({ userId: admin.id, ticketId, message, href: managementHref, email: { to: admin.email, payload } })
      )
    );
  }
  for (const assignee of assignees) {
    sends.push(
      emailFor(assignedHref).then((payload) =>
        notify({ userId: assignee.id, ticketId, message, href: assignedHref, email: { to: assignee.email, payload } })
      )
    );
  }
  // Rejection also tells the ticket's owner — approval doesn't (they'll see
  // the "Approved by ... at ..." banner next time they open the ticket).
  if (isRejected) {
    const owner = await prisma.user.findUnique({ where: { id: ticket.createdById }, select: { id: true, email: true } });
    if (owner) {
      sends.push(
        emailFor(ownerHref).then((payload) =>
          notify({ userId: owner.id, ticketId, message, href: ownerHref, email: { to: owner.email, payload } })
        )
      );
    }
  }

  await Promise.all(sends);
}

export async function notifyTicketRejected(ticketId: string, supervisorName: string, reason: string | null): Promise<void> {
  await notifyApprovalDecision(ticketId, supervisorName, "REJECTED", reason);
}

export async function notifyTicketApproved(ticketId: string, supervisorName: string): Promise<void> {
  await notifyApprovalDecision(ticketId, supervisorName, "APPROVED", null);
}

// --- 6. Resolved (EM06) -----------------------------------------------------

// Notifies the ticket's owner once the assignee marks it Resolved, prompting
// them to review and close it.
export async function notifyTicketResolved(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      priority: true,
      createdById: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
      User_Ticket_createdByIdToUser: { select: { id: true, email: true } },
    },
  });
  if (!ticket) return;

  const baseUrl = await resolveBaseUrl();
  const href = `${baseUrl}/tickets/${ticketId}`;
  const message = `${ticket.ticketNumber} is resolved, please confirm`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };
  const emailPayload = await buildTicketEmail(summary, {
    subject: `[Helpdesk] - Ticket ${ticket.ticketNumber} is resolved, please confirm`,
    heading: "Ticket resolved",
    intro: "Please review and confirm to close it.",
    ctaLabel: "Review & confirm",
    ctaUrl: href,
    baseUrl,
  });

  await notify({
    userId: ticket.createdById,
    ticketId,
    message,
    href,
    email: { to: ticket.User_Ticket_createdByIdToUser.email, payload: emailPayload },
  });
}

// --- 7/8. Comments (EM07, EM08) --------------------------------------------

// Notifies "the other party" on a new comment: if the assignee commented,
// the owner hears about it (EM07); if the owner commented, every current
// assignee hears about it (EM08). No notification fires for a comment from
// anyone else (e.g. an admin or the reviewing supervisor just observing) —
// the spec only defines these two directions.
export async function notifyCommentAdded(ticketId: string, authorId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      priority: true,
      createdById: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
      User_Ticket_createdByIdToUser: { select: { id: true, email: true, name: true } },
    },
  });
  if (!ticket) return;

  const isOwner = ticket.createdById === authorId;
  const assignees = await getTicketAssigneeRecipients(ticketId);
  const isAssignee = assignees.some((a) => a.id === authorId);
  if (!isOwner && !isAssignee) return;

  const baseUrl = await resolveBaseUrl();
  const message = `${ticket.ticketNumber} has a new comment`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };

  async function emailFor(ctaUrl: string): Promise<EmailPayload> {
    return buildTicketEmail(summary, {
      subject: `[Helpdesk] - New comment on ticket ${summary.ticketNumber}`,
      heading: "New comment",
      intro: "There's a new comment on this ticket.",
      ctaLabel: "View comment",
      ctaUrl,
      baseUrl,
    });
  }

  if (isAssignee) {
    // EM07 — assignee commented, notify the owner.
    const href = `${baseUrl}/tickets/${ticketId}`;
    const payload = await emailFor(href);
    await notify({
      userId: ticket.createdById,
      ticketId,
      message,
      href,
      email: { to: ticket.User_Ticket_createdByIdToUser.email, payload },
    });
    return;
  }

  // EM08 — owner commented, notify every current assignee.
  const href = `${baseUrl}/tickets/assigned/${ticketId}`;
  const payload = await emailFor(href);
  await Promise.all(
    assignees.map((assignee) =>
      notify({ userId: assignee.id, ticketId, message, href, email: { to: assignee.email, payload } })
    )
  );
}

// --- 9. Closed (EM09) -------------------------------------------------------

// Notifies the category's admins and every current assignee once the owner
// confirms and closes a resolved ticket.
export async function notifyTicketClosed(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      title: true,
      priority: true,
      categoryId: true,
      Category: { select: { name: true } },
      Department: { select: { name: true } },
    },
  });
  if (!ticket) return;

  const [admins, assignees] = await Promise.all([
    getCategoryAdminRecipients(ticket.categoryId),
    getTicketAssigneeRecipients(ticketId),
  ]);
  if (admins.length === 0 && assignees.length === 0) return;

  const baseUrl = await resolveBaseUrl();
  const message = `${ticket.ticketNumber} ticket is closed`;
  const summary: TicketSummary = {
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
  };

  async function emailFor(ctaUrl: string): Promise<EmailPayload> {
    return buildTicketEmail(summary, {
      subject: `[Helpdesk] - Ticket ${summary.ticketNumber} is closed`,
      heading: "Ticket closed",
      intro: "The requester confirmed and closed this ticket.",
      ctaLabel: "View ticket",
      ctaUrl,
      baseUrl,
    });
  }

  const managementHref = `${baseUrl}/transaction/ticket-management/${ticketId}`;
  const assignedHref = `${baseUrl}/tickets/assigned/${ticketId}`;

  await Promise.all([
    ...admins.map((admin) =>
      emailFor(managementHref).then((payload) =>
        notify({ userId: admin.id, ticketId, message, href: managementHref, email: { to: admin.email, payload } })
      )
    ),
    ...assignees.map((assignee) =>
      emailFor(assignedHref).then((payload) =>
        notify({ userId: assignee.id, ticketId, message, href: assignedHref, email: { to: assignee.email, payload } })
      )
    ),
  ]);
}

// --- Read side: header bell + /notifications page --------------------------

export type TicketActivityItem = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  message: string;
  href: string;
  timestamp: Date;
};

export type TicketActivitySummary = {
  items: TicketActivityItem[];
  unreadCount: number;
};

function toActivityItem(entry: {
  id: string;
  ticketId: string;
  Ticket: { ticketNumber: string };
  message: string;
  href: string;
  createdAt: Date;
}): TicketActivityItem {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    ticketNumber: entry.Ticket.ticketNumber,
    message: entry.message,
    href: entry.href,
    timestamp: entry.createdAt,
  };
}

const RECENT_ACTIVITY_LIMIT = 8;

// Feeds the header notification bell — the last few items plus an unread
// count. "Unread" is everything newer than User.notificationsSeenAt (bumped
// by markNotificationsSeen when the bell is opened) — the list itself always
// shows the recent items regardless of read state, only the badge count
// reacts to it. Unlike the old TicketHistory-derived feed, every row here
// was purpose-written for this exact user by one of the notify* functions
// above — no role-based filtering needed at read time.
export async function getRecentTicketActivity(userId: string): Promise<TicketActivitySummary> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } });

  const [entries, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: { Ticket: { select: { ticketNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    }),
    prisma.notification.count({ where: { userId, createdAt: { gt: user?.notificationsSeenAt ?? new Date(0) } } }),
  ]);

  return { items: entries.map(toActivityItem), unreadCount };
}

export type TicketActivityPage = {
  items: TicketActivityItem[];
  total: number;
};

// Feeds the full "See All Notifications" page — same feed as the bell, no
// 8-item cap, with pagination instead.
export async function getTicketActivityPage(
  userId: string,
  { skip, take }: { skip: number; take: number }
): Promise<TicketActivityPage> {
  const [entries, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: { Ticket: { select: { ticketNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { items: entries.map(toActivityItem), total };
}

// Cheap poll target for the header's near-real-time alert (see
// notification-poller.tsx) — just the count, not the hydrated items.
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } });
  return prisma.notification.count({ where: { userId, createdAt: { gt: user?.notificationsSeenAt ?? new Date(0) } } });
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { notificationsSeenAt: new Date() } });
}
