"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";

/**
 * `useActionState` for a form that must keep what the teacher entered.
 * A plain `<form action>` is reset by React after every submission, which
 * desyncs controlled checkboxes and wipes a choice after a validation error;
 * submitting from `onSubmit` inside a transition skips that reset.
 */
export function useKeptForm(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, run, pending] = useActionState(action, initialFormState);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
  return { state, pending, onSubmit };
}
