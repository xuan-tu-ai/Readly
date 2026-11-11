import { z } from "zod";
import type { Genre } from "@/generated/prisma/enums";
import { GENRE_LABEL, LENGTH_LABEL, difficultyLabel, lengthBucket, type LengthBucket } from "./catalog";

/**
 * Interest quiz – rule-based, no AI.
 *
 * Every work has a set of *features*: `genre:THO`, `tag:tru-tinh`,
 * `len:short`, `diff:2`. Each quiz option adds weights to some features.
 * A work's score is the sum of the weights of the features it has, and the
 * features that contributed most become the "why" shown to the student.
 */

export type Feature = `genre:${Genre}` | `tag:${string}` | `len:${LengthBucket}` | `diff:${1 | 2 | 3}`;
type Weights = Partial<Record<Feature, number>>;

export type QuizOption = { id: string; label: string; weights: Weights };
export type QuizQuestion = { id: string; prompt: string; options: QuizOption[] };

export const QUIZ: QuizQuestion[] = [
  {
    id: "genre",
    prompt: "Bạn thích đọc thể loại nào nhất?",
    options: [
      { id: "tho", label: "Thơ – ngắn gọn, giàu hình ảnh", weights: { "genre:THO": 3 } },
      { id: "truyen", label: "Truyện – có nhân vật và câu chuyện", weights: { "genre:TRUYEN_NGAN": 3, "genre:TIEU_THUYET": 2 } },
      { id: "kich", label: "Kịch – xung đột và lời thoại", weights: { "genre:KICH": 3 } },
      { id: "ki-nghi-luan", label: "Kí và nghị luận – người thật, ý tưởng thật", weights: { "genre:KI": 2, "genre:NGHI_LUAN": 2 } },
    ],
  },
  {
    id: "length",
    prompt: "Một buổi đọc lý tưởng của bạn dài bao lâu?",
    options: [
      { id: "short", label: "Dưới 20 phút", weights: { "len:short": 2 } },
      { id: "medium", label: "Khoảng nửa tiếng đến một tiếng", weights: { "len:medium": 2 } },
      { id: "long", label: "Càng dài càng tốt", weights: { "len:long": 2 } },
    ],
  },
  {
    id: "mood",
    prompt: "Bạn muốn tác phẩm để lại cảm xúc gì?",
    options: [
      { id: "tru-tinh", label: "Nhẹ nhàng, sâu lắng", weights: { "tag:tru-tinh": 2 } },
      { id: "hao-hung", label: "Hào hùng, mạnh mẽ", weights: { "tag:hao-hung": 2, "tag:bi-trang": 1 } },
      { id: "bi-trang", label: "Day dứt, xúc động", weights: { "tag:bi-trang": 2, "tag:than-phan": 1 } },
      { id: "hai-huoc", label: "Vui, hóm hỉnh", weights: { "tag:hai-huoc": 2 } },
      { id: "suy-tu", label: "Khiến mình suy nghĩ", weights: { "tag:suy-tu": 2 } },
    ],
  },
  {
    id: "theme",
    prompt: "Chủ đề nào làm bạn tò mò nhất?",
    options: [
      { id: "gia-dinh", label: "Gia đình", weights: { "tag:gia-dinh": 3 } },
      { id: "que-huong", label: "Quê hương, thiên nhiên", weights: { "tag:que-huong": 2, "tag:thien-nhien": 2 } },
      { id: "chien-tranh", label: "Chiến tranh và lịch sử", weights: { "tag:chien-tranh": 3 } },
      { id: "tinh-yeu", label: "Tình yêu", weights: { "tag:tinh-yeu": 3 } },
      { id: "con-nguoi", label: "Số phận con người, xã hội", weights: { "tag:than-phan": 2, "tag:xa-hoi": 2 } },
    ],
  },
  {
    id: "challenge",
    prompt: "Bạn muốn mức độ thử thách thế nào?",
    options: [
      { id: "easy", label: "Nhẹ nhàng, dễ vào", weights: { "diff:1": 2 } },
      { id: "medium", label: "Vừa phải", weights: { "diff:2": 2 } },
      { id: "hard", label: "Thử thách, cần suy ngẫm", weights: { "diff:3": 2 } },
    ],
  },
  {
    id: "focus",
    prompt: "Khi đọc, bạn hay chú ý điều gì nhất?",
    options: [
      { id: "story", label: "Nhân vật và diễn biến", weights: { "genre:TRUYEN_NGAN": 1, "genre:TIEU_THUYET": 1, "genre:KICH": 1 } },
      { id: "language", label: "Ngôn từ và hình ảnh", weights: { "genre:THO": 2, "tag:tru-tinh": 1 } },
      { id: "ideas", label: "Ý tưởng và lập luận", weights: { "genre:NGHI_LUAN": 2, "tag:suy-tu": 1 } },
      { id: "real", label: "Con người thật, sự kiện thật", weights: { "genre:KI": 2 } },
    ],
  },
];

