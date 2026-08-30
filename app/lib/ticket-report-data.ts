import "server-only";
import { prisma } from "@/app/lib/db";
import { Prisma, type TicketStatus, type Priority } from "@/app/generated/prisma/client";
import { formatAssignment } from "@/app/lib/ticket-format";
import { stripHtml } from "@/app/lib/text";
import { RATING_SCALE } from "@/app/lib/rating";

export type TicketReportRow = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  categoryName: string;
  companyName: string;
  departmentName: string;
  requesterName: string;
  requesterEmail: string;
  assignment: string;
  telephone: string | null;
  transactionDate: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  ratingScore: number | null;
  ratingComment: string | null;
  problem: string | null;
  solution: string | null;
};

export type MonthlySatisfaction = { month: string; avgRating: number | null; count: number };
export type CategorySatisfaction = { categoryName: string; avgRating: number | null; count: number };
export type RatingDistributionRow = { score: number; label: string; count: number; percent: number };

export type TicketReportData = {
  tickets: TicketReportRow[];
  monthly: MonthlySatisfaction[];
  byCategory: CategorySatisfaction[];
  ratingDistribution: RatingDistributionRow[];
  totalRated: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getTicketReportData(dateFrom: Date | null, dateTo: Date | null): Promise<TicketReportData> {
  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(dateFrom || dateTo
      ? {
          transactionDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const raw = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      telephone: true,
      transactionDate: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      ratingScore: true,
      ratingComment: true,
      problem: true,
      solution: true,
      Category: { select: { name: true } },
      Company: { select: { name: true } },
      Department: { select: { name: true } },
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
      TicketAssignee: { select: { User: { select: { name: true } } } },
      TicketAssignedGroup: { select: { UserGroup: { select: { name: true } } } },
    },
    orderBy: { transactionDate: "desc" },
  });

  const tickets: TicketReportRow[] = raw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    description: stripHtml(t.description),
    status: t.status,
    priority: t.priority,
    categoryName: t.Category.name,
    companyName: t.Company.name,
    departmentName: t.Department.name,
    requesterName: t.User_Ticket_createdByIdToUser.name,
    requesterEmail: t.User_Ticket_createdByIdToUser.email,
    assignment: formatAssignment(
      t.TicketAssignee.map((a) => a.User.name),
      t.TicketAssignedGroup.map((g) => g.UserGroup.name)
    ),
    telephone: t.telephone,
    transactionDate: t.transactionDate,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    ratingScore: t.ratingScore,
    ratingComment: t.ratingComment,
    problem: t.problem ? stripHtml(t.problem) : null,
    solution: t.solution ? stripHtml(t.solution) : null,
  }));

  const rated = tickets.filter((t) => t.ratingScore !== null);
  const totalRated = rated.length;

  // Grouped by the month the rating was actually given (closedAt), not the
  // ticket's transaction date — a ticket opened in one month can easily be
  // rated the next.
  const monthlyAcc = new Map<string, { sum: number; count: number }>();
  for (const t of rated) {
    const key = monthKey(t.closedAt ?? t.transactionDate);
    const entry = monthlyAcc.get(key) ?? { sum: 0, count: 0 };
    entry.sum += t.ratingScore as number;
    entry.count += 1;
    monthlyAcc.set(key, entry);
  }
  const monthly: MonthlySatisfaction[] = Array.from(monthlyAcc.entries())
    .map(([month, e]) => ({ month, avgRating: e.count ? e.sum / e.count : null, count: e.count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const categoryAcc = new Map<string, { sum: number; count: number }>();
  for (const t of rated) {
    const entry = categoryAcc.get(t.categoryName) ?? { sum: 0, count: 0 };
    entry.sum += t.ratingScore as number;
    entry.count += 1;
    categoryAcc.set(t.categoryName, entry);
  }
  const byCategory: CategorySatisfaction[] = Array.from(categoryAcc.entries())
    .map(([categoryName, e]) => ({ categoryName, avgRating: e.count ? e.sum / e.count : null, count: e.count }))
    .sort((a, b) => b.count - a.count);

  const ratingDistribution: RatingDistributionRow[] = RATING_SCALE.map(({ score, label }) => {
    const count = rated.filter((t) => t.ratingScore === score).length;
    return { score, label, count, percent: totalRated ? (count / totalRated) * 100 : 0 };
  });

  return { tickets, monthly, byCategory, ratingDistribution, totalRated };
}
