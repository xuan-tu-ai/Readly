-- CreateEnum
CREATE TYPE "ReadingFont" AS ENUM ('NOTO_SERIF', 'LORA', 'BE_VIETNAM');

-- CreateEnum
CREATE TYPE "PageMode" AS ENUM ('SCROLL', 'PAGED');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "backdrop" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "font" "ReadingFont" NOT NULL DEFAULT 'NOTO_SERIF',
ADD COLUMN     "pageMode" "PageMode" NOT NULL DEFAULT 'SCROLL';
