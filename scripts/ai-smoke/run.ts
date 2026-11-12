/**
 * Live smoke test of every AI task against the configured provider.
 *
 *   npm run ai:smoke                          # uses AI_PROVIDER / OPENAI_* from .env
 *   npm run ai:smoke -- --model=mimo-v2.5:free --only=grade,draft --repeat=2 --out=report.json
 *
 * Calls the real model (network, quota). Not part of `npm test` or CI.
 * Prompts are built by the same functions the app uses, from fixed sample
 * material (fixture.ts), and checked against the schemas plus extra rules.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { AiConfigError, AiRetryableError, createAiProvider, type StructuredRequest } from "../../src/lib/ai";
import {
  buildDraftDetailRequest,
  buildDraftMatchRequest,
  buildDraftQuestionsRequest,
  buildDraftRubricRequest,
  type DraftQuestion,
} from "../../src/lib/ai/drafts";
import { buildGradingRequest, buildPredictionRequest } from "../../src/server/grading/prompts";
import { DRAFT_RUBRIC_CASE, GRADING_CASES, POEM, POEM_TEXT, PREDICTION_CASE, PROSE } from "./fixture";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/u, "").split("=");
    return [k, v ?? "true"];
  }),
);
const only = new Set((args.only ?? "grade,predict,draft").split(","));
const repeat = Math.max(1, Number(args.repeat ?? 1));
const env: Record<string, string | undefined> = { ...process.env, ...(args.model ? { OPENAI_MODEL: args.model } : {}) };
const ai = createAiProvider(env);
const modelLabel = ai.name === "openai" ? env.OPENAI_MODEL : ai.name === "gemini" ? env.GEMINI_MODEL : "mock";

type Row = { task: string; case: string; ok: boolean; ms: number; attempts: number; problems: string[]; retries: string[]; output?: unknown; error?: string };
const rows: Row[] = [];

/** Same policy as the job queue: retry retryable failures, give up on config errors. */
async function call<T>(request: StructuredRequest<T>, label: string, check: (out: T) => string[]): Promise<T | null> {
  const started = Date.now();
  let attempts = 0;
  const retries: string[] = [];
  for (;;) {
    attempts++;
    try {
      const out = await ai.generateStructured(request);
      const problems = check(out);
      rows.push({ task: request.task, case: label, ok: problems.length === 0, ms: Date.now() - started, attempts, problems, retries, output: out });
      return out;
    } catch (error) {
      const retry = error instanceof AiRetryableError && attempts < 3;
      if (retry) {
        retries.push(describe(error));
        await new Promise((r) => setTimeout(r, 1500 * attempts));
        continue;
      }
      rows.push({ task: request.task, case: label, ok: false, ms: Date.now() - started, attempts, problems: ["lỗi"], retries, error: describe(error) });
      if (error instanceof AiConfigError) throw error;
      return null;
    }
  }
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause ? `${error.message} (${String(error.cause).replace(/\s+/gu, " ").slice(0, 240)})` : error.message;
}

const VIETNAMESE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu;
function vietnamese(...texts: (string | null | undefined)[]) {
  return texts.every((t) => !t || VIETNAMESE.test(t)) ? [] : ["không phải tiếng Việt"];
}
function sentences(text: string) {
  return text.split(/(?<=[.!?…])\s+/u).filter((s) => s.trim().length > 0).length;
}

