import "server-only";
import sharp, { type Metadata } from "sharp";
import { DomainError } from "@/server/errors";

/** Book-cover format shown everywhere: 2:3, stored at 600×900. */
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 900;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 200;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);

/**
 * Turns an uploaded picture into the stored cover: checks it really is a
 * JPG/PNG/WebP (by content, not file name), crops the middle to 2:3 and
 * re-encodes it as a 600×900 WebP (also strips EXIF/location data).
 */
export async function processCover(input: Buffer): Promise<Buffer> {
  if (input.length === 0) throw new DomainError("INVALID_INPUT", "Chọn một ảnh bìa.");
  if (input.length > MAX_COVER_BYTES) throw new DomainError("INVALID_INPUT", "Ảnh bìa tối đa 5 MB.");
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new DomainError("INVALID_INPUT", "Không đọc được ảnh. Hãy dùng tệp JPG, PNG hoặc WebP.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new DomainError("INVALID_INPUT", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");
  }
  if ((meta.width ?? 0) < MIN_SIDE || (meta.height ?? 0) < MIN_SIDE) {
    throw new DomainError("INVALID_INPUT", `Ảnh quá nhỏ (cần ít nhất ${MIN_SIDE}×${MIN_SIDE} px, nên dùng 600×900).`);
  }
  return sharp(input)
    .rotate() // honour the camera orientation before cropping
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();
}
