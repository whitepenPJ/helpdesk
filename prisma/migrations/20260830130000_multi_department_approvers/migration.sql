-- CreateTable
CREATE TABLE "DepartmentApprover" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentApprover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentApprover_departmentId_idx" ON "DepartmentApprover"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentApprover_userId_idx" ON "DepartmentApprover"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentApprover_departmentId_userId_key" ON "DepartmentApprover"("departmentId", "userId");

-- AddForeignKey
ALTER TABLE "DepartmentApprover" ADD CONSTRAINT "DepartmentApprover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentApprover" ADD CONSTRAINT "DepartmentApprover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each department's existing single supervisor into the new
-- join table before the old column is dropped. gen_random_uuid() comes from
-- pgcrypto, enabled by default on Supabase.
INSERT INTO "DepartmentApprover" ("id", "departmentId", "userId")
SELECT gen_random_uuid()::text, "id", "supervisorId" FROM "Department" WHERE "supervisorId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_supervisorId_fkey";

-- DropIndex
DROP INDEX "Department_supervisorId_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "supervisorId";

-- AlterTable: TicketApproval.supervisorId now records who decided (nullable
-- while PENDING) rather than who the request was sent to, since a request
-- now goes to every department approver, not one designated person.
ALTER TABLE "TicketApproval" DROP CONSTRAINT "TicketApproval_supervisorId_fkey";

ALTER TABLE "TicketApproval" ALTER COLUMN "supervisorId" DROP NOT NULL;

ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
