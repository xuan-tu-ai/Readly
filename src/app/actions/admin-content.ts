"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Genre } from "@/generated/prisma/enums";
import type { DraftQuestion } from "@/lib/ai/drafts";
import { type ImportDraft } from "@/lib/content/segmenter";
import {
  badgeInputSchema,
  gameInputSchema,
  importSegmentsSchema,
  newWorkSchema,
  pointTableSchema,
  questionInputSchema,
  segmentInputSchema,
  tagInputSchema,
  workInputSchema,
  type QuestionInput,
} from "@/lib/content/schemas";
import { requireUser } from "@/server/auth/dal";
import { MAX_DOCX_BYTES, draftFromDocx } from "@/server/content/docx";
import { DomainError } from "@/server/errors";
import { createBadge, deleteBadge, resolveAiReport, updateBadge, updatePointTable } from "@/server/services/admin/gamification";
import { createGame, deleteGame, draftGame, updateGame } from "@/server/services/admin/games";
import {
  addDraftQuestions,
  createQuestion,
  deleteQuestion,
  draftQuestions,
  draftRubric,
  draftToInput,
  updateQuestion,
} from "@/server/services/admin/questions";
import {
  addSegment,
  createTag,
  createWork,
  deleteWork,
  moveSegment,
  removeSegment,
  replaceSegments,
  segmentOptions,
  updateSegment,
  updateWork,
  type ReanchorCounts,
} from "@/server/services/admin/works";
import type { ActionResult } from "./reading";
import { formObject, invalid, toFormError, type FormState } from "./state";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

/** First message of a zod error, for JSON-payload actions. */
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";

// ───────────────────────── Works ─────────────────────────

export async function createWorkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = newWorkSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  let id: string;
  try {
    id = (await createWork(user, parsed.data)).id;
  } catch (error) {
    return toFormError(error, formData);
  }
  redirect(`/admin/works/${id}`);
}

export async function updateWorkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const id = String(formData.get("id") ?? "");
  const parsed = workInputSchema.safeParse({ ...formObject(formData), tags: formData.getAll("tags") });
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await updateWork(user, id, parsed.data);
    refresh();
    return { ok: true, message: "Đã lưu thông tin tác phẩm." };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function deleteWorkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  try {
    await deleteWork(user, String(formData.get("id") ?? ""));
  } catch (error) {
    return toFormError(error, formData);
  }
  redirect("/admin/works");
}

