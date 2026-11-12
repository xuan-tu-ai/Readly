/**
 * Seeds the real, public-domain works in content/works/*.json: full text in
 * segments, a "Trước khi đọc" card, questions for the three stages and mini
 * games. Questions were drafted with the AI (Token Harbor) and reviewed by
 * hand. Idempotent: metadata is upserted; segments, questions and games are
 * only created for a work that has none yet.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { GENRES, workSearchText } from "../src/lib/catalog";
import { detailDataSchema, matchDataSchema } from "../src/lib/minigames";
import { sanitizeSegmentHtml } from "../src/lib/reading/sanitize";

const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

const rubricSchema = z.object({ chuaDat: z.string().min(3), dat: z.string().min(3), sauSac: z.string().min(3) });

const questionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PREDICTION"), stage: z.literal("PRE"), segment: z.null(), prompt: z.string().min(5), required: z.boolean().optional() }),
  z.object({
    type: z.literal("MCQ"),
    stage: z.enum(["DURING", "POST"]),
    segment: z.number().int().min(1).nullable(),
    prompt: z.string().min(5),
    options: z.array(z.string().min(1)).min(2).max(5),
    correct: z.number().int().min(0),
    explanation: z.string().nullable(),
  }),
  z.object({
    type: z.enum(["SHORT", "ESSAY"]),
    stage: z.enum(["DURING", "POST"]),
    segment: z.number().int().min(1).nullable(),
    prompt: z.string().min(5),
    rubric: rubricSchema,
    keyPoints: z.array(z.string().min(1)).min(1),
    outline: z.string().optional(),
    minWords: z.number().int().optional(),
    maxWords: z.number().int().optional(),
  }),
]);

const gameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MATCH"),
    title: z.string().min(3),
    unlockSegment: z.number().int().min(1),
    pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).min(2),
  }),
  z.object({
    type: z.literal("DETAIL"),
    title: z.string().min(3),
    unlockSegment: z.number().int().min(1),
    items: z
      .array(z.object({ text: z.string(), options: z.array(z.string()), answer: z.number().int(), explanation: z.string().nullable().optional() }))
      .min(1),
  }),
]);

export const realWorkSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    author: z.string().min(1),
    authorBio: z.string(),
    genre: z.enum(GENRES),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    estMinutes: z.number().int().positive(),
    status: z.enum(["DRAFT", "PUBLISHED", "COMING_SOON"]),
    summary: z.string(),
    tags: z.array(z.string()),
    source: z.string(),
    background: z.string(),
    segments: z.array(z.object({ title: z.string().min(1), html: z.string().min(1) })).min(1),
    questions: z.array(questionSchema),
    games: z.array(gameSchema),
  })
  .superRefine((w, ctx) => {
    const n = w.segments.length;
    w.questions.forEach((q, i) => {
      if (q.stage === "DURING" && (q.segment === null || q.segment > n)) ctx.addIssue({ code: "custom", path: ["questions", i], message: "Phân đoạn không hợp lệ." });
      if (q.type === "MCQ" && q.correct >= q.options.length) ctx.addIssue({ code: "custom", path: ["questions", i], message: "Đáp án ngoài danh sách." });
    });
    w.games.forEach((g, i) => {
      if (g.unlockSegment > n) ctx.addIssue({ code: "custom", path: ["games", i], message: "Phân đoạn mở khóa không hợp lệ." });
    });
  });

export type RealWork = z.infer<typeof realWorkSchema>;

export function loadRealWorks(dir = path.resolve(process.cwd(), "content", "works")): RealWork[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed = realWorkSchema.safeParse(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
      if (!parsed.success) throw new Error(`content/works/${f}: ${parsed.error.message}`);
      return parsed.data;
    });
}

export async function seedRealWorks(db: PrismaClient, tagIds: Map<string, string>) {
  const works = loadRealWorks();
  let created = 0;
  for (const w of works) {
    for (const tag of w.tags) if (!tagIds.has(tag)) throw new Error(`Tác phẩm ${w.slug} dùng tag không tồn tại: ${tag}`);
    const meta = {
      slug: w.slug,
      title: w.title,
      author: w.author,
      authorBio: w.authorBio,
      genre: w.genre,
      difficulty: w.difficulty,
      estMinutes: w.estMinutes,
      status: w.status,
      summary: w.summary,
      background: sanitizeSegmentHtml(w.background),
      searchText: workSearchText(w),
    };
    const saved = await db.work.upsert({ where: { slug: w.slug }, update: meta, create: meta });
    await db.workTag.deleteMany({ where: { workId: saved.id } });
    await db.workTag.createMany({ data: w.tags.map((slug) => ({ workId: saved.id, tagId: tagIds.get(slug)! })) });

    if ((await db.segment.count({ where: { workId: saved.id } })) === 0) {
      await db.segment.createMany({
        data: w.segments.map((s, i) => ({ workId: saved.id, order: i + 1, title: s.title, content: sanitizeSegmentHtml(s.html) })),
      });
      created++;
    }
    const segments = await db.segment.findMany({ where: { workId: saved.id, archivedAt: null }, orderBy: { order: "asc" }, select: { id: true } });
    const segmentId = (n: number | null) => (n === null ? null : segments[n - 1]?.id ?? null);

    if ((await db.question.count({ where: { workId: saved.id } })) === 0) {
      const order = new Map<string, number>();
      const data: Prisma.QuestionCreateManyInput[] = w.questions.map((q) => {
        const segment = q.stage === "DURING" ? segmentId(q.segment) : null;
        const key = `${q.stage}:${segment ?? ""}`;
        order.set(key, (order.get(key) ?? 0) + 1);
        const base = { workId: saved.id, stage: q.stage, type: q.type, segmentId: segment, order: order.get(key)!, prompt: q.prompt };
        if (q.type === "PREDICTION") return { ...base, required: q.required ?? false };
        if (q.type === "MCQ") {
          return {
            ...base,
            options: q.options.map((text, i) => ({ id: OPTION_IDS[i], text })),
            correctOptionId: OPTION_IDS[q.correct],
            explanation: q.explanation,
          };
        }
        return {
          ...base,
          rubric: q.rubric,
          keyPoints: q.keyPoints,
          outline: q.type === "ESSAY" ? (q.outline ?? null) : null,
          minWords: q.type === "ESSAY" ? (q.minWords ?? null) : null,
          maxWords: q.type === "ESSAY" ? (q.maxWords ?? null) : null,
        };
      });
      await db.question.createMany({ data });
    }

    if ((await db.miniGame.count({ where: { workId: saved.id } })) === 0) {
      await db.miniGame.createMany({
        data: w.games.map((g, i) => ({
          workId: saved.id,
          unlockSegmentId: segmentId(g.unlockSegment)!,
          type: g.type,
          title: g.title,
          order: i + 1,
          data:
            g.type === "MATCH"
              ? matchDataSchema.parse({ pairs: g.pairs.map((p, j) => ({ id: `p${j + 1}`, ...p })) })
              : detailDataSchema.parse({
                  items: g.items.map((it, j) => ({ id: `d${j + 1}`, ...it, explanation: it.explanation ?? undefined })),
                }),
        })),
      });
    }
  }
  return { realWorks: works.length, realWorksCreated: created };
}
