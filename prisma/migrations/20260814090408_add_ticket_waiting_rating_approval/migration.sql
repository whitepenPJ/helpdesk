-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "preApprovalStatus" "TicketStatus",
ADD COLUMN     "ratingScore" INTEGER;

-- AlterTable
ALTER TABLE "TicketApproval" ADD COLUMN     "requestMessage" TEXT;
