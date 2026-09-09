-- CreateTable
CREATE TABLE "UserGroupMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGroupMember_userId_idx" ON "UserGroupMember"("userId");

-- CreateIndex
CREATE INDEX "UserGroupMember_userGroupId_idx" ON "UserGroupMember"("userGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMember_userId_userGroupId_key" ON "UserGroupMember"("userId", "userGroupId");

-- AddForeignKey
ALTER TABLE "UserGroupMember" ADD CONSTRAINT "UserGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupMember" ADD CONSTRAINT "UserGroupMember_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: turn each user's single existing group into one membership row
-- before the old column is dropped. gen_random_uuid() comes from pgcrypto,
-- enabled by default on Supabase.
INSERT INTO "UserGroupMember" ("id", "userId", "userGroupId")
SELECT gen_random_uuid()::text, "id", "userGroupId" FROM "User" WHERE "userGroupId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_userGroupId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "userGroupId";
