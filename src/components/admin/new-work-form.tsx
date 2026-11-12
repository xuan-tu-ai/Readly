"use client";

import { useActionState } from "react";
import { createWorkAction } from "@/app/actions/admin-content";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { Label } from "@/components/ui/label";
import { GENRES, GENRE_LABEL } from "@/lib/catalog";
import { initialFormState } from "@/lib/form-state";
import { selectClass } from "./fields";

export function NewWorkForm() {
  const [state, formAction] = useActionState(createWorkAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <Field label="Tên tác phẩm" name="title" required defaultValue={state.values?.title} error={state.fieldErrors?.title} />
      <Field label="Tác giả" name="author" required defaultValue={state.values?.author} error={state.fieldErrors?.author} />
      <div className="grid gap-1.5">
        <Label htmlFor="new-genre">Thể loại</Label>
        <select id="new-genre" name="genre" className={selectClass} defaultValue={state.values?.genre ?? "THO"}>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {GENRE_LABEL[g]}
            </option>
          ))}
        </select>
      </div>
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start uppercase">Tạo tác phẩm</SubmitButton>
    </form>
  );
}
