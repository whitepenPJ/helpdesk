-- Fold any existing VERIFIED tickets into RESOLVED (same "awaiting the
-- customer's close" bucket in the new flow) before the value is removed.
UPDATE "Ticket" SET status = 'RESOLVED' WHERE status = 'VERIFIED';

-- Postgres has no "DROP VALUE" for enums — recreate the type without it and
-- swap every column that uses it over via a text-cast.
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'RESOLVED', 'REOPENED', 'CLOSED', 'WAITING');

ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus" USING "status"::text::"TicketStatus";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW'::"TicketStatus";
ALTER TABLE "Ticket" ALTER COLUMN "preApprovalStatus" TYPE "TicketStatus" USING "preApprovalStatus"::text::"TicketStatus";

DROP TYPE "TicketStatus_old";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing tickets from their real creation time rather than
-- leaving every pre-existing row stamped with this migration's run time.
UPDATE "Ticket" SET "transactionDate" = "createdAt";
