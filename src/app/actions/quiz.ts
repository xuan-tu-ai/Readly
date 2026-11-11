"use server";

import { redirect } from "next/navigation";
import { quizAnswersSchema } from "@/lib/quiz";
import { requireUser } from "@/server/auth/dal";
import { saveQuizResult } from "@/server/services/quiz";
import { formObject, type FormState } from "./state";

export async function submitQuizAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("STUDENT");
  const parsed = quizAnswersSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: "Vui lòng trả lời tất cả câu hỏi." };
  await saveQuizResult(user, parsed.data);
  redirect("/student/quiz/result");
}
