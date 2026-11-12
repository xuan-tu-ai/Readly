-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('MCQ', 'SHORT', 'ESSAY', 'WORK_COMPLETED', 'MINIGAME');

-- CreateEnum
CREATE TYPE "BadgeRule" AS ENUM ('WORKS_COMPLETED', 'GENRES_COMPLETED', 'STREAK_DAYS', 'DEEP_ANSWERS', 'WORK_COMPLETED');

-- CreateEnum
CREATE TYPE "MiniGameType" AS ENUM ('MATCH', 'DETAIL');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "leaderboardEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" "PointReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mcqFirstTry" INTEGER NOT NULL DEFAULT 5,
    "shortDat" INTEGER NOT NULL DEFAULT 10,
    "shortSauSac" INTEGER NOT NULL DEFAULT 20,
    "essayDat" INTEGER NOT NULL DEFAULT 20,
    "essaySauSac" INTEGER NOT NULL DEFAULT 40,
    "workCompleted" INTEGER NOT NULL DEFAULT 100,
    "workEarlyBonus" INTEGER NOT NULL DEFAULT 50,
    "miniGameMax" INTEGER NOT NULL DEFAULT 30,
    "levelThresholds" INTEGER[] DEFAULT ARRAY[0, 300, 1000, 2500, 5000]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "StreakDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "PlayerState" (
    "userId" TEXT NOT NULL,
    "celebratedLevel" INTEGER NOT NULL DEFAULT 1,
    "avatar" TEXT NOT NULL DEFAULT 'muop',

    CONSTRAINT "PlayerState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rule" "BadgeRule" NOT NULL,
    "threshold" INTEGER,
    "workId" TEXT,
    "emblem" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "MiniGame" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "unlockSegmentId" TEXT NOT NULL,
    "type" "MiniGameType" NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniGamePlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniGamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointEntry_userId_key_idx" ON "PointEntry"("userId", "key");

-- CreateIndex
CREATE INDEX "PointEntry_userId_createdAt_idx" ON "PointEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_key_key" ON "BadgeDefinition"("key");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE INDEX "MiniGame_workId_idx" ON "MiniGame"("workId");

-- CreateIndex
CREATE INDEX "MiniGamePlay_userId_gameId_idx" ON "MiniGamePlay"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakDay" ADD CONSTRAINT "StreakDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerState" ADD CONSTRAINT "PlayerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeDefinition" ADD CONSTRAINT "BadgeDefinition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGame" ADD CONSTRAINT "MiniGame_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGame" ADD CONSTRAINT "MiniGame_unlockSegmentId_fkey" FOREIGN KEY ("unlockSegmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGamePlay" ADD CONSTRAINT "MiniGamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGamePlay" ADD CONSTRAINT "MiniGamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