function print(title: string, body: unknown) {
  console.log(`\n── ${title}`);
  console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

async function grading(round: number) {
  for (const c of GRADING_CASES) {
    const sourceText = c.type === "SHORT" ? POEM.segments[0].text : POEM_TEXT;
    const request = buildGradingRequest({ ...c, sourceText });
    const out = await call(request, `${c.id}#${round}`, (o) => [
      ...(o.level === c.expected ? [] : [`mức ${o.level}, mong đợi ${c.expected}`]),
      ...vietnamese(o.strengths, o.improvements),
      ...(sentences(o.strengths) > 4 || sentences(o.improvements ?? "") > 4 ? ["nhận xét dài quá 3 câu"] : []),
    ]);
    if (out) print(`${c.id} (${c.note}) → ${out.level} [mong đợi ${c.expected}]`, `+ ${out.strengths}\n→ ${out.improvements}`);
  }
}

async function prediction(round: number) {
  const out = await call(
    buildPredictionRequest({ ...PREDICTION_CASE, sourceText: POEM_TEXT }),
    `du-doan#${round}`,
    (o) => [...vietnamese(o.feedback), ...(sentences(o.feedback) > 5 ? ["dài quá 4 câu"] : [])],
  );
  if (out) print("so sánh dự đoán", out.feedback);
}

function checkQuestions(questions: DraftQuestion[], segmentCount: number): string[] {
  const problems: string[] = [];
  const pre = questions.filter((q) => q.stage === "PRE");
  if (pre.length !== 1 || pre[0].type !== "PREDICTION") problems.push(`PRE cần đúng 1 câu PREDICTION (có ${pre.map((q) => q.type).join(",") || "0"})`);
  for (const [i, q] of questions.entries()) {
    const at = `câu ${i + 1} (${q.stage}/${q.type})`;
    if (q.stage === "PRE" && q.type !== "PREDICTION") problems.push(`${at}: PRE chỉ được PREDICTION`);
    if (q.stage !== "PRE" && q.type === "PREDICTION") problems.push(`${at}: PREDICTION ngoài PRE`);
    if (q.stage === "DURING" && q.type === "ESSAY") problems.push(`${at}: ESSAY trong DURING`);
    if (q.stage === "DURING" && (q.segment === null || q.segment > segmentCount)) problems.push(`${at}: segment ${q.segment} không hợp lệ`);
    if (q.type === "MCQ") {
      const n = q.options?.length ?? 0;
      if (n < 3) problems.push(`${at}: chỉ ${n} lựa chọn`);
      if (q.correctIndex === null || q.correctIndex >= n) problems.push(`${at}: correctIndex ${q.correctIndex} ngoài phạm vi`);
      if (!q.explanation) problems.push(`${at}: thiếu giải thích`);
      const lengths = q.options?.map((o) => o.length) ?? [];
      const right = q.correctIndex !== null ? lengths[q.correctIndex] : undefined;
      const others = lengths.filter((_, j) => j !== q.correctIndex);
      if (right !== undefined && others.length > 0 && right > 1.4 * Math.max(...others)) problems.push(`${at}: đáp án đúng dài nổi bật`);
    }
    if ((q.type === "SHORT" || q.type === "ESSAY") && (!q.rubric || !q.keyPoints?.length)) problems.push(`${at}: thiếu rubric/ý chính`);
    if (q.type === "ESSAY" && !q.outline) problems.push(`${at}: thiếu dàn ý`);
    problems.push(...vietnamese(q.prompt).map((p) => `${at}: ${p}`));
  }
  for (let s = 1; s <= segmentCount; s++) {
    if (!questions.some((q) => q.stage === "DURING" && q.type === "MCQ" && q.segment === s)) problems.push(`phân đoạn ${s} thiếu câu MCQ`);
  }
  if (!questions.some((q) => q.stage === "POST" && q.type === "ESSAY")) problems.push("POST thiếu câu ESSAY");
  return problems;
}

async function drafts(round: number) {
  const qs = await call(
    buildDraftQuestionsRequest({ title: POEM.title, author: POEM.author, segments: POEM.segments }),
    `bo-cau-hoi#${round}`,
    (o) => checkQuestions(o.questions, POEM.segments.length),
  );
  if (qs) {
    print(
      "soạn bộ câu hỏi",
      qs.questions
        .map((q) => {
          const head = `[${q.stage}${q.segment ? ` đoạn ${q.segment}` : ""} · ${q.type}] ${q.prompt}`;
          if (q.type === "MCQ") return `${head}\n${q.options?.map((o, i) => `   ${i === q.correctIndex ? "✔" : " "} ${o}`).join("\n")}\n   ↳ ${q.explanation}`;
          if (q.type === "SHORT" || q.type === "ESSAY") return `${head}\n   ý chính: ${q.keyPoints?.join(" | ")}`;
          return head;
        })
        .join("\n"),
    );
  }

  const rubric = await call(buildDraftRubricRequest(DRAFT_RUBRIC_CASE), `rubric#${round}`, (o) => vietnamese(o.rubric.dat, ...o.keyPoints));
  if (rubric) print("soạn rubric", rubric);

  const match = await call(buildDraftMatchRequest({ title: PROSE.title, text: PROSE.text }), `ghep-cap#${round}`, (o) => {
    const lefts = o.pairs.map((p) => p.left.toLowerCase());
    return [
      ...(new Set(lefts).size === lefts.length ? [] : ["vế trái bị trùng"]),
      ...o.pairs.flatMap((p) => vietnamese(p.right)),
    ];
  });
  if (match) print("soạn mini game Ghép cặp", match.pairs.map((p) => `${p.left} ↔ ${p.right}`).join("\n"));

  const detail = await call(buildDraftDetailRequest({ title: PROSE.title, text: PROSE.text }), `doan-chi-tiet#${round}`, (o) =>
    o.items.flatMap((item, i) => [
      ...(item.text.includes("___") ? [] : [`câu ${i + 1}: thiếu "___"`]),
      ...(item.answer < item.options.length ? [] : [`câu ${i + 1}: answer ${item.answer} ngoài phạm vi`]),
      ...(new Set(item.options).size === item.options.length ? [] : [`câu ${i + 1}: lựa chọn trùng`]),
    ]),
  );
  if (detail) {
    print(
      "soạn mini game Đoán chi tiết",
      detail.items.map((it) => `${it.text}\n${it.options.map((o, i) => `   ${i === it.answer ? "✔" : " "} ${o}`).join("\n")}`).join("\n"),
    );
  }
}

async function main() {
  console.log(`Provider: ${ai.name} · model: ${modelLabel} · lặp ${repeat} lần · nhóm: ${[...only].join(", ")}`);
  for (let round = 1; round <= repeat; round++) {
    if (only.has("grade")) await grading(round);
    if (only.has("predict")) await prediction(round);
    if (only.has("draft")) await drafts(round);
  }

  console.log("\n════════ Tổng kết ════════");
  for (const r of rows) {
    const status = r.ok ? "OK  " : r.error ? "LỖI " : "CHÚ Ý";
    const extra = r.error ?? r.problems.join("; ");
    console.log(`${status} ${r.case.padEnd(22)} ${String(r.ms).padStart(6)}ms ×${r.attempts}  ${extra}`);
    for (const reason of r.retries) console.log(`       ↻ thử lại vì: ${reason}`);
  }
  const graded = rows.filter((r) => r.task === "grade-answer" && !r.error);
  const agree = graded.filter((r) => !r.problems.some((p) => p.startsWith("mức "))).length;
  const failures = rows.filter((r) => r.error).length;
  const avg = Math.round(rows.reduce((s, r) => s + r.ms, 0) / Math.max(rows.length, 1));
  console.log(
    `\n${rows.length} lần gọi · ${failures} lỗi · chấm khớp mức mong đợi ${agree}/${graded.length} · trung bình ${avg}ms`,
  );
  if (args.out) {
    writeFileSync(args.out, JSON.stringify({ provider: ai.name, model: modelLabel, at: new Date().toISOString(), rows }, null, 2));
    console.log(`Đã ghi báo cáo: ${args.out}`);
  }
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
