// One-off data-generation script — NOT wired into `prisma db seed` (that's
// seed.ts, which only upserts the four demo accounts). Run manually with
// `npx tsx prisma/seed-test-tickets.ts` to backfill sample tickets across
// Jan 2026 → now so the report pages have something to chart. Additive only
// (no deletes) — safe to re-run, just adds another batch.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Priority, type Rating, type TicketStatus } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TICKET_COUNT = 300;
const RANGE_START = new Date("2026-01-01T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_WEIGHTS: [TicketStatus, number][] = [
  ["NEW", 15],
  ["ASSIGNED", 25],
  ["RESOLVED", 18],
  ["REOPENED", 8],
  ["CLOSED", 30],
  ["WAITING", 4],
];

const PRIORITY_WEIGHTS: [Priority, number][] = [
  ["LOW", 30],
  ["MEDIUM", 40],
  ["HIGH", 20],
  ["URGENT", 10],
];

const TITLE_TEMPLATES = [
  "Cannot connect to VPN",
  "Laptop won't power on",
  "Email account locked out",
  "Printer offline on {floor}",
  "Password reset request",
  "Slow network connection in {dept}",
  "Software installation request: {app}",
  "Monitor flickering",
  "Access request for shared drive",
  "Wi-Fi keeps disconnecting",
  "Outlook not syncing",
  "New employee equipment setup",
  "Blue screen error on startup",
  "Unable to access {app}",
  "Keyboard not responding",
  "Request for additional monitor",
  "Phone system not working",
  "Mailbox storage full",
  "License renewal for {app}",
  "Two-factor authentication issue",
  "File server permission error",
  "Webcam not detected in meetings",
  "Backup failure alert",
  "Suspicious email reported",
  "Meeting room display not working",
];

function mapScoreToRating(score: number): Rating {
  if (score <= 2) return "NEEDS_IMPROVEMENT";
  if (score === 3) return "FAIRLY_SATISFIED";
  return "FULLY_SATISFIED";
}