export type QuizAnswers = Record<string, string>;

/** All questions answered, each with one of its own options. */
export const quizAnswersSchema = z
  .record(z.string(), z.string())
  .superRefine((answers, ctx) => {
    for (const question of QUIZ) {
      const answer = answers[question.id];
      if (!answer) {
        ctx.addIssue({ code: "custom", message: "Vui lòng trả lời tất cả câu hỏi.", path: [question.id] });
      } else if (!question.options.some((o) => o.id === answer)) {
        ctx.addIssue({ code: "custom", message: "Lựa chọn không hợp lệ.", path: [question.id] });
      }
    }
  })
  .transform((answers) => Object.fromEntries(QUIZ.map((q) => [q.id, answers[q.id]])) as QuizAnswers);

export function answerWeights(answers: QuizAnswers): Weights {
  const total: Weights = {};
  for (const question of QUIZ) {
    const option = question.options.find((o) => o.id === answers[question.id]);
    if (!option) continue;
    for (const [feature, weight] of Object.entries(option.weights) as [Feature, number][]) {
      total[feature] = (total[feature] ?? 0) + weight;
    }
  }
  return total;
}

export type RankableWork = {
  id: string;
  title: string;
  genre: Genre;
  difficulty: number;
  estMinutes: number;
  status: string;
  tags: { slug: string; label: string }[];
};

export function workFeatures(work: RankableWork): Feature[] {
  return [
    `genre:${work.genre}`,
    `len:${lengthBucket(work.estMinutes)}`,
    `diff:${work.difficulty as 1 | 2 | 3}`,
    ...work.tags.map((t) => `tag:${t.slug}` as const),
  ];
}

function featureReason(feature: Feature, work: RankableWork): string {
  const [kind, value] = feature.split(":") as [string, string];
  switch (kind) {
    case "genre":
      return `thể loại ${GENRE_LABEL[value as Genre].toLowerCase()}`;
    case "len":
      return `độ dài ${LENGTH_LABEL[value as LengthBucket].toLowerCase()}`;
    case "diff":
      return `độ khó ${difficultyLabel(Number(value)).toLowerCase()}`;
    default:
      return work.tags.find((t) => t.slug === value)?.label.toLowerCase() ?? value;
  }
}

export type Recommendation<W extends RankableWork> = {
  work: W;
  score: number;
  reasons: string[];
};

const collator = new Intl.Collator("vi");

/**
 * Ranks works by how well they match the answers. Ties: readable works first,
 * then by title. Works with no matching feature are dropped.
 */
export function rankWorks<W extends RankableWork>(works: W[], answers: QuizAnswers, limit = 6): Recommendation<W>[] {
  const weights = answerWeights(answers);
  return works
    .map((work) => {
      const contributions = workFeatures(work)
        .map((feature) => ({ feature, weight: weights[feature] ?? 0 }))
        .filter((c) => c.weight > 0)
        .sort((a, b) => b.weight - a.weight);
      return {
        work,
        score: contributions.reduce((sum, c) => sum + c.weight, 0),
        reasons: contributions.slice(0, 3).map((c) => featureReason(c.feature, work)),
      };
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.work.status === "PUBLISHED") - Number(a.work.status === "PUBLISHED") ||
        collator.compare(a.work.title, b.work.title),
    )
    .slice(0, limit);
}

export function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) return "";
  const text = reasons.join(", ");
  return `Hợp với bạn: ${text}.`;
}
