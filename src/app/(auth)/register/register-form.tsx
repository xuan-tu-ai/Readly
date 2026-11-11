"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";
import { CLASS_CODE_LENGTH, PASSWORD_MIN } from "@/lib/validation";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <Field
        label="Mã lớp"
        name="classCode"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={CLASS_CODE_LENGTH + 2}
        className="[&_input]:uppercase [&_input]:tracking-widest"
        required
        defaultValue={values.classCode}
        error={errors.classCode}
        hint={`${CLASS_CODE_LENGTH} ký tự, ví dụ: DEMO12`}
      />
      <Field label="Họ và tên" name="name" autoComplete="name" required defaultValue={values.name} error={errors.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={values.email}
        error={errors.email}
      />
      <Field
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint={`Ít nhất ${PASSWORD_MIN} ký tự.`}
      />
      <FormAlert state={state} />
      <SubmitButton pendingText="Đang tạo tài khoản…">Đăng ký</SubmitButton>
    </form>
  );
}