function pickWeighted<T>(weights: [T, number][]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weights) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return weights[weights.length - 1][0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateBetween(start: Date, end: Date): Date {
  if (end.getTime() <= start.getTime()) return new Date(start);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomTitle(): string {
  const template = pick(TITLE_TEMPLATES);
  return template
    .replace("{floor}", `${faker.number.int({ min: 1, max: 8 })}th floor`)
    .replace("{dept}", faker.commerce.department())
    .replace("{app}", faker.helpers.arrayElement(["Zoom", "Slack", "Adobe Acrobat", "Microsoft 365", "SAP", "AutoCAD"]));
}

async function main() {
  const now = new Date();

  const [categories, creators, assignees, departments] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", companyId: { not: null }, departmentId: { not: null } },
      select: { id: true, companyId: true, departmentId: true, telephone: true },
    }),
    prisma.user.findMany({ where: { isAssignee: true, status: "ACTIVE" }, select: { id: true } }),
    prisma.department.findMany({ select: { id: true, DepartmentApprover: { select: { id: true } } } }),
  ]);

  if (categories.length === 0 || creators.length === 0) {
    throw new Error("Need at least one active category and one user with a company/department assigned.");
  }

  const departmentById = new Map(departments.map((d) => [d.id, d]));

  // Seed each month's counter from whatever's already in the DB (existing
  // demo tickets, or a prior run of this same script) so freshly generated
  // numbers never collide with real ones.
  const existingNumbers = await prisma.ticket.findMany({ select: { ticketNumber: true } });
  const seqByMonth = new Map<string, number>();
  for (const { ticketNumber } of existingNumbers) {
    const monthKey = ticketNumber.slice(2, 6);
    const seq = Number(ticketNumber.slice(-4));
    if (Number.isFinite(seq)) {
      seqByMonth.set(monthKey, Math.max(seqByMonth.get(monthKey) ?? 0, seq));
    }
  }

  function nextTicketNumber(date: Date): string {
    const yy = String(date.getUTCFullYear()).slice(2);
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const monthKey = `${yy}${mm}`;
    const seq = (seqByMonth.get(monthKey) ?? 0) + 1;
    seqByMonth.set(monthKey, seq);
    return `TK${monthKey}${dd}${String(seq).padStart(4, "0")}`;
  }

  let created = 0;
  for (let i = 0; i < TICKET_COUNT; i++) {
    const creator = pick(creators);
    const department = creator.departmentId ? departmentById.get(creator.departmentId) : undefined;
    const transactionDate = randomDateBetween(RANGE_START, now);
    let status = pickWeighted(STATUS_WEIGHTS);
    if (status === "WAITING" && !department?.DepartmentApprover.length) status = "ASSIGNED";

    const priority = pickWeighted(PRIORITY_WEIGHTS);
    const category = pick(categories);
    const ticketId = randomUUID();
    const ticketNumber = nextTicketNumber(transactionDate);

    const hasAssignee = status !== "NEW" && assignees.length > 0;
    const chosenAssignees = hasAssignee
      ? faker.helpers.arrayElements(assignees, { min: 1, max: Math.min(2, assignees.length) })
      : [];

    let assignedAt: Date | null = null;
    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    let ratingScore: number | null = null;
    let ratingComment: string | null = null;

    if (hasAssignee) {
      assignedAt = randomDateBetween(transactionDate, new Date(Math.min(transactionDate.getTime() + 5 * DAY_MS, now.getTime())));
    }
    if (status === "RESOLVED" || status === "CLOSED") {
      const base = assignedAt ?? transactionDate;
      resolvedAt = randomDateBetween(base, new Date(Math.min(base.getTime() + 10 * DAY_MS, now.getTime())));
    }
    if (status === "CLOSED" && resolvedAt) {
      closedAt = randomDateBetween(resolvedAt, new Date(Math.min(resolvedAt.getTime() + 5 * DAY_MS, now.getTime())));
      if (Math.random() < 0.85) {
        ratingScore = faker.number.int({ min: 1, max: 5 });
        ratingComment = Math.random() < 0.4 ? faker.lorem.sentence() : null;
      }
    }

    const history: {
      id: string;
      action: string;
      previousState: string | null;
      newState: string | null;
      timestamp: Date;
      actorId: string | null;
    }[] = [
      { id: randomUUID(), action: "Ticket created", previousState: null, newState: "NEW", timestamp: transactionDate, actorId: creator.id },
    ];
    if (hasAssignee && assignedAt) {
      history.push({
        id: randomUUID(),
        action: "Ticket assigned",
        previousState: "NEW",
        newState: "ASSIGNED",
        timestamp: assignedAt,
        actorId: null,
      });
    }
    if (resolvedAt) {
      history.push({
        id: randomUUID(),
        action: "Status changed",
        previousState: "ASSIGNED",
        newState: "RESOLVED",
        timestamp: resolvedAt,
        actorId: chosenAssignees[0]?.id ?? null,
      });
    }
    if (closedAt) {
      history.push({
        id: randomUUID(),
        action: "Status changed",
        previousState: "RESOLVED",
        newState: "CLOSED",
        timestamp: closedAt,
        actorId: creator.id,
      });
    }

    await prisma.ticket.create({
      data: {
        id: ticketId,
        ticketNumber,
        title: randomTitle(),
        description: faker.lorem.paragraph(),
        categoryId: category.id,
        companyId: creator.companyId as string,
        departmentId: creator.departmentId as string,
        createdById: creator.id,
        status,
        priority,
        telephone: creator.telephone,
        transactionDate,
        resolvedAt,
        closedAt,
        ratingScore,
        ratingComment,
        rating: ratingScore ? mapScoreToRating(ratingScore) : null,
        updatedAt: now,
        TicketAssignee: chosenAssignees.length
          ? { create: chosenAssignees.map((a) => ({ id: randomUUID(), userId: a.id, assignedAt: assignedAt ?? transactionDate })) }
          : undefined,
        TicketHistory: { create: history },
      },
    });

    created++;
    if (created % 50 === 0) console.log(`Created ${created}/${TICKET_COUNT} tickets...`);
  }

  console.log(`Done — created ${created} test tickets (transactionDate spread ${RANGE_START.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
