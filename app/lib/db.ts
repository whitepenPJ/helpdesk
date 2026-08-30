import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaClient: PrismaClient | undefined;
}

// This pool's `max` is never the only one open against the DB — in Next.js
// dev, separate worker realms each get their own copy of this module's
// `global` singleton; in production on Vercel, concurrent serverless
// function instances each get their own module instance (and thus their own
// pool) too. Supabase's session-mode pooler caps total client connections at
// 15 (see pool_size in the Supabase dashboard), so keep each instance's
// footprint small enough that several of them together can't exceed it
// (EMAXCONNSESSION otherwise).
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 5_000,
});

export const prisma = global.prismaClient ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prismaClient = prisma;
}
