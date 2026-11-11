-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('THO', 'TRUYEN_NGAN', 'TIEU_THUYET', 'KICH', 'KI', 'NGHI_LUAN');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('THEME', 'MOOD');

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorBio" TEXT NOT NULL,
    "genre" "Genre" NOT NULL,
    "summary" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "estMinutes" INTEGER NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'DRAFT',
    "coverUrl" TEXT,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTag" (
    "workId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "WorkTag_pkey" PRIMARY KEY ("workId","tagId")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_status_genre_idx" ON "Work"("status", "genre");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "WorkTag_tagId_idx" ON "WorkTag"("tagId");

-- CreateIndex
CREATE INDEX "Segment_workId_order_idx" ON "Segment"("workId", "order");

-- CreateIndex
CREATE INDEX "QuizResult_userId_createdAt_idx" ON "QuizResult"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
