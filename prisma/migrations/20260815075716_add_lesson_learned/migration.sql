-- CreateTable
CREATE TABLE "LessonLearned" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "attachments" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonLearned_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonLearned_createdById_idx" ON "LessonLearned"("createdById");

-- CreateIndex
CREATE INDEX "LessonLearned_isActive_idx" ON "LessonLearned"("isActive");

-- AddForeignKey
ALTER TABLE "LessonLearned" ADD CONSTRAINT "LessonLearned_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