export async function createTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = tagInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const tag = await createTag(user, parsed.data);
    refresh();
    return { ok: true, message: `Đã thêm tag “${tag.label}”.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

// ───────────────────────── Text: import and segments ─────────────────────────

/** Reads an uploaded .docx and suggests segments (nothing is saved yet). */
export async function analyzeDocxAction(formData: FormData): Promise<ActionResult<ImportDraft & { warnings: string[] }>> {
  await requireUser("ADMIN");
  const file = formData.get("file");
  const genre = z.enum(["THO", "TRUYEN_NGAN", "TIEU_THUYET", "KICH", "KI", "NGHI_LUAN"]).safeParse(formData.get("genre"));
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Chọn một tệp .docx." };
  if (!file.name.toLowerCase().endsWith(".docx")) return { ok: false, error: "Chỉ nhận tệp Word .docx (PDF hãy chuyển sang .docx trước)." };
  if (file.size > MAX_DOCX_BYTES) return { ok: false, error: "Tệp .docx tối đa 5 MB." };
  if (!genre.success) return { ok: false, error: "Thiếu thể loại." };
  return run(async () => draftFromDocx(Buffer.from(await file.arrayBuffer()), genre.data as Genre));
}

export async function saveSegmentsAction(workId: string, segments: unknown): Promise<ActionResult<ReanchorCounts>> {
  const user = await requireUser("ADMIN");
  const parsed = importSegmentsSchema.safeParse(segments);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await run(() => replaceSegments(user, workId, parsed.data));
  if (result.ok) refresh();
  return result;
}

export async function updateSegmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = segmentInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const counts = await updateSegment(user, String(formData.get("segmentId") ?? ""), parsed.data);
    refresh();
    return {
      ok: true,
      message: counts
        ? `Đã lưu. Highlight: ${counts.unchanged} giữ nguyên, ${counts.moved} được neo lại, ${counts.orphaned} không còn trong văn bản.`
        : "Đã lưu.",
    };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function segmentCommandAction(formData: FormData): Promise<void> {
  const user = await requireUser("ADMIN");
  const command = formData.get("command");
  const id = String(formData.get("id") ?? "");
  if (command === "add") await addSegment(user, id);
  else if (command === "up" || command === "down") await moveSegment(user, id, command === "up" ? -1 : 1);
  else if (command === "remove") {
    try {
      await removeSegment(user, id);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  refresh();
}

// ───────────────────────── Questions ─────────────────────────

export async function saveQuestionAction(input: { workId: string; questionId?: string; data: unknown }): Promise<ActionResult<null>> {
  const user = await requireUser("ADMIN");
  const parsed = questionInputSchema.safeParse(input.data);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await run(async () => {
    if (input.questionId) await updateQuestion(user, input.questionId, parsed.data);
    else await createQuestion(user, input.workId, parsed.data);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteQuestionAction(questionId: string): Promise<ActionResult<null>> {
  const user = await requireUser("ADMIN");
  const result = await run(async () => {
    await deleteQuestion(user, questionId);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export type QuestionDraftRow = { draft: DraftQuestion; input: QuestionInput; segmentLabel: string | null };

export async function draftQuestionsAction(workId: string): Promise<ActionResult<QuestionDraftRow[]>> {
  const user = await requireUser("ADMIN");
  return run(async () => {
    const [drafts, segments] = await Promise.all([draftQuestions(user, workId), segmentOptions(workId)]);
    const byOrder = new Map(segments.map((s) => [s.order, s.id]));
    const label = new Map(segments.map((s) => [s.order, s.title ?? `Phần ${s.order}`]));
    return drafts.map((draft) => ({
      draft,
      input: draftToInput(draft, byOrder),
      segmentLabel: draft.segment ? label.get(draft.segment) ?? null : null,
    }));
  });
}

export async function addDraftQuestionsAction(workId: string, inputs: unknown): Promise<ActionResult<number>> {
  const user = await requireUser("ADMIN");
  const parsed = z.array(questionInputSchema).min(1, { error: "Chọn ít nhất một câu." }).safeParse(inputs);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await run(() => addDraftQuestions(user, workId, parsed.data));
  if (result.ok) refresh();
  return result;
}

export async function draftRubricAction(input: {
  workId: string;
  segmentId: string | null;
  type: "SHORT" | "ESSAY";
  prompt: string;
}): Promise<ActionResult<{ rubric: { chuaDat: string; dat: string; sauSac: string }; keyPoints: string[] }>> {
  const user = await requireUser("ADMIN");
  if (input.prompt.trim().length < 5) return { ok: false, error: "Viết câu hỏi trước để AI soạn rubric." };
  return run(() => draftRubric(user, input));
}

// ───────────────────────── Mini games ─────────────────────────

export async function saveGameAction(input: { workId: string; gameId?: string; data: unknown }): Promise<ActionResult<null>> {
  const user = await requireUser("ADMIN");
  const parsed = gameInputSchema.safeParse(input.data);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await run(async () => {
    if (input.gameId) await updateGame(user, input.gameId, parsed.data);
    else await createGame(user, input.workId, parsed.data);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteGameAction(gameId: string): Promise<ActionResult<null>> {
  const user = await requireUser("ADMIN");
  const result = await run(async () => {
    await deleteGame(user, gameId);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function draftGameAction(input: { workId: string; segmentId: string; type: "MATCH" | "DETAIL" }) {
  const user = await requireUser("ADMIN");
  return run(() => draftGame(user, input));
}

// ───────────────────────── Gamification & reports ─────────────────────────

export async function updatePointTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = pointTableSchema.safeParse({ ...formObject(formData), levelThresholds: formData.getAll("levelThresholds") });
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const { students } = await updatePointTable(user, parsed.data);
    refresh();
    return { ok: true, message: `Đã lưu và tính lại điểm cho ${students} học sinh.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function saveBadgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const raw = formObject(formData);
  const parsed = badgeInputSchema.safeParse({
    ...raw,
    threshold: raw.threshold || null,
    workId: raw.workId || null,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const id = raw.badgeId;
    const { awarded } = id ? await updateBadge(user, id, parsed.data) : await createBadge(user, parsed.data);
    refresh();
    return { ok: true, message: `Đã lưu huy hiệu${awarded ? `, trao cho ${awarded} học sinh đã đủ điều kiện` : ""}.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function deleteBadgeAction(badgeId: string): Promise<ActionResult<null>> {
  const user = await requireUser("ADMIN");
  const result = await run(async () => {
    await deleteBadge(user, badgeId);
    return null;
  });
  if (result.ok) refresh();
  return result;
}

export async function resolveAiReportAction(formData: FormData): Promise<void> {
  const user = await requireUser("ADMIN");
  try {
    await resolveAiReport(user, String(formData.get("id") ?? ""));
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
  }
  refresh();
}
