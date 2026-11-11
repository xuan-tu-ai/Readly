"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState, type FormState } from "@/lib/form-state";

type Props = {
  userId: string;
  userName: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

/** Inline "Đặt lại mật khẩu" control, collapsed until opened. */
export function ResetPasswordForm({ userId, userName, action }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);

  if (!open) {
    return (
      <div className="grid gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Đặt lại mật khẩu
        </Button>
        {state.ok ? <FormAlert state={state} /> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Field
        label={`Mật khẩu mới cho ${userName}`}
        name="newPassword"
        type="text"
        autoComplete="off"
        required
        error={state.fieldErrors?.newPassword}
      />
      <FormAlert state={state} />
      <div className="flex gap-2">
        <SubmitButton size="sm">Lưu</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Đóng
        </Button>
      </div>
    </form>
  );
}
