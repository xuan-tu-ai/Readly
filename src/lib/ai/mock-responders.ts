import { normalizeSearch } from "@/lib/catalog";
import type { StructuredRequest } from "./types";

/**
 * Deterministic stand-ins for the model, used in tests and in demo mode
 * (AI_PROVIDER=mock). They behave plausibly so the whole flow can be shown
 * without network or quota.
 */

export type GradingHint = { answer: string; keyPoints: string[]; type: "SHORT" | "ESSAY" };

/** How many key points the answer mentions (accent-insensitive word overlap). */
export function keyPointCoverage(answer: string, keyPoints: string[]): number {
  const words = new Set(normalizeSearch(answer).split(" "));
  return keyPoints.filter((point) => {
    const pointWords = normalizeSearch(point).split(" ").filter((w) => w.length > 2);
    if (pointWords.length === 0) return false;
    const hits = pointWords.filter((w) => words.has(w)).length;
    return hits / pointWords.length >= 0.5;
  }).length;
}

export function mockGrade(request: StructuredRequest<unknown>) {
  const hint = request.mockHint as GradingHint;
  const words = hint.answer.trim().split(/\s+/u).filter(Boolean).length;
  const covered = keyPointCoverage(hint.answer, hint.keyPoints);
  const enough = hint.type === "ESSAY" ? words >= 150 : words >= 8;

  if (!enough || (hint.keyPoints.length > 0 && covered === 0)) {
    return {
      level: "CHUA_DAT",
      strengths: "Bạn đã bắt đầu trả lời câu hỏi.",
      improvements: "Hãy viết cụ thể hơn và dẫn chứng từ văn bản để làm rõ ý của mình.",
    };
  }
  if (hint.keyPoints.length > 0 && covered >= Math.ceil(hint.keyPoints.length * 0.6)) {
    return {
      level: "SAU_SAC",
      strengths: "Câu trả lời bám sát văn bản và nêu được các ý quan trọng.",
      improvements: "Bạn có thể nói thêm cảm nhận riêng của mình.",
    };
  }
  return {
    level: "DAT",
    strengths: "Bạn đã nêu được ý chính của câu hỏi.",
    improvements: "Thử bổ sung thêm dẫn chứng từ văn bản để câu trả lời sâu sắc hơn.",
  };
}

export function mockComparePrediction() {
  return {
    feedback:
      "Dự đoán của bạn đã nắm được một phần không khí của tác phẩm. So với nội dung thật, hãy để ý xem điều gì khiến bạn bất ngờ nhất.",
  };
}
