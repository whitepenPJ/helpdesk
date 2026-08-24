-- CreateTable
CREATE TABLE "TicketAssignee" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignedGroup" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userGroupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignedGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketAssignee_ticketId_userId_key" ON "TicketAssignee"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "TicketAssignee_ticketId_idx" ON "TicketAssignee"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAssignee_userId_idx" ON "TicketAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAssignedGroup_ticketId_userGroupId_key" ON "TicketAssignedGroup"("ticketId", "userGroupId");

-- CreateIndex
CREATE INDEX "TicketAssignedGroup_ticketId_idx" ON "TicketAssignedGroup"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAssignedGroup_userGroupId_idx" ON "TicketAssignedGroup"("userGroupId");

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignedGroup" ADD CONSTRAINT "TicketAssignedGroup_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignedGroup" ADD CONSTRAINT "TicketAssignedGroup_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy existing single-valued assignments into the new join
-- tables before the old columns are dropped. gen_random_uuid() comes from
-- pgcrypto, enabled by default on Supabase.
INSERT INTO "TicketAssignee" ("id", "ticketId", "userId")
SELECT gen_random_uuid()::text, "id", "assigneeId" FROM "Ticket" WHERE "assigneeId" IS NOT NULL;

INSERT INTO "TicketAssignedGroup" ("id", "ticketId", "userGroupId")
SELECT gen_random_uuid()::text, "id", "assignedGroupId" FROM "Ticket" WHERE "assignedGroupId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assigneeId_fkey";

-- DropIndex
DROP INDEX "Ticket_assignedGroupId_idx";

-- DropIndex
DROP INDEX "Ticket_assigneeId_idx";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "assignedGroupId",
DROP COLUMN "assigneeId";
