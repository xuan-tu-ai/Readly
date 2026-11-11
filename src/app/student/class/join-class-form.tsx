"use client";

import { useActionState } from "react";
import { joinClassAction } from "@/app/actions/student";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";
import { CLASS_CODE_LENGTH } from "@/lib/validation";

export function JoinClassForm() {
  const [state, formAction] = useActionState(joinClassAction, initialFormState);
  return (
    <form action={formAction} className="grid max-w-sm gap-4" noValidate>
      <Field
        label="Mã lớp"
        name="classCode"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={CLASS_CODE_LENGTH + 2}
        className="[&_input]:uppercase [&_input]:tracking-widest"
        required
        defaultValue={state.ok ? undefined : state.values?.classCode}
        error={state.fieldErrors?.classCode}
      />
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start">Xác nhận</SubmitButton>
    </form>
  );
}
