-- CreateTable
CREATE TABLE "CategoryUserGroup" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryUserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryUserGroup_categoryId_userGroupId_key" ON "CategoryUserGroup"("categoryId", "userGroupId");

-- AddForeignKey
ALTER TABLE "CategoryUserGroup" ADD CONSTRAINT "CategoryUserGroup_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryUserGroup" ADD CONSTRAINT "CategoryUserGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
