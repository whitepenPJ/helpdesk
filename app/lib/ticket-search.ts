import "server-only";
import { prisma } from "@/app/lib/db";
import { formatAssignment } from "@/app/lib/ticket-format";
import { Prisma, type Priority, type TicketStatus } from "@/app/generated/prisma/client";
import { Role } from "@/app/generated/prisma/enums";

export type SearchProgram = "Ticket" | "Assign Ticket" | "Approval Ticket" | "Ticket Management";

export type TicketSearchResult = {
  program: SearchProgram;
  href: string;
  id: string;
  ticketNumber: string;
  title: string;
  categoryName: string;
  companyName: string;
  departmentName: string;
  priority: Priority;
  status: TicketStatus;
  transactionDate: Date;
  assignee: string;
};

// Caps how many rows a single program's query can contribute — this merges
// results in memory (see searchTickets below) rather than a SQL UNION, so an
// unbounded match on a broad query could otherwise pull the whole table.
const RESULT_CAP = 200;

const ticketInclude = {
  Category: true,
  Company: true,
  Department: true,
  TicketAssignee: { select: { User: { select: { name: true } } } },
  TicketAssignedGroup: { select: { UserGroup: { select: { name: true } } } },
} satisfies Prisma.TicketInclude;

type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

function toResult(ticket: TicketRow, program: SearchProgram, href: string): TicketSearchResult {
  return {
    program,
    href,
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    categoryName: ticket.Category.name,
    companyName: ticket.Company.name,
    departmentName: ticket.Department.name,
    priority: ticket.priority,
    status: ticket.status,
    transactionDate: ticket.transactionDate,
    assignee: formatAssignment(
      ticket.TicketAssignee.map((a) => a.User.name),
      ticket.TicketAssignedGroup.map((g) => g.UserGroup.name)
    ),
  };
}

// Matches the navbar search's advertised fields: Title, Ticket No, User
// (the ticket's creator), Department, Company name.
function matchWhere(query: string): Prisma.TicketWhereInput {
  return {
    deletedAt: null,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { ticketNumber: { contains: query, mode: "insensitive" } },
      {
        User_Ticket_createdByIdToUser: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      { Department: { name: { contains: query, mode: "insensitive" } } },
      { Company: { name: { contains: query, mode: "insensitive" } } },
    ],
  };
}

// Which "programs" (existing ticket list pages) a role's search results can
// include — same role split as buildSidebarNav in sidebar-nav-data.ts:
// Users get Ticket + Assign Ticket, Supervisors add Approval Ticket, Admins
// get all four (including the admin-only Ticket Management list).
function programsForRole(role: Role): SearchProgram[] {
  if (role === Role.ADMIN) return ["Ticket", "Assign Ticket", "Ticket Management", "Approval Ticket"];
  if (role === Role.SUPERVISOR) return ["Ticket", "Assign Ticket", "Approval Ticket"];
  return ["Ticket", "Assign Ticket"];
}

// Aggregates matches the way each program's own list page would scope them,
// tagging every hit with which program (page) it came from — the same
// ticket can legitimately show up more than once (e.g. an admin's own
// assignment is both a "Ticket Management" and an "Assign Ticket" hit).
export async function searchTickets(userId: string, role: Role, query: string): Promise<TicketSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isAdmin = role === Role.ADMIN;
  const programs = programsForRole(role);
  const match = matchWhere(trimmed);

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { userGroupId: true } });

  const queries: Promise<TicketSearchResult[]>[] = [];

  if (programs.includes("Ticket")) {
    queries.push(
      prisma.ticket
        .findMany({
          where: { AND: [match, isAdmin ? {} : { createdById: userId }] },
          include: ticketInclude,
          take: RESULT_CAP,
        })
        .then((rows) => rows.map((t) => toResult(t, "Ticket", `/tickets/${t.id}`)))
    );
  }

  if (programs.includes("Assign Ticket")) {
    queries.push(
      prisma.ticket
        .findMany({
          where: {
            AND: [
              match,
              {
                OR: [
                  ...(me?.userGroupId ? [{ TicketAssignedGroup: { some: { userGroupId: me.userGroupId } } }] : []),
                  { TicketAssignee: { some: { userId } } },
                ],
              },
            ],
          },
          include: ticketInclude,
          take: RESULT_CAP,
        })
        .then((rows) => rows.map((t) => toResult(t, "Assign Ticket", `/tickets/assigned/${t.id}`)))
    );
  }

  if (programs.includes("Approval Ticket")) {
    queries.push(
      prisma.ticket
        .findMany({
          where: {
            AND: [
              match,
              { TicketApproval: { status: "PENDING" } },
              ...(isAdmin ? [] : [{ Department: { DepartmentApprover: { some: { userId } } } }]),
            ],
          },
          include: ticketInclude,
          take: RESULT_CAP,
        })
        .then((rows) => rows.map((t) => toResult(t, "Approval Ticket", `/tickets/approval/${t.id}`)))
    );
  }

  if (programs.includes("Ticket Management")) {
    queries.push(
      prisma.ticket
        .findMany({
          where: match,
          include: ticketInclude,
          take: RESULT_CAP,
        })
        .then((rows) => rows.map((t) => toResult(t, "Ticket Management", `/transaction/ticket-management/${t.id}`)))
    );
  }

  const results = await Promise.all(queries);
  return results.flat().sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
}
