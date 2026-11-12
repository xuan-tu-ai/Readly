"use client";

import { useActionState } from "react";
import {
  regenerateClassCodeAction,
  removeStudentAction,
  toggleClassCodeAction,
} from "@/app/actions/teacher";
import { FormAlert, SubmitButton } from "@/components/form-fields";
import { initialFormState } from "@/lib/form-state";

export function ClassCodeControls({ classId, codeActive }: { classId: string; codeActive: boolean }) {
  const [toggleState, toggle] = useActionState(toggleClassCodeAction, initialFormState);
  const [regenState, regenerate] = useActionState(regenerateClassCodeAction, initialFormState);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={toggle}>
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="active" value={String(!codeActive)} />
          <SubmitButton variant="outline" size="sm">
            {codeActive ? "Khóa mã lớp" : "Mở lại mã lớp"}
          </SubmitButton>
        </form>
        <form
          action={regenerate}
          onSubmit={(e) => {
            if (!confirm("Tạo mã mới? Mã cũ sẽ không dùng được nữa.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="classId" value={classId} />
          <SubmitButton variant="outline" size="sm">
            Tạo mã mới
          </SubmitButton>
        </form>
      </div>
      <FormAlert state={toggleState.error ? toggleState : regenState} />
    </div>
  );
}

export function RemoveStudentButton({
  classId,
  studentId,
  studentName,
  returnTo,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  /** Page to open after removal (e.g. the class list when removing from the student's page). */
  returnTo?: string;
}) {
  const [state, formAction] = useActionState(removeStudentAction, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Xóa ${studentName} khỏi lớp? Dữ liệu đọc của em vẫn được giữ.`)) e.preventDefault();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <SubmitButton variant="destructive" size="sm">
        Xóa khỏi lớp
      </SubmitButton>
      <FormAlert state={state} />
    </form>
  );
}
