"use client";

import { useActionState, useState } from "react";
import { BellRing, CalendarClock, Trash2 } from "lucide-react";
import {
  createAssignmentAction,
  deleteAssignmentAction,
  remindStudentsAction,
  updateAssignmentDueAction,
} from "@/app/actions/teacher";
import { FormAlert, SubmitButton } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import { useKeptForm } from "./use-kept-form";

export const selectClass =
  "h-10 w-full rounded-xl border-2 border-input bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

// ───────────────────────── New assignment ─────────────────────────

export function AssignForm({
  classId,
  works,
  minDate,
}: {
  classId: string;
  works: { id: string; title: string; author: string }[];
  /** Today in Vietnam, "YYYY-MM-DD": the earliest allowed deadline. */
  minDate: string;
}) {
  const [state, formAction] = useActionState(createAssignmentAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <input type="hidden" name="classId" value={classId} />
      <div className="grid gap-1.5">
        <Label htmlFor="assign-work">Tác phẩm</Label>
        <select
          id="assign-work"
          name="workId"
          className={selectClass}
          defaultValue={state.values?.workId ?? ""}
          aria-invalid={state.fieldErrors?.workId ? true : undefined}
        >
          <option value="" disabled>
            Chọn tác phẩm…
          </option>
          {works.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title} – {w.author}
            </option>
          ))}
        </select>
        {state.fieldErrors?.workId ? <p className="text-sm text-destructive">{state.fieldErrors.workId}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="assign-due">Hạn đọc (hết ngày, giờ Việt Nam)</Label>
        <input
          id="assign-due"
          type="date"
          name="dueDate"
          min={minDate}
          defaultValue={state.values?.dueDate}
          className={selectClass}
          aria-invalid={state.fieldErrors?.dueDate ? true : undefined}
        />
        {state.fieldErrors?.dueDate ? <p className="text-sm text-destructive">{state.fieldErrors.dueDate}</p> : null}
      </div>
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start uppercase">Giao bài</SubmitButton>
    </form>
  );
}

// ───────────────────────── Per assignment ─────────────────────────

export type PendingStudent = { id: string; name: string; status: string; lastReminder: string | null };

export function AssignmentActions({
  assignmentId,
  workTitle,
  dueDate,
  minDate,
  pending,
}: {
  assignmentId: string;
  workTitle: string;
  dueDate: string;
  minDate: string;
  pending: PendingStudent[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* A new list of unfinished students (after a refresh) starts with everyone selected. */}
      <RemindSheet key={pending.map((p) => p.id).join(",")} assignmentId={assignmentId} workTitle={workTitle} pending={pending} />
      <DueDateEditor assignmentId={assignmentId} dueDate={dueDate} minDate={minDate} />
      <DeleteAssignment assignmentId={assignmentId} workTitle={workTitle} />
    </div>
  );
}

function RemindSheet({ assignmentId, workTitle, pending }: { assignmentId: string; workTitle: string; pending: PendingStudent[] }) {
  const everyone = () => new Set(pending.map((p) => p.id));
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [selected, setSelected] = useState(everyone);
  const { state, pending: sending, onSubmit } = useKeptForm(async (prev: FormState, formData: FormData) => {
    const result = await remindStudentsAction(prev, formData);
    if (result.ok) {
      setOpen(false);
      setSelected(everyone());
      setSent(result.message ?? null);
    }
    return result;
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="orange" size="sm" disabled={pending.length === 0} />}>
        <BellRing aria-hidden /> Nhắc ({pending.length})
      </SheetTrigger>
      {sent ? (
        <p role="status" className="self-center text-sm font-semibold text-primary">
          {sent}
        </p>
      ) : null}
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit} className="flex min-h-full flex-col">
          <SheetHeader className="pr-12">
            <SheetTitle className="text-lg font-semibold">Nhắc đọc “{workTitle}”</SheetTitle>
            <SheetDescription>Học sinh chưa hoàn thành sẽ nhận thông báo trong app.</SheetDescription>
          </SheetHeader>
          <input type="hidden" name="assignmentId" value={assignmentId} />
          {/* The recipients come from state, not from the checkboxes' DOM state. */}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="studentId" value={id} />
          ))}
          <div className="grid gap-4 px-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">
                Đã chọn {selected.size}/{pending.length}
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)))}
              >
                {selected.size === pending.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </Button>
            </div>
            <ul className="grid gap-1">
              {pending.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="grid min-w-0">
                      <span className="font-bold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.status}
                        {p.lastReminder ? ` · đã nhắc ${p.lastReminder}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="grid gap-1.5">
              <Label htmlFor={`remind-msg-${assignmentId}`}>Lời nhắn (không bắt buộc)</Label>
              <Textarea
                id={`remind-msg-${assignmentId}`}
                name="message"
                maxLength={300}
                rows={3}
                placeholder="Để trống: hệ thống tự ghi hạn đọc và số ngày còn lại."
              />
            </div>
            {/* Success closes the sheet; only problems are shown in here. */}
            <FormAlert state={state.ok ? initialFormState : state} />
            {state.fieldErrors?.message ? <p className="text-sm text-destructive">{state.fieldErrors.message}</p> : null}
          </div>
          <SheetFooter>
            <Button type="submit" variant="orange" disabled={selected.size === 0 || sending} className="uppercase">
              {sending ? "Đang gửi…" : "Gửi nhắc nhở"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DueDateEditor({ assignmentId, dueDate, minDate }: { assignmentId: string; dueDate: string; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateAssignmentDueAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialFormState);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden /> Đổi hạn
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="sr-only" htmlFor={`due-${assignmentId}`}>
        Hạn đọc mới
      </label>
      <input
        id={`due-${assignmentId}`}
        type="date"
        name="dueDate"
        min={minDate}
        defaultValue={dueDate}
        className={cn(selectClass, "h-8 w-auto rounded-lg")}
      />
      <SubmitButton size="sm">Lưu</SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Hủy
      </Button>
      {state.error || state.fieldErrors ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error ?? state.fieldErrors?.dueDate}
        </p>
      ) : null}
    </form>
  );
}

function DeleteAssignment({ assignmentId, workTitle }: { assignmentId: string; workTitle: string }) {
  const [state, formAction] = useActionState(deleteAssignmentAction, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Gỡ bài giao “${workTitle}”? Tiến độ và điểm của học sinh vẫn được giữ.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
        <Trash2 aria-hidden /> Gỡ
      </SubmitButton>
      {state.error ? <FormAlert state={state} /> : null}
    </form>
  );
}
