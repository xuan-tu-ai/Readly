import type { QuestionStage, QuestionType } from "@/generated/prisma/enums";

export const STAGE_LABEL: Record<QuestionStage, string> = { PRE: "Trước khi đọc", DURING: "Trong khi đọc", POST: "Sau khi đọc" };

export const TYPE_LABEL: Record<QuestionType, string> = {
  PREDICTION: "Dự đoán",
  MCQ: "Trắc nghiệm",
  SHORT: "Tự luận ngắn",
  ESSAY: "Đoạn cảm nhận",
};
