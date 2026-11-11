"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <FormAlert state={state} />
      <SubmitButton pendingText="Đang đăng nhập…">Đăng nhập</SubmitButton>
    </form>
  );
}
