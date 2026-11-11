import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { QUEUES, setJobSender } from "@/server/queue";
import { MockProvider } from "@/lib/ai";
import * as ai from "@/lib/ai";
import {
  comparePredictionJob,
  getCompletionStatus,
  getQuestionsForReader,
  gradeAnswerJob,
  markGradingFailedJob,
  submitAnswer,
} from "@/server/services/questions";
import { markSegmentsRead } from "@/server/services/reading";
import { makeUser, resetDatabase } from "../helpers/db";

const jobs: { queue: string; data: { answerId: string } }[] = [];

beforeEach(async () => {
  await resetDatabase();
  jobs.length = 0;
  setJobSender(async (queue, data) => {
    jobs.push({ queue, data: data as { answerId: string } });
  });
});

afterEach(() => vi.restoreAllMocks());

async function makeWork() {
  const work = await db.work.create({
    data: {
      slug: "tac-pham",
      title: "Tác phẩm",
      author: "Tác giả",
      authorBio: "",
      summary: "",
      genre: "THO",
      difficulty: 1,
      estMinutes: 10,
      status: "PUBLISHED",
      searchText: "tac pham",
      segments: {
        create: [
          { order: 1, content: "<p>Gió qua hàng tre, nắng vàng trên đê.</p>" },
          { order: 2, content: "<p>Đêm xuống trên sông.</p>" },
        ],
      },
    },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  const [s1, s2] = work.segments;
  const rubric = { chuaDat: "chung chung", dat: "có ý", sauSac: "đủ ý" };
  const keyPoints = ["gió qua hàng tre", "nắng vàng trên đê"];
  const mcq = await db.question.create({
    data: {
      workId: work.id,
      segmentId: s1.id,
      stage: "DURING",
      type: "MCQ",
      prompt: "Chọn?",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionId: "b",
      explanation: "Vì B.",
    },
  });
  const short = await db.question.create({
    data: { workId: work.id, segmentId: s2.id, stage: "DURING", type: "SHORT", prompt: "Vì sao?", rubric, keyPoints },
  });
  const prediction = await db.question.create({
    data: { workId: work.id, stage: "PRE", type: "PREDICTION", prompt: "Đoán xem?", required: false },
  });
  const essay = await db.question.create({
    data: { workId: work.id, stage: "POST", type: "ESSAY", prompt: "Cảm nhận", rubric, keyPoints, minWords: 5, maxWords: 50, required: false },
  });
  return { work, s1, s2, mcq, short, prediction, essay };
}

const GOOD = "Hình ảnh gió qua hàng tre và nắng vàng trên đê gợi một làng quê yên bình, gần gũi.";

describe("MCQ", () => {
  it("grades immediately, hides the answer key until resolved, then reveals it", async () => {
    const student = await makeUser("STUDENT");
    const { mcq } = await makeWork();

    let view = (await getQuestionsForReader(student.id, mcq.workId)).find((q) => q.id === mcq.id)!;
    expect(view.correctOptionId).toBeNull();

    view = await submitAnswer(student.actor, mcq.id, "a");
    expect(view.state).toMatchObject({ status: "retry", attemptsLeft: 2 });
    expect(view.correctOptionId).toBeNull();

    view = await submitAnswer(student.actor, mcq.id, "b");
    expect(view.state.status).toBe("passed");
    expect(view).toMatchObject({ correctOptionId: "b", explanation: "Vì B." });
    expect(jobs).toEqual([]);
  });

  it("refuses answers after three wrong attempts and unknown options", async () => {
    const student = await makeUser("STUDENT");
    const { mcq } = await makeWork();
    await expect(submitAnswer(student.actor, mcq.id, "z")).rejects.toThrow("Vui lòng chọn một đáp án.");
    for (let i = 0; i < 3; i++) await submitAnswer(student.actor, mcq.id, "a");
    await expect(submitAnswer(student.actor, mcq.id, "b")).rejects.toThrow("Câu hỏi này đã hoàn tất.");
  });
});

describe("open answers and AI grading", () => {
  it("queues the answer, blocks resubmission while pending, then grades it", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();

    const pending = await submitAnswer(student.actor, short.id, GOOD);
    expect(pending.state).toMatchObject({ status: "pending", attemptsUsed: 0 });
    expect(jobs).toEqual([{ queue: QUEUES.gradeAnswer, data: { answerId: pending.answers[0].id } }]);
    await expect(submitAnswer(student.actor, short.id, GOOD)).rejects.toThrow("đang chờ nhận xét");

    await gradeAnswerJob(jobs[0].data.answerId);
    const [graded] = (await getQuestionsForReader(student.id, short.workId)).filter((q) => q.id === short.id);
    expect(graded.state.status).toBe("passed");
    expect(graded.answers[0]).toMatchObject({ status: "GRADED", level: "SAU_SAC" });
    expect(graded.answers[0].strengths).toBeTruthy();
  });

  it("grading is idempotent", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const view = await submitAnswer(student.actor, short.id, GOOD);
    await gradeAnswerJob(view.answers[0].id);
    await expect(gradeAnswerJob(view.answers[0].id)).resolves.toEqual({ skipped: true });
  });

  it("a weak answer is Chưa đạt and can be retried", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const view = await submitAnswer(student.actor, short.id, "Không biết.");
    await gradeAnswerJob(view.answers[0].id);
    const again = await submitAnswer(student.actor, short.id, GOOD);
    expect(again.answers.map((a) => a.level)).toEqual(["CHUA_DAT", null]);
    expect(again.state).toMatchObject({ status: "pending", attemptsUsed: 1 });
  });

  it("AI errors propagate (so the queue retries); a dead-lettered answer becomes FAILED and is free", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const failing = new MockProvider({
      "grade-answer": () => {
        throw new Error("quota");
      },
    });
    vi.spyOn(ai, "getAiProvider").mockReturnValue(failing);

    const view = await submitAnswer(student.actor, short.id, GOOD);
    await expect(gradeAnswerJob(view.answers[0].id)).rejects.toThrow("quota");

    await markGradingFailedJob(view.answers[0].id);
    const retry = await submitAnswer(student.actor, short.id, GOOD);
    expect(retry.state).toMatchObject({ status: "pending", attemptsUsed: 0 });
    expect(retry.answers.map((a) => a.status)).toEqual(["FAILED", "PENDING"]);
  });

  it("essays must respect the word range", async () => {
    const student = await makeUser("STUDENT");
    const { essay } = await makeWork();
    await expect(submitAnswer(student.actor, essay.id, "quá ngắn")).rejects.toThrow("ít nhất 5 chữ");
  });

  it("hides AI feedback the teacher hid, and applies the teacher's level", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const view = await submitAnswer(student.actor, short.id, "Không biết.");
    await gradeAnswerJob(view.answers[0].id);
    await db.answer.update({ where: { id: view.answers[0].id }, data: { aiHidden: true, teacherLevel: "DAT", teacherNote: "Cô thấy đạt." } });

    const [q] = (await getQuestionsForReader(student.id, short.workId)).filter((x) => x.id === short.id);
    expect(q.answers[0]).toMatchObject({ level: "DAT", strengths: null, improvements: null, teacherNote: "Cô thấy đạt." });
    expect(q.state.status).toBe("passed");
  });

  it("only students of a published work can answer", async () => {
    const teacher = await makeUser("TEACHER");
    const student = await makeUser("STUDENT");
    const { mcq, work } = await makeWork();
    await expect(submitAnswer(teacher.actor, mcq.id, "b")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.work.update({ where: { id: work.id }, data: { status: "COMING_SOON" } });
    await expect(submitAnswer(student.actor, mcq.id, "b")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("completion", () => {
  it("completes when all segments are read and required questions resolved, then compares the prediction", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1, s2, mcq, short, prediction } = await makeWork();

    await submitAnswer(student.actor, prediction.id, "Chắc là về làng quê.");
    await markSegmentsRead(student.actor, [s1.id, s2.id]);
    expect(await getCompletionStatus(student.id, work.id)).toMatchObject({ complete: false, owedQuestions: 2 });

    await submitAnswer(student.actor, mcq.id, "b");
    const view = await submitAnswer(student.actor, short.id, GOOD);
    expect((await getCompletionStatus(student.id, work.id)).owedQuestions).toBe(1); // pending does not count

    await gradeAnswerJob(view.answers[0].id);
    const status = await getCompletionStatus(student.id, work.id);
    expect(status).toMatchObject({ complete: true, owedQuestions: 0 });
    expect(status.completedAt).not.toBeNull();

    const compare = jobs.find((j) => j.queue === QUEUES.comparePrediction)!;
    expect(compare).toBeDefined();
    await comparePredictionJob(compare.data.answerId);
    const [pred] = (await getQuestionsForReader(student.id, work.id)).filter((q) => q.id === prediction.id);
    expect(pred.answers[0].feedback).toBeTruthy();
  });

  it("exhausted questions unlock completion; reading the last segment can complete the work", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1, s2, mcq, short } = await makeWork();
    for (let i = 0; i < 3; i++) await submitAnswer(student.actor, mcq.id, "a");
    for (let i = 0; i < 3; i++) {
      const v = await submitAnswer(student.actor, short.id, "Không biết.");
      await gradeAnswerJob(v.answers.at(-1)!.id);
    }
    await markSegmentsRead(student.actor, [s1.id]);
    expect((await getCompletionStatus(student.id, work.id)).completedAt).toBeNull();

    await markSegmentsRead(student.actor, [s2.id]);
    expect((await getCompletionStatus(student.id, work.id)).completedAt).not.toBeNull();
    expect(await db.workCompletion.count()).toBe(1);
  });
});
