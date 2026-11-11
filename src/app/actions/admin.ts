"use server";

import { refresh } from "next/cache";
import { createTeacherSchema, resetPasswordSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/dal";
import { createTeacher, resetPassword } from "@/server/services/accounts";
import { formObject, invalid, toFormError, type FormState } from "./state";

export async function createTeacherAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = createTeacherSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const teacher = await createTeacher(user, parsed.data);
    refresh();
    return { ok: true, message: `Đã tạo tài khoản cho ${teacher.name}.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function resetTeacherPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await resetPassword(user, parsed.data.userId, parsed.data.newPassword);
    return { ok: true, message: "Đã đặt lại mật khẩu. Giáo viên cần đăng nhập lại." };
  } catch (error) {
    return toFormError(error, formData);
  }
}
