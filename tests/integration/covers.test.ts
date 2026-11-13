import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createWork, updateWork } from "@/server/services/admin/works";
import { makeUser, resetDatabase } from "../helpers/db";

vi.mock("server-only", () => ({}));
const { removeWorkCover, setCoverLink, setWorkCover } = await import("@/server/services/admin/covers");
const { GET } = await import("@/app/api/covers/[workId]/route");

beforeEach(async () => {
  await resetDatabase();
});

/** A landscape PNG: the stored cover must still come out 600×900. */
function png(width = 1200, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: { r: 60, g: 140, b: 90 } } }).png().toBuffer();
}

async function setup() {
  const admin = await makeUser("ADMIN");
  const { id } = await createWork(admin, { title: "Câu cá mùa thu", author: "Nguyễn Khuyến", genre: "THO" });
  return { admin, id };
}

function get(workId: string, query = "") {
  return GET(new Request(`http://localhost/api/covers/${workId}${query}`), { params: Promise.resolve({ workId }) });
}

describe("uploaded covers", () => {
  it("stores any JPG/PNG/WebP as a 600×900 WebP and points the work at it", async () => {
    const { admin, id } = await setup();
    const url = await setWorkCover(admin, id, await png());
    expect(url).toMatch(new RegExp(`^/api/covers/${id}\\?v=\\d+$`));
    expect((await db.work.findUniqueOrThrow({ where: { id } })).coverUrl).toBe(url);

    const stored = await db.workCoverImage.findUniqueOrThrow({ where: { workId: id } });
    const meta = await sharp(Buffer.from(stored.data)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 600, 900]);
  });

  it("serves the cover, cached for a year only under its current version", async () => {
    const { admin, id } = await setup();
    const url = await setWorkCover(admin, id, await png());
    const fresh = await get(id, url.slice(url.indexOf("?")));
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get("content-type")).toBe("image/webp");
    expect(fresh.headers.get("cache-control")).toContain("immutable");
    expect((await get(id, "?v=1")).headers.get("cache-control")).toBe("public, max-age=300");
    expect((await get("missing")).status).toBe(404);
  });

  it("rejects files that are not pictures, too small or too big", async () => {
    const { admin, id } = await setup();
    await expect(setWorkCover(admin, id, Buffer.from("not an image"))).rejects.toThrow(/Không đọc được ảnh/);
    await expect(setWorkCover(admin, id, await png(100, 150))).rejects.toThrow(/quá nhỏ/);
    await expect(setWorkCover(admin, id, Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow(/tối đa 5 MB/);
    const gif = await sharp({ create: { width: 400, height: 600, channels: 3, background: "#fff" } }).gif().toBuffer();
    await expect(setWorkCover(admin, id, gif)).rejects.toThrow(/JPG, PNG hoặc WebP/);
    expect(await db.workCoverImage.count()).toBe(0);
  });

  it("only lets admins change covers", async () => {
    const { id } = await setup();
    const teacher = await makeUser("TEACHER");
    await expect(setWorkCover(teacher, id, await png())).rejects.toBeInstanceOf(DomainError);
    await expect(removeWorkCover(teacher, id)).rejects.toBeInstanceOf(DomainError);
  });

  it("removing or switching to a link drops the uploaded image", async () => {
    const { admin, id } = await setup();
    await setWorkCover(admin, id, await png());
    await setCoverLink(admin, id, "https://example.com/bia.jpg");
    expect(await db.workCoverImage.count()).toBe(0);
    expect((await db.work.findUniqueOrThrow({ where: { id } })).coverUrl).toBe("https://example.com/bia.jpg");

    await setWorkCover(admin, id, await png());
    await removeWorkCover(admin, id);
    expect(await db.workCoverImage.count()).toBe(0);
    expect((await db.work.findUniqueOrThrow({ where: { id } })).coverUrl).toBeNull();
  });

  it("saving the work's other details keeps the uploaded cover", async () => {
    const { admin, id } = await setup();
    const url = await setWorkCover(admin, id, await png());
    await updateWork(admin, id, {
      title: "Câu cá mùa thu",
      author: "Nguyễn Khuyến",
      genre: "THO",
      authorBio: "",
      summary: "Bài thơ thu.",
      difficulty: 2,
      estMinutes: 10,
      status: "DRAFT",
      background: null,
      tags: [],
    });
    expect((await db.work.findUniqueOrThrow({ where: { id } })).coverUrl).toBe(url);
    expect(await db.workCoverImage.count()).toBe(1);
  });
});
