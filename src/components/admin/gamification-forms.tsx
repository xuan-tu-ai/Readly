"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { BadgeRule } from "@/generated/prisma/enums";
import { deleteBadgeAction, saveBadgeAction, updatePointTableAction } from "@/app/actions/admin-content";
import { BadgeArt } from "@/components/art/badge";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { BADGE_EMBLEMS, BADGE_TIERS, LEVELS, type BadgeEmblem, type BadgeTier } from "@/lib/art";
import { BADGE_RULE_LABEL } from "@/lib/content/schemas";
import { initialFormState, type FormState } from "@/lib/form-state";
import type { PointTable } from "@/lib/gamification";
import { Labeled, selectClass } from "./fields";

const POINT_FIELDS: [keyof Omit<PointTable, "levelThresholds">, string][] = [
  ["mcqFirstTry", "Trắc nghiệm đúng lần đầu"],
  ["shortDat", "Tự luận ngắn: Đạt"],
  ["shortSauSac", "Tự luận ngắn: Sâu sắc"],
  ["essayDat", "Đoạn cảm nhận: Đạt"],
  ["essaySauSac", "Đoạn cảm nhận: Sâu sắc"],
  ["workCompleted", "Hoàn thành tác phẩm"],
  ["workEarlyBonus", "Thưởng xong trước hạn"],
  ["miniGameMax", "Mini game (tối đa)"],
];

/** Point table and level thresholds (spec §8.1–8.2). Saving recalculates every ledger. */
export function PointTableForm({ table }: { table: PointTable }) {
  const [state, formAction] = useActionState(updatePointTableAction, initialFormState);
  return (
    <form
      action={formAction}
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        if (!confirm("Lưu bảng điểm và tính lại điểm của mọi học sinh?")) e.preventDefault();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {POINT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} name={key} type="number" min={0} defaultValue={state.values?.[key] ?? String(table[key])} error={state.fieldErrors?.[key]} />
        ))}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Ngưỡng cấp độ (tổng điểm)</legend>
        <div className="grid gap-2 sm:grid-cols-5">
          {LEVELS.map((level, i) => (
            <label key={level.level} className="grid gap-1 text-sm">
              <span className="font-semibold">
                {level.level}. {level.name}
              </span>
              <input
                name="levelThresholds"
                type="number"
                min={0}
                defaultValue={table.levelThresholds[i]}
                readOnly={i === 0}
                className={selectClass}
              />
            </label>
          ))}
        </div>
        {state.fieldErrors?.levelThresholds ? <p className="text-sm text-destructive">{state.fieldErrors.levelThresholds}</p> : null}
      </fieldset>
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start uppercase" pendingText="Đang tính lại điểm…">
        Lưu và tính lại
      </SubmitButton>
    </form>
  );
}

export type BadgeValues = {
  id?: string;
  name: string;
  description: string;
  rule: BadgeRule;
  threshold: number | null;
  workId: string | null;
  emblem: BadgeEmblem;
  tier: BadgeTier;
  active: boolean;
};

const NEW_BADGE: BadgeValues = {
  name: "",
  description: "",
  rule: "WORKS_COMPLETED",
  threshold: 3,
  workId: null,
  emblem: "books",
  tier: "bronze",
  active: true,
};

