import { describe, expect, it } from "vitest";
import { QUIZ, answerWeights, quizAnswersSchema, rankWorks, workFeatures, type RankableWork } from "@/lib/quiz";

function work(partial: Partial<RankableWork> & { id: string }): RankableWork {
  return {
    title: partial.id,
    genre: "TRUYEN_NGAN",
    difficulty: 2,
    estMinutes: 30,
    status: "PUBLISHED",
    tags: [],
    ...partial,
  };
}

const poemLover = {
  genre: "tho",
  length: "short",
  mood: "tru-tinh",
  theme: "gia-dinh",
  challenge: "easy",
  focus: "language",
};

describe("quiz definition", () => {
  it("has 5–8 questions with unique ids and options", () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(5);
    expect(QUIZ.length).toBeLessThanOrEqual(8);
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
    for (const q of QUIZ) expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
  });
});

describe("quizAnswersSchema", () => {
  it("accepts a complete answer set and drops unknown keys", () => {
    expect(quizAnswersSchema.parse({ ...poemLover, extra: "x" })).toEqual(poemLover);
  });

  it("rejects missing answers and options from another question", () => {
    const missing: Record<string, string> = { ...poemLover };
    delete missing.theme;
    expect(quizAnswersSchema.safeParse(missing).success).toBe(false);
    expect(quizAnswersSchema.safeParse({ ...poemLover, genre: "gia-dinh" }).success).toBe(false);
  });
});

describe("answerWeights", () => {
  it("sums weights across questions", () => {
    const weights = answerWeights(poemLover);
    expect(weights["genre:THO"]).toBe(3 + 2); // genre question + focus question
    expect(weights["tag:tru-tinh"]).toBe(2 + 1); // mood + focus
    expect(weights["len:short"]).toBe(2);
  });
});

describe("workFeatures", () => {
  it("covers genre, length, difficulty and tags", () => {
    const features = workFeatures(
      work({ id: "a", genre: "THO", estMinutes: 10, difficulty: 1, tags: [{ slug: "gia-dinh", label: "Gia đình" }] }),
    );
    expect(features).toEqual(["genre:THO", "len:short", "diff:1", "tag:gia-dinh"]);
  });
});

describe("rankWorks", () => {
  const shortFamilyPoem = work({
    id: "poem",
    title: "Bài thơ",
    genre: "THO",
    estMinutes: 10,
    difficulty: 1,
    tags: [
      { slug: "gia-dinh", label: "Gia đình" },
      { slug: "tru-tinh", label: "Trữ tình" },
    ],
  });
  const longWarNovel = work({
    id: "novel",
    title: "Tiểu thuyết",
    genre: "TIEU_THUYET",
    estMinutes: 120,
    difficulty: 3,
    tags: [{ slug: "chien-tranh", label: "Chiến tranh & lịch sử" }],
  });

  it("puts the best match first and explains why", () => {
    const [first, ...rest] = rankWorks([longWarNovel, shortFamilyPoem], poemLover);
    expect(first.work.id).toBe("poem");
    expect(first.reasons).toHaveLength(3);
    expect(first.reasons[0]).toBe("thể loại thơ");
    expect(rest.map((r) => r.work.id)).not.toContain("novel"); // no matching feature at all
  });

  it("breaks ties: readable before coming soon, then by title", () => {
    const a = work({ id: "a", title: "B", status: "COMING_SOON" });
    const b = work({ id: "b", title: "C" });
    const c = work({ id: "c", title: "A" });
    const answers = { ...poemLover, genre: "truyen" };
    expect(rankWorks([a, b, c], answers).map((r) => r.work.id)).toEqual(["c", "b", "a"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => work({ id: String(i), genre: "THO" }));
    expect(rankWorks(many, poemLover, 4)).toHaveLength(4);
  });
});
