-- CreateEnum
CREATE TYPE "QuestionStage" AS ENUM ('PRE', 'DURING', 'POST');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('PREDICTION', 'MCQ', 'SHORT', 'ESSAY');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('PENDING', 'GRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnswerLevel" AS ENUM ('CHUA_DAT', 'DAT', 'SAU_SAC');

-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "background" TEXT;

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "segmentId" TEXT,
    "stage" "QuestionStage" NOT NULL,
    "type" "QuestionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "correctOptionId" TEXT,
    "explanation" TEXT,
    "rubric" JSONB,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outline" TEXT,
    "minWords" INTEGER,
    "maxWords" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AnswerStatus" NOT NULL,
    "level" "AnswerLevel",
    "isCorrect" BOOLEAN,
    "strengths" TEXT,
    "improvements" TEXT,
    "feedback" TEXT,
    "aiHidden" BOOLEAN NOT NULL DEFAULT false,
    "teacherLevel" "AnswerLevel",
    "teacherNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCompletion" (
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCompletion_pkey" PRIMARY KEY ("userId","workId")
);

-- CreateIndex
CREATE INDEX "Question_workId_stage_order_idx" ON "Question"("workId", "stage", "order");

-- CreateIndex
CREATE INDEX "Question_segmentId_idx" ON "Question"("segmentId");

-- CreateIndex
CREATE INDEX "Answer_userId_submittedAt_idx" ON "Answer"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "Answer_status_idx" ON "Answer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionId_userId_attempt_key" ON "Answer"("questionId", "userId", "attempt");

-- CreateIndex
CREATE INDEX "WorkCompletion_workId_idx" ON "WorkCompletion"("workId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCompletion" ADD CONSTRAINT "WorkCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCompletion" ADD CONSTRAINT "WorkCompletion_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
