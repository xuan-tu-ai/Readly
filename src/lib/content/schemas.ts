import { z } from "zod";
import { BADGE_EMBLEMS, BADGE_TIERS } from "@/lib/art";
import { GENRES } from "@/lib/catalog";

/**
 * Validation for the admin content editor (spec §13). Shared by server
 * actions (FormData → typed input) and services.
 */

const text = (label: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, { error: `Vui lòng nhập ${label}.` })
    .max(max, { error: `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự.` });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} phải là số.` })
    .int({ error: `${label} phải là số nguyên.` })
    .min(min, { error: `${label} tối thiểu ${min}.` })
    .max(max, { error: `${label} tối đa ${max}.` });

// ───────────────────────── Works ─────────────────────────

export const workInputSchema = z.object({
  title: text("tên tác phẩm", 160),
  author: text("tác giả", 120),
  authorBio: z.string().trim().max(3000).default(""),
  genre: z.enum(GENRES, { error: "Chọn thể loại." }),
  summary: z.string().trim().max(3000).default(""),
  difficulty: int("Độ khó", 1, 3),
  estMinutes: int("Thời lượng", 1, 2000),
  status: z.enum(["DRAFT", "PUBLISHED", "COMING_SOON"]),
  coverUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^(https?:\/\/|\/)/.test(v), { error: "Ảnh bìa phải là đường dẫn http(s) hoặc bắt đầu bằng /." })
    .transform((v) => v || null),
  /** "Trước khi đọc" card; HTML, sanitised on save. */
  background: optionalText(6000),
  tags: z.array(z.string().min(1)).max(20).default([]),
});
export type WorkInput = z.infer<typeof workInputSchema>;

export const newWorkSchema = workInputSchema.pick({ title: true, author: true, genre: true });

export const tagInputSchema = z.object({
  label: text("tên tag", 40),
  kind: z.enum(["THEME", "MOOD"]),
});

// ───────────────────────── Segments ─────────────────────────

export const segmentInputSchema = z.object({
  title: z.string().trim().max(120).default(""),
  html: text("nội dung", 60_000),
});

export const importSegmentsSchema = z.array(z.object({ title: z.string().trim().max(120), html: z.string().min(1).max(60_000) })).min(1).max(200);

// ───────────────────────── Questions ─────────────────────────

/**
 * Which question types fit which stage (spec §3.1, §6.1): a prediction
 * before reading; MCQ and short answers while reading; and after reading
 * MCQ, short answers and the essay.
 */
export const STAGE_TYPES = {
  PRE: ["PREDICTION"],
  DURING: ["MCQ", "SHORT"],
  POST: ["MCQ", "SHORT", "ESSAY"],
} as const;

export const questionInputSchema = z
  .object({
    stage: z.enum(["PRE", "DURING", "POST"]),
    type: z.enum(["PREDICTION", "MCQ", "SHORT", "ESSAY"]),
    segmentId: z.string().trim().nullable().optional(),
    prompt: text("câu hỏi", 1000, 5),
    required: z.boolean().default(true),
    options: z.array(z.string().trim().max(300)).max(5).default([]),
    correctIndex: z.coerce.number().int().min(0).max(4).nullable().optional(),
    explanation: optionalText(800),
    rubricChuaDat: optionalText(600),
    rubricDat: optionalText(600),
    rubricSauSac: optionalText(600),
    keyPoints: z.array(z.string().trim().max(300)).max(8).default([]),
    outline: optionalText(2000),
    minWords: z.coerce.number().int().min(10).max(2000).nullable().optional(),
    maxWords: z.coerce.number().int().min(10).max(3000).nullable().optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!(STAGE_TYPES[q.stage] as readonly string[]).includes(q.type)) {
      issue("type", "Loại câu hỏi không hợp với giai đoạn này.");
    }
    if (q.stage === "DURING" && !q.segmentId) issue("segmentId", "Chọn phân đoạn cho câu hỏi trong khi đọc.");
    if (q.type === "MCQ") {
      const options = q.options.filter(Boolean);
      if (options.length < 2) issue("options", "Trắc nghiệm cần ít nhất 2 lựa chọn.");
      if (q.correctIndex === null || q.correctIndex === undefined || !q.options[q.correctIndex]) {
        issue("correctIndex", "Chọn đáp án đúng.");
      }
    }
    if (q.type === "SHORT" || q.type === "ESSAY") {
      if (!q.rubricChuaDat || !q.rubricDat || !q.rubricSauSac) issue("rubric", "Cần đủ rubric 3 mức.");
      if (q.keyPoints.filter(Boolean).length === 0) issue("keyPoints", "Cần ít nhất 1 ý chính.");
    }
    if (q.minWords && q.maxWords && q.minWords > q.maxWords) issue("maxWords", "Số chữ tối đa phải lớn hơn tối thiểu.");
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

// ───────────────────────── Mini games ─────────────────────────

export const gameInputSchema = z.object({
  type: z.enum(["MATCH", "DETAIL"]),
  title: text("tên mini game", 120, 3),
  unlockSegmentId: z.string().min(1, { error: "Chọn phân đoạn mở khóa." }),
  published: z.boolean().default(false),
  /** MATCH: [{left, right}], DETAIL: [{text, options, answer, explanation}]. Checked against src/lib/minigames.ts on save. */
  pairs: z.array(z.object({ left: z.string().trim(), right: z.string().trim() })).default([]),
  items: z
    .array(
      z.object({
        text: z.string().trim(),
        options: z.array(z.string().trim()),
        answer: z.coerce.number().int().min(0),
        explanation: z.string().trim().nullable().optional(),
      }),
    )
    .default([]),
});
export type GameInput = z.infer<typeof gameInputSchema>;

// ───────────────────────── Gamification ─────────────────────────

const points = (label: string) => int(label, 0, 1000);

export const pointTableSchema = z
  .object({
    mcqFirstTry: points("Trắc nghiệm đúng lần đầu"),
    shortDat: points("Tự luận ngắn Đạt"),
    shortSauSac: points("Tự luận ngắn Sâu sắc"),
    essayDat: points("Đoạn cảm nhận Đạt"),
    essaySauSac: points("Đoạn cảm nhận Sâu sắc"),
    workCompleted: points("Hoàn thành tác phẩm"),
    workEarlyBonus: points("Thưởng đúng hạn"),
    miniGameMax: points("Mini game tối đa"),
    levelThresholds: z.array(int("Ngưỡng cấp", 0, 1_000_000)).length(5),
  })
  .superRefine((t, ctx) => {
    if (t.levelThresholds[0] !== 0) ctx.addIssue({ code: "custom", path: ["levelThresholds"], message: "Cấp 1 phải bắt đầu từ 0 điểm." });
    if (t.levelThresholds.some((v, i) => i > 0 && v <= t.levelThresholds[i - 1])) {
      ctx.addIssue({ code: "custom", path: ["levelThresholds"], message: "Ngưỡng cấp phải tăng dần." });
    }
  });

export const BADGE_RULE_LABEL = {
  WORKS_COMPLETED: "Hoàn thành N tác phẩm",
  GENRES_COMPLETED: "Hoàn thành tác phẩm thuộc N thể loại",
  STREAK_DAYS: "Streak N ngày",
  DEEP_ANSWERS: "N câu trả lời Sâu sắc",
  WORK_COMPLETED: "Hoàn thành một tác phẩm cụ thể",
} as const;

export const badgeInputSchema = z
  .object({
    name: text("tên huy hiệu", 60),
    description: text("mô tả", 200),
    rule: z.enum(["WORKS_COMPLETED", "GENRES_COMPLETED", "STREAK_DAYS", "DEEP_ANSWERS", "WORK_COMPLETED"]),
    threshold: z.coerce.number().int().min(1).max(1000).nullable().optional(),
    workId: z.string().nullable().optional(),
    emblem: z.enum(BADGE_EMBLEMS.map((e) => e.key) as [string, ...string[]]),
    tier: z.enum(BADGE_TIERS.map((t) => t.key) as [string, ...string[]]),
    active: z.boolean().default(true),
  })
  .superRefine((b, ctx) => {
    if (b.rule === "WORK_COMPLETED" && !b.workId) ctx.addIssue({ code: "custom", path: ["workId"], message: "Chọn tác phẩm." });
    if (b.rule !== "WORK_COMPLETED" && !b.threshold) ctx.addIssue({ code: "custom", path: ["threshold"], message: "Nhập số N." });
  });
export type BadgeInput = z.infer<typeof badgeInputSchema>;
