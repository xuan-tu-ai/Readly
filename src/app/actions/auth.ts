"use server";

import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { loginSchema, registerStudentSchema } from "@/lib/validation";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/server/auth/cookie";
import { createSession, deleteSession } from "@/server/auth/sessions";
import { authenticate, registerStudent } from "@/server/services/accounts";
import { echoValues, formObject, invalid, toFormError, type FormState } from "./state";

async function signIn(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Email hoặc mật khẩu không đúng.", values: echoValues(formData) };

  await signIn(user.id);
  redirect(homePathFor(user.role));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerStudentSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  let userId: string;
  try {
    userId = (await registerStudent(parsed.data)).id;
  } catch (error) {
    return toFormError(error, formData);
  }
  await signIn(userId);
  redirect("/student");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await deleteSession(token);
  await clearSessionCookie();
  redirect("/login");
}
