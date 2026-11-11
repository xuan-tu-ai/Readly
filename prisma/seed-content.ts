/**
 * Seeds tags and works from content/*.json. Idempotent: works are upserted by
 * slug; segments are only generated for published works that have none.
 *
 * The current files hold PLACEHOLDER data (titles "… mẫu 01", authors
 * "Tác giả ABC", placeholder text). Replace content/works.sample.json with the
 * real list later – same format.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import { GENRES, workSearchText } from "../src/lib/catalog";
import { sanitizeSegmentHtml } from "../src/lib/reading/sanitize";

const tagSchema = z.object({
  slug: z.string(),
  label: z.string(),
  kind: z.enum(["THEME", "MOOD"]),
});

const workSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  author: z.string().min(1),
  authorBio: z.string(),
  genre: z.enum(GENRES),
  summary: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  estMinutes: z.number().int().positive(),
  status: z.enum(["DRAFT", "PUBLISHED", "COMING_SOON"]),
  tags: z.array(z.string()),
  coverUrl: z.string().optional(),
});

export type SeedWork = z.infer<typeof workSchema>;

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  const full = path.resolve(process.cwd(), "content", file);
  return schema.parse(JSON.parse(readFileSync(full, "utf8")));
}

export function loadSampleContent() {
  const tags = readJson("tags.json", z.array(tagSchema));
  const works = readJson("works.sample.json", z.array(workSchema));
  const known = new Set(tags.map((t) => t.slug));
  for (const work of works) {
    for (const tag of work.tags) {
      if (!known.has(tag)) throw new Error(`Tác phẩm ${work.slug} dùng tag không tồn tại: ${tag}`);
    }
  }
  return { tags, works };
}

/** Clearly-marked placeholder text, shaped by genre (verses for poems, dialogue for drama…). */
export function placeholderSegments(work: Pick<SeedWork, "title" | "genre">, count = 5) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const note = `<p><em>[Văn bản giữ chỗ – phân đoạn ${n} của “${work.title}”. Toàn văn thật sẽ được nhập sau.]</em></p>`;
    let body: string;
    switch (work.genre) {
      case "THO":
        body = `<p>Dòng thơ mẫu thứ nhất của khổ ${n}<br />Dòng thơ mẫu thứ hai, gió qua hàng tre<br />Dòng thơ mẫu thứ ba, nắng vàng trên đê<br />Dòng thơ mẫu thứ tư khép lại khổ ${n}</p>`;
        break;
      case "KICH":
        body = `<p><strong>NHÂN VẬT A:</strong> Đây là lời thoại mẫu của cảnh ${n}.</p><p><strong>NHÂN VẬT B:</strong> Và đây là lời đáp mẫu, để kiểm tra cách trình bày kịch.</p><p><em>(Chỉ dẫn sân khấu mẫu: ánh đèn dịu xuống.)</em></p>`;
        break;
      default:
        body = Array.from(
          { length: 3 },
          (_, p) =>
            `<p>Đoạn văn mẫu ${p + 1} thuộc phần ${n}. Câu văn này chỉ dùng để giữ chỗ, giúp kiểm tra bố cục trang đọc, cỡ chữ và khoảng cách dòng. Nội dung thật của tác phẩm sẽ thay thế đoạn này.</p>`,
        ).join("");
    }
    return {
      order: n,
      title: work.genre === "THO" ? `Khổ ${n}` : work.genre === "KICH" ? `Cảnh ${n}` : `Phần ${n}`,
      content: sanitizeSegmentHtml(note + body),
    };
  });
}

export async function seedContent(db: PrismaClient) {
  const { tags, works } = loadSampleContent();

  for (const tag of tags) {
    await db.tag.upsert({ where: { slug: tag.slug }, update: { label: tag.label, kind: tag.kind }, create: tag });
  }
  const tagIds = new Map((await db.tag.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));

  let segmentsCreated = 0;
  for (const { tags: workTags, ...work } of works) {
    const data = { ...work, coverUrl: work.coverUrl ?? null, searchText: workSearchText(work) };
    const saved = await db.work.upsert({ where: { slug: work.slug }, update: data, create: data });

    await db.workTag.deleteMany({ where: { workId: saved.id } });
    await db.workTag.createMany({ data: workTags.map((slug) => ({ workId: saved.id, tagId: tagIds.get(slug)! })) });

    if (work.status === "PUBLISHED" && (await db.segment.count({ where: { workId: saved.id } })) === 0) {
      const segments = placeholderSegments(work);
      await db.segment.createMany({ data: segments.map((s) => ({ ...s, workId: saved.id })) });
      segmentsCreated += segments.length;
    }
  }
  return { tags: tags.length, works: works.length, segmentsCreated };
}
