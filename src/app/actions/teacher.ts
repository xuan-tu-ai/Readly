"use server";

import { refresh } from "next/cache";
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
    refresh();
    return { ok: true };
  } catch (error) {
    return toFormError(error, formData);
  }
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
