"use server";

import { refresh } from "next/cache";
import { joinClassSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/dal";
import { joinClassByCode } from "@/server/services/classes";
import { formObject, invalid, toFormError, type FormState } from "./state";

export async function joinClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("STUDENT");
  const parsed = joinClassSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const cls = await joinClassByCode(user, parsed.data.classCode);
    refresh();
    return { ok: true, message: `Đã chuyển sang lớp ${cls.name}.` };
  } catch (error) {
    return toFormError(error, formData);
  }
}
