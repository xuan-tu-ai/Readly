"use client";

import { useActionState } from "react";
import { createTeacherAction } from "@/app/actions/admin";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";
import { PASSWORD_MIN } from "@/lib/validation";

export function CreateTeacherForm() {
  const [state, formAction] = useActionState(createTeacherAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="grid max-w-sm gap-4" noValidate>
      <Field label="Họ và tên" name="name" required defaultValue={values.name} error={errors.name} />
      <Field label="Email" name="email" type="email" autoComplete="off" required defaultValue={values.email} error={errors.email} />
      <Field
        label="Mật khẩu ban đầu"
        name="password"
        type="text"
        autoComplete="off"
        required
        error={errors.password}
        hint={`Ít nhất ${PASSWORD_MIN} ký tự. Gửi cho giáo viên qua kênh riêng.`}
      />
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start">Tạo tài khoản</SubmitButton>
    </form>
  );
}
