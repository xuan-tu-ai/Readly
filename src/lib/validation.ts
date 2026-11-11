import { z } from "zod";

export const CLASS_CODE_LENGTH = 6;
export const PASSWORD_MIN = 8;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Email không hợp lệ." }));

const password = z
  .string()
  .min(PASSWORD_MIN, { error: `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.` })
  .max(128, { error: "Mật khẩu quá dài." });

const personName = z
  .string()
  .trim()
  .min(2, { error: "Họ tên cần ít nhất 2 ký tự." })
  .max(80, { error: "Họ tên quá dài." });

/** Codes are case-insensitive for users; stored upper-case without spaces. */
export const classCode = z
  .string()
  .transform((s) => s.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z.string().length(CLASS_CODE_LENGTH, {
      error: `Mã lớp gồm ${CLASS_CODE_LENGTH} ký tự.`,
    }),
  );

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Vui lòng nhập mật khẩu." }),
});

export const registerStudentSchema = z.object({
  name: personName,
  email,
  password,
  classCode,
});

export const createTeacherSchema = z.object({
  name: personName,
  email,
  password,
});

export const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập tên lớp." })
    .max(60, { error: "Tên lớp quá dài." }),
});

export const joinClassSchema = z.object({ classCode });

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: password,
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

/** Flatten zod issues into `{ field: firstMessage }` for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
