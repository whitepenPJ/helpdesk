import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/app/lib/db";
import { sendEmail } from "@/app/lib/email";
import { renderNewTicketEmail } from "@/app/lib/email-templates";
import { sendPushToUser } from "@/app/lib/push";
import { sendTeamsNotification } from "@/app/lib/msteams";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma, Role } from "@/app/generated/prisma/client";

type AssignmentTarget = {
  assigneeId?: string | null;
  assignedGroupId?: string | null;
};

// Notifies the assignee and/or every active member of the assigned group
// (deduped, in case someone is both) that a ticket needs their attention —
// by email and by browser push, in parallel, each failure logged rather
// than thrown so one bad recipient/channel doesn't block the rest.
export async function notifyTicketAssigned(ticketId: string, target: AssignmentTarget): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { ticketNumber: true, title: true, priority: true },
  });
  if (!ticket) return;

  const [assignee, groupMembers] = await Promise.all([
    target.assigneeId
      ? prisma.user.findUnique({ where: { id: target.assigneeId }, select: { id: true, email: true } })
      : null,
    target.assignedGroupId
      ? prisma.user.findMany({
          where: { userGroupId: target.assignedGroupId, status: "ACTIVE" },
          select: { id: true, email: true },
        })
      : [],
  ]);

  const recipients = new Map<string, { id: string; email: string }>();
  if (assignee) recipients.set(assignee.id, assignee);
  for (const member of groupMembers) recipients.set(member.id, member);
  if (recipients.size === 0) return;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const url = `${host ? `${proto}://${host}` : ""}/tickets/${ticketId}`;

  const subject = `Ticket ${ticket.ticketNumber} assigned to you`;
  const pushBody = `"${ticket.title}" — ${ticket.priority} priority`;
  const emailBody = `"${ticket.title}" (${ticket.priority} priority) has been assigned to you. Review it: ${url}`;

  await Promise.all([
    ...Array.from(recipients.values()).flatMap((user) => [
      sendEmail({ to: user.email, subject, text: emailBody }).catch((error) =>
        console.error(`notifyTicketAssigned: email to ${user.email} failed`, error)
      ),
      sendPushToUser(user.id, { title: subject, body: pushBody, url }).catch((error) =>
        console.error(`notifyTicketAssigned: push to user ${user.id} failed`, error)
      ),
    ]),
    // One channel post for the whole assignment (not per-recipient — a Teams
    // webhook targets a shared channel, unlike email/push).
    sendTeamsNotification(`${subject}: ${emailBody}`).catch((error) =>
      console.error("notifyTicketAssigned: Teams notification failed", error)
    ),
  ]);
}

// Notifies every active admin (other than the ticket's own creator, if the
// creator happens to be an admin) that a new ticket needs triage — by email
// and browser push, same fire-and-log-per-channel pattern as
// notifyTicketAssigned above.
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
      Category: { select: { name: true } },
      Department: { select: { name: true } },
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
    },
  });
  if (!ticket) return;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", id: { not: ticket.createdById } },
    select: { id: true, email: true },
  });
  if (admins.length === 0) return;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  const url = `${baseUrl}/tickets/${ticketId}`;

  const { subject, html, text } = renderNewTicketEmail({
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    categoryName: ticket.Category.name,
    departmentName: ticket.Department.name,
    requesterName: ticket.User_Ticket_createdByIdToUser.name,
    requesterEmail: ticket.User_Ticket_createdByIdToUser.email,
    submittedAt: formatDateTime(ticket.createdAt),
    url,
    preferencesUrl: `${baseUrl}/notifications`,
  });
  const pushBody = `"${ticket.title}" — ${ticket.priority} priority`;

  await Promise.all(
    admins.flatMap((admin) => [
      sendEmail({ to: admin.email, subject, text, html }).catch((error) =>
        console.error(`notifyTicketCreated: email to ${admin.email} failed`, error)
      ),
      sendPushToUser(admin.id, { title: subject, body: pushBody, url }).catch((error) =>
        console.error(`notifyTicketCreated: push to admin ${admin.id} failed`, error)
      ),
    ])
  );
}

export type TicketActivityItem = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  timestamp: Date;
};

export type TicketActivitySummary = {
  items: TicketActivityItem[];
  unreadCount: number;
};

const RECENT_ACTIVITY_LIMIT = 8;

// Shared by the header's recent-activity feed and the full notifications
// page: events on tickets the user created, or that are assigned to them or
// their group — excluding events they triggered themselves, since you don't
// need to be notified of your own actions. There's no dedicated Notification
// table in the live schema, so this is derived off TicketHistory rather than
// a true notification inbox. Admins see activity across every ticket, not
// just their own — they're the ones expected to triage new tickets from
// anyone.
async function buildActivityWhere(userId: string, role: Role): Promise<Prisma.TicketHistoryWhereInput> {
  if (role === "ADMIN") {
    return { actorId: { not: userId } };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { userGroupId: true } });
  return {
    actorId: { not: userId },
    Ticket: {
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        ...(user?.userGroupId ? [{ assignedGroupId: user.userGroupId }] : []),
      ],
    },
  };
}

function toActivityItem(entry: {
  id: string;
  ticketId: string;
  Ticket: { ticketNumber: string };
  action: string;
  previousState: string | null;
  newState: string | null;
  timestamp: Date;
}): TicketActivityItem {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    ticketNumber: entry.Ticket.ticketNumber,
    action: entry.action,
    previousState: entry.previousState,
    newState: entry.newState,
    timestamp: entry.timestamp,
  };
}

// Feeds the header notification bell — the last few items plus an unread
// count. "Unread" is everything newer than User.notificationsSeenAt (bumped
// by markNotificationsSeen when the bell is opened) — the list itself always
// shows the recent items regardless of read state, only the badge count
// reacts to it.
export async function getRecentTicketActivity(userId: string, role: Role): Promise<TicketActivitySummary> {
  const [where, user] = await Promise.all([
    buildActivityWhere(userId, role),
    prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } }),
  ]);

  const [entries, unreadCount] = await Promise.all([
    prisma.ticketHistory.findMany({
      where,
      include: { Ticket: { select: { ticketNumber: true } } },
      orderBy: { timestamp: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    }),
    prisma.ticketHistory.count({
      where: { ...where, timestamp: { gt: user?.notificationsSeenAt ?? new Date(0) } },
    }),
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
  role: Role,
  { skip, take }: { skip: number; take: number }
): Promise<TicketActivityPage> {
  const where = await buildActivityWhere(userId, role);

  const [entries, total] = await Promise.all([
    prisma.ticketHistory.findMany({
      where,
      include: { Ticket: { select: { ticketNumber: true } } },
      orderBy: { timestamp: "desc" },
      skip,
      take,
    }),
    prisma.ticketHistory.count({ where }),
  ]);

  return { items: entries.map(toActivityItem), total };
}

// Cheap poll target for the header's near-real-time alert (see
// notification-poller.tsx) — just the count, not the hydrated items.
export async function getUnreadNotificationCount(userId: string, role: Role): Promise<number> {
  const [where, user] = await Promise.all([
    buildActivityWhere(userId, role),
    prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } }),
  ]);

  return prisma.ticketHistory.count({
    where: { ...where, timestamp: { gt: user?.notificationsSeenAt ?? new Date(0) } },
  });
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { notificationsSeenAt: new Date() } });
}
