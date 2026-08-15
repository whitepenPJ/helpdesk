import "dotenv/config";
import { PrismaClient, type Role } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_ACCOUNTS: { email: string; role: Role }[] = [
  { email: "admin@demo.com", role: "ADMIN" },
  { email: "supervisor@demo.com", role: "SUPERVISOR" },
  { email: "user1@demo.com", role: "USER" },
  { email: "user2@demo.com", role: "USER" },
];

const DEMO_PASSWORD = "P@ssw0rd";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const { email, role } of DEMO_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Skipping ${email} — already exists (role: ${existing.role}).`);
      continue;
    }

    const name = faker.person.fullName();
    await prisma.user.create({
      data: { email, name, role, passwordHash },
    });
    console.log(`Created ${role} user ${email} (${name}).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
