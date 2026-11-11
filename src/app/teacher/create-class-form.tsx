"use client";

import { useActionState } from "react";
import { createClassAction } from "@/app/actions/teacher";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";

export function CreateClassForm() {
  const [state, formAction] = useActionState(createClassAction, initialFormState);
  return (
    <form action={formAction} className="grid max-w-sm gap-4" noValidate>
      <Field
        label="Tên lớp"
        name="name"
        placeholder="Ví dụ: 12A1"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start">Tạo lớp</SubmitButton>
    </form>
  );
}
