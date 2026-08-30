import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaClient: PrismaClient | undefined;
}

// DATABASE_URL now points at Supabase's *transaction-mode* pooler (port
// 6543, PgBouncer-style) rather than session mode (port 5432, still used
// for migrations via DIRECT_URL — see prisma.config.ts). Session mode caps
// total client connections at a fixed, small number (15 here) — fine for a
// handful of long-lived servers, but concurrent Vercel function instances
// each opening their own pool blew past that repeatedly (EMAXCONNSESSION).
// Transaction mode multiplexes many short-lived client connections onto a
// much smaller set of real Postgres backend connections, which is what
// serverless horizontal scale-out actually needs — so `max` here just
// bounds one instance's own concurrency, not a shared budget.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
});

export const prisma = global.prismaClient ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prismaClient = prisma;
}
