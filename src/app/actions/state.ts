import { z } from "zod";
import { fieldErrors } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";
import { DomainError } from "@/server/errors";

export type { FormState };

/** Submitted text fields minus anything that looks like a password. */
export function echoValues(formData?: FormData): Record<string, string> | undefined {
  if (!formData) return undefined;
  const values = formObject(formData);
  for (const key of Object.keys(values)) {
    if (/password/i.test(key)) delete values[key];
  }
  return values;
}

export function invalid(error: z.ZodError, formData?: FormData): FormState {
  return { fieldErrors: fieldErrors(error), values: echoValues(formData) };
}

/** Turns expected business errors into a form message; rethrows anything else. */
export function toFormError(error: unknown, formData?: FormData): FormState {
  if (error instanceof DomainError) return { error: error.message, values: echoValues(formData) };
  throw error;
}

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
