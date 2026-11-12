"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClassSchema, resetPasswordSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/dal";
import { resetPassword } from "@/server/services/accounts";
import {
  createClass,
  regenerateClassCode,
  removeStudentFromClass,
  setClassCodeActive,
} from "@/server/services/classes";
import {
  createAssignment,
  deleteAssignment,
  remindStudents,
  updateAssignmentDue,
} from "@/server/services/assignments";
import { reportAiFeedback, reviewAnswer, TEACHER_NOTE_MAX } from "@/server/services/teacher";
import { formObject, invalid, toFormError, type FormState } from "./state";

export async function createClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = createClassSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const cls = await createClass(user, parsed.data.name);
    refresh();
    return { ok: true, message: `Đã tạo lớp ${cls.name} – mã lớp ${cls.code}.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

const classIdSchema = z.object({ classId: z.string().min(1) });

export async function toggleClassCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = classIdSchema.extend({ active: z.enum(["true", "false"]) }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await setClassCodeActive(user, parsed.data.classId, parsed.data.active === "true");
    refresh();
    return { ok: true };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function regenerateClassCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = classIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const cls = await regenerateClassCode(user, parsed.data.classId);
    refresh();
    return { ok: true, message: `Mã lớp mới: ${cls.code}` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function removeStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = classIdSchema.extend({ studentId: z.string().min(1) }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await removeStudentFromClass(user, parsed.data.classId, parsed.data.studentId);
  } catch (error) {
    return toFormError(error, formData);
  }
  // From the student's own page, go back to the class list (the student page is gone).
  const returnTo = formData.get("returnTo");
  if (typeof returnTo === "string" && returnTo.startsWith("/teacher/")) redirect(returnTo);
  refresh();
  return { ok: true };
}

export async function resetStudentPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await resetPassword(user, parsed.data.userId, parsed.data.newPassword);
    return { ok: true, message: "Đã đặt lại mật khẩu. Học sinh cần đăng nhập lại." };
  } catch (error) {
    return toFormError(error, formData);
  }
}

// ───────────────────────── Assignments & reminders (phase 6) ─────────────────────────

const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Chọn hạn đọc." });

export async function createAssignmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = classIdSchema
    .extend({ workId: z.string().min(1, { error: "Chọn tác phẩm." }), dueDate })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const { work, notified } = await createAssignment(user, parsed.data);
    refresh();
    return { ok: true, message: `Đã giao “${work.title}” và báo cho ${notified} học sinh.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

const assignmentIdSchema = z.object({ assignmentId: z.string().min(1) });

export async function updateAssignmentDueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = assignmentIdSchema.extend({ dueDate }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await updateAssignmentDue(user, parsed.data.assignmentId, parsed.data.dueDate);
    refresh();
    return { ok: true, message: "Đã đổi hạn đọc." };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function deleteAssignmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = assignmentIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await deleteAssignment(user, parsed.data.assignmentId);
    refresh();
    return { ok: true };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function remindStudentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = assignmentIdSchema
    .extend({ message: z.string().trim().max(300, { error: "Lời nhắn tối đa 300 ký tự." }).optional() })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const studentIds = formData.getAll("studentId").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (studentIds.length === 0) return { error: "Chọn ít nhất một học sinh.", values: formObject(formData) };
  try {
    const { sent, skipped } = await remindStudents(user, parsed.data.assignmentId, studentIds, parsed.data.message ?? null);
    refresh();
    if (sent === 0) return { ok: true, message: "Không gửi thêm: các em đã xong hoặc vừa được nhắc trong 10 phút qua." };
    return { ok: true, message: `Đã nhắc ${sent} học sinh${skipped ? ` (bỏ qua ${skipped} em vừa được nhắc hoặc đã xong)` : ""}.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

// ───────────────────────── Teacher review of AI feedback (spec §6.5) ─────────────────────────

const reviewSchema = z.object({
  answerId: z.string().min(1),
  level: z.enum(["", "CHUA_DAT", "DAT", "SAU_SAC"]),
  note: z.string().max(TEACHER_NOTE_MAX, { error: `Nhận xét tối đa ${TEACHER_NOTE_MAX} ký tự.` }).optional(),
});

export async function reviewAnswerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = reviewSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const { levelChanged } = await reviewAnswer(user, parsed.data.answerId, {
      level: parsed.data.level || null,
      note: parsed.data.note ?? null,
      hideAi: formData.get("hideAi") === "on",
    });
    refresh();
    return { ok: true, message: levelChanged ? "Đã lưu. Điểm của học sinh được tính lại theo mức mới." : "Đã lưu nhận xét." };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function reportAiAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("TEACHER");
  const parsed = z.object({ answerId: z.string().min(1), reason: z.string() }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await reportAiFeedback(user, parsed.data.answerId, parsed.data.reason);
    refresh();
    return { ok: true, message: "Đã gửi báo cáo cho admin." };
  } catch (error) {
    return toFormError(error, formData);
  }
}
