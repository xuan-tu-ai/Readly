-- CreateTable
CREATE TABLE "WorkCoverImage" (
    "workId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCoverImage_pkey" PRIMARY KEY ("workId")
);

-- AddForeignKey
ALTER TABLE "WorkCoverImage" ADD CONSTRAINT "WorkCoverImage_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