/** A badge from one of the five rule templates (spec §8.4), with a live preview. */
export function BadgeForm({
  initial = NEW_BADGE,
  works,
  locked = false,
  onDone,
}: {
  initial?: BadgeValues;
  works: { id: string; title: string }[];
  /** Already awarded: the rule can no longer change. */
  locked?: boolean;
  onDone?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveBadgeAction(prev, formData);
    if (result.ok) {
      onDone?.();
      if (!initial.id) setValues(NEW_BADGE);
    }
    return result;
  }, initialFormState);
  const set = <K extends keyof BadgeValues>(key: K, value: BadgeValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const e = state.fieldErrors ?? {};
  const id = initial.id ?? "new";

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto]" noValidate>
      {initial.id ? <input type="hidden" name="badgeId" value={initial.id} /> : null}
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên huy hiệu" name="name" value={values.name} onChange={(ev) => set("name", ev.target.value)} error={e.name} />
          <Field label="Mô tả" name="description" value={values.description} onChange={(ev) => set("description", ev.target.value)} error={e.description} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled id={`rule-${id}`} label="Điều kiện" hint={locked ? "Đã trao cho học sinh: không đổi điều kiện được." : undefined}>
            <select id={`rule-${id}`} name="rule" className={selectClass} value={values.rule} disabled={locked} onChange={(ev) => set("rule", ev.target.value as BadgeRule)}>
              {(Object.keys(BADGE_RULE_LABEL) as BadgeRule[]).map((r) => (
                <option key={r} value={r}>
                  {BADGE_RULE_LABEL[r]}
                </option>
              ))}
            </select>
            {locked ? <input type="hidden" name="rule" value={values.rule} /> : null}
          </Labeled>
          {values.rule === "WORK_COMPLETED" ? (
            <Labeled id={`work-${id}`} label="Tác phẩm" error={e.workId}>
              <select id={`work-${id}`} name="workId" className={selectClass} value={values.workId ?? ""} disabled={locked} onChange={(ev) => set("workId", ev.target.value || null)}>
                <option value="">Chọn tác phẩm…</option>
                {works.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
              {locked ? <input type="hidden" name="workId" value={values.workId ?? ""} /> : null}
            </Labeled>
          ) : (
            <Field
              label="Số N"
              name="threshold"
              type="number"
              min={1}
              value={values.threshold ?? ""}
              readOnly={locked}
              onChange={(ev) => set("threshold", ev.target.value ? Number(ev.target.value) : null)}
              error={e.threshold}
            />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled id={`emblem-${id}`} label="Hình">
            <select id={`emblem-${id}`} name="emblem" className={selectClass} value={values.emblem} onChange={(ev) => set("emblem", ev.target.value as BadgeEmblem)}>
              {BADGE_EMBLEMS.map((em) => (
                <option key={em.key} value={em.key}>
                  {em.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled id={`tier-${id}`} label="Bậc khung">
            <select id={`tier-${id}`} name="tier" className={selectClass} value={values.tier} onChange={(ev) => set("tier", ev.target.value as BadgeTier)}>
              {BADGE_TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="active" checked={values.active} onChange={(ev) => set("active", ev.target.checked)} className="size-4 accent-primary" />
          Đang dùng (học sinh đủ điều kiện sẽ nhận ngay)
        </label>
        <FormAlert state={state} />
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingText="Đang lưu…">
            {initial.id ? "Lưu huy hiệu" : "Tạo huy hiệu"}
          </SubmitButton>
          {onDone && initial.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Hủy
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid justify-items-center gap-1 self-start sm:w-36">
        <BadgeArt emblem={values.emblem} tier={values.tier} size={112} caption={values.rule === "WORK_COMPLETED" ? undefined : `${values.threshold ?? "N"}`} label="" />
        <span className="text-center text-xs text-muted-foreground">Xem trước</span>
      </div>
    </form>
  );
}

export function BadgeRow({ badge, works }: { badge: BadgeValues & { awarded: number; workTitle: string | null }; works: { id: string; title: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-dashed p-4">
        <BadgeForm initial={badge} works={works} locked={badge.awarded > 0} onDone={() => setEditing(false)} />
      </div>
    );
  }
  const remove = () => {
    if (!confirm(`Xóa huy hiệu “${badge.name}”?`)) return;
    startTransition(async () => {
      const result = await deleteBadgeAction(badge.id!);
      setMessage(result.ok ? null : result.error);
    });
  };
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 bg-card p-3 ${badge.active ? "" : "opacity-60"}`}>
      <BadgeArt emblem={badge.emblem} tier={badge.tier} size={56} label="" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {badge.name} {badge.active ? null : <span className="text-xs font-semibold text-muted-foreground">(đang tắt)</span>}
        </p>
        <p className="text-sm text-muted-foreground">
          {badge.rule === "WORK_COMPLETED"
            ? `Hoàn thành “${badge.workTitle ?? "?"}”`
            : BADGE_RULE_LABEL[badge.rule].replace("N", String(badge.threshold))}{" "}
          · {badge.awarded} học sinh đã nhận
        </p>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${badge.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Xóa ${badge.name}`} onClick={remove} disabled={busy}>
        <Trash2 />
      </Button>
    </div>
  );
}

export function NewBadge({ works }: { works: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="justify-self-start">
        <Plus aria-hidden /> Tạo huy hiệu
      </Button>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-dashed p-4">
      <BadgeForm works={works} onDone={() => setOpen(false)} />
    </div>
  );
}
