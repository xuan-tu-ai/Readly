import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  countWords,
  effectiveLevel,
  isWorkComplete,
  questionState,
  validateAnswerContent,
  type AnswerLike,
} from "@/lib/questions/rules";

const graded = (attempt: number, level: AnswerLike["level"], teacherLevel: AnswerLike["teacherLevel"] = null): AnswerLike => ({
  attempt,
  status: "GRADED",
  level,
  teacherLevel,
});

describe("questionState", () => {
  it("starts unanswered and submittable", () => {
    expect(questionState("SHORT", [])).toMatchObject({ status: "unanswered", attemptsLeft: 3, canSubmit: true });
  });

  it("blocks resubmission while pending, and pending does not use an attempt", () => {
    const state = questionState("SHORT", [graded(1, "CHUA_DAT"), { attempt: 2, status: "PENDING", level: null }]);
    expect(state).toMatchObject({ status: "pending", attemptsUsed: 1, attemptsLeft: 2, canSubmit: false });
  });

  it("failed AI runs are free", () => {
    const state = questionState("ESSAY", [{ attempt: 1, status: "FAILED", level: null }]);
    expect(state).toMatchObject({ status: "unanswered", attemptsUsed: 0, canSubmit: true });
  });

  it("allows retries after Chưa đạt, up to the limit", () => {
    expect(questionState("SHORT", [graded(1, "CHUA_DAT"), graded(2, "CHUA_DAT")])).toMatchObject({
      status: "retry",
      attemptsLeft: 1,
      canSubmit: true,
    });
    const out = questionState("SHORT", [graded(1, "CHUA_DAT"), graded(2, "CHUA_DAT"), graded(3, "CHUA_DAT")]);
    expect(out).toMatchObject({ status: "exhausted", attemptsLeft: 0, canSubmit: false, flagged: true });
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("passes on Đạt or Sâu sắc and stops accepting answers", () => {
    expect(questionState("SHORT", [graded(1, "CHUA_DAT"), graded(2, "SAU_SAC")])).toMatchObject({
      status: "passed",
      canSubmit: false,
      flagged: false,
    });
  });

  it("uses the teacher's level over the AI's", () => {
    expect(effectiveLevel({ level: "CHUA_DAT", teacherLevel: "DAT" })).toBe("DAT");
    const lifted = questionState("SHORT", [graded(1, "CHUA_DAT", "DAT"), graded(2, "CHUA_DAT"), graded(3, "CHUA_DAT")]);
    expect(lifted.status).toBe("passed");
    const lowered = questionState("SHORT", [graded(1, "SAU_SAC", "CHUA_DAT")]);
    expect(lowered.status).toBe("retry");
  });

  it("MCQ: a correct answer passes; wrong answers use attempts", () => {
    expect(questionState("MCQ", [graded(1, "CHUA_DAT"), graded(2, "DAT")]).status).toBe("passed");
    expect(questionState("MCQ", [graded(1, "CHUA_DAT"), graded(2, "CHUA_DAT"), graded(3, "CHUA_DAT")]).status).toBe(
      "exhausted",
    );
  });

  it("prediction: answered once, never graded", () => {
    expect(questionState("PREDICTION", [])).toMatchObject({ status: "unanswered", canSubmit: true });
    expect(questionState("PREDICTION", [graded(1, null)])).toMatchObject({ status: "answered", canSubmit: false });
  });
});

describe("isWorkComplete", () => {
  const passed = questionState("SHORT", [graded(1, "DAT")]);
  const exhausted = questionState("SHORT", [graded(1, "CHUA_DAT"), graded(2, "CHUA_DAT"), graded(3, "CHUA_DAT")]);
  const pending = questionState("SHORT", [{ attempt: 1, status: "PENDING", level: null }]);

  it("needs every segment read and every required question resolved", () => {
    expect(isWorkComplete({ totalSegments: 3, readSegments: 3, requiredStates: [passed, exhausted] })).toBe(true);
    expect(isWorkComplete({ totalSegments: 3, readSegments: 2, requiredStates: [passed] })).toBe(false);
    expect(isWorkComplete({ totalSegments: 3, readSegments: 3, requiredStates: [passed, pending] })).toBe(false);
    expect(isWorkComplete({ totalSegments: 0, readSegments: 0, requiredStates: [] })).toBe(false);
  });
});

describe("validateAnswerContent", () => {
  const mcq = { type: "MCQ" as const, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], minWords: null, maxWords: null };
  const essay = { type: "ESSAY" as const, options: null, minWords: 5, maxWords: 8 };

  it("MCQ must pick an existing option", () => {
    expect(validateAnswerContent(mcq, "b")).toBeNull();
    expect(validateAnswerContent(mcq, "z")).toBe("Vui lòng chọn một đáp án.");
  });

  it("short answers must be non-empty and at most 1000 characters", () => {
    const short = { type: "SHORT" as const, options: null, minWords: null, maxWords: null };
    expect(validateAnswerContent(short, "   ")).toBe("Vui lòng nhập câu trả lời.");
    expect(validateAnswerContent(short, "x".repeat(1001))).toMatch(/tối đa 1000/);
    expect(validateAnswerContent(short, "Một ý.")).toBeNull();
  });

  it("essays respect the word range", () => {
    expect(validateAnswerContent(essay, "một hai ba bốn")).toBe("Đoạn văn cần ít nhất 5 chữ (hiện có 4).");
    expect(validateAnswerContent(essay, "một hai ba bốn năm")).toBeNull();
    expect(validateAnswerContent(essay, "1 2 3 4 5 6 7 8 9")).toBe("Đoạn văn tối đa 8 chữ (hiện có 9).");
  });

  it("counts words by whitespace", () => {
    expect(countWords("  Mặt trời   xuống\nbiển ")).toBe(4);
    expect(countWords("")).toBe(0);
  });
});
