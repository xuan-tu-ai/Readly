import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { processCover } from "@/server/content/cover-image";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";

/** URL of an uploaded cover; the version makes browsers fetch a replaced cover again. */
export function uploadedCoverUrl(workId: string, version: Date): string {
  return `/api/covers/${workId}?v=${version.getTime()}`;
}

export function isUploadedCoverUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/api/covers/");
}

/** Stores an uploaded cover (resized to 600×900 WebP) and points the work at it. */
export async function setWorkCover(actor: Actor, workId: string, upload: Buffer): Promise<string> {
  assertRole(actor, "ADMIN");
  if (!(await db.work.findUnique({ where: { id: workId }, select: { id: true } }))) notFound("Không tìm thấy tác phẩm.");
  const data = await processCover(upload);
  const image = await db.workCoverImage.upsert({
    where: { workId },
    create: { workId, data: new Uint8Array(data), mime: "image/webp" },
    update: { data: new Uint8Array(data), mime: "image/webp" },
    select: { updatedAt: true },
  });
  const coverUrl = uploadedCoverUrl(workId, image.updatedAt);
  await db.work.update({ where: { id: workId }, data: { coverUrl } });
  return coverUrl;
}

/** Uses a cover hosted elsewhere (or none); a previously uploaded image is dropped. */
export async function setCoverLink(actor: Actor, workId: string, url: string | null): Promise<void> {
  assertRole(actor, "ADMIN");
  if (!(await db.work.findUnique({ where: { id: workId }, select: { id: true } }))) notFound("Không tìm thấy tác phẩm.");
  if (isUploadedCoverUrl(url)) return; // the current upload, unchanged
  await db.$transaction([
    db.workCoverImage.deleteMany({ where: { workId } }),
    db.work.update({ where: { id: workId }, data: { coverUrl: url } }),
  ]);
}

/** Removes the cover (uploaded or linked); the generated cover shows again. */
export async function removeWorkCover(actor: Actor, workId: string): Promise<void> {
  assertRole(actor, "ADMIN");
  if (!(await db.work.findUnique({ where: { id: workId }, select: { id: true } }))) notFound("Không tìm thấy tác phẩm.");
  await db.$transaction([
    db.workCoverImage.deleteMany({ where: { workId } }),
    db.work.update({ where: { id: workId }, data: { coverUrl: null } }),
  ]);
}

/** Public read for /api/covers/<id>: covers are not sensitive and are shown on cards to everyone. */
export function getCoverImage(workId: string) {
  return db.workCoverImage.findUnique({ where: { workId }, select: { data: true, mime: true, updatedAt: true } });
}
