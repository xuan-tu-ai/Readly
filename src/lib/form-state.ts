/** Shape returned by every form server action (used with useActionState). */
export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values (never passwords) so the form can be refilled after an error. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};
