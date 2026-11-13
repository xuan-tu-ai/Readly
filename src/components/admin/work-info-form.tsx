"use client";

import { useActionState } from "react";
import type { Genre, TagKind, WorkStatus } from "@/generated/prisma/enums";
import { createTagAction, deleteWorkAction, updateWorkAction } from "@/app/actions/admin-content";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { DIFFICULTIES, DIFFICULTY_LABEL, GENRES, GENRE_LABEL } from "@/lib/catalog";
import { initialFormState } from "@/lib/form-state";
import { Labeled, areaClass, selectClass } from "./fields";

type WorkValues = {
  id: string;
  title: string;
  author: string;
  authorBio: string;
  genre: Genre;
  summary: string;
  difficulty: number;
  estMinutes: number;
  status: WorkStatus;
  background: string | null;
  tags: string[];
};

const STATUS_HINT: Record<WorkStatus, string> = {
  DRAFT: "Nháp: chỉ admin thấy.",
  PUBLISHED: "Đã xuất bản: học sinh đọc được (cần có văn bản).",
  COMING_SOON: "Sắp có: hiện trong thư viện với nhãn “Sắp có”, chưa đọc được.",
};

/** Metadata, status and tags of a work (spec §3, §13). */
export function WorkInfoForm({
  work,
  segments,
  allTags,
}: {
  work: WorkValues;
  segments: number;
  allTags: { slug: string; label: string; kind: TagKind }[];
}) {
  const [state, formAction] = useActionState(updateWorkAction, initialFormState);
  const v = (name: keyof WorkValues) => state.values?.[name] ?? String(work[name] ?? "");
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={work.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên tác phẩm" name="title" defaultValue={v("title")} error={e.title} />
        <Field label="Tác giả" name="author" defaultValue={v("author")} error={e.author} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Labeled id="w-genre" label="Thể loại" className="sm:col-span-2">
          <select id="w-genre" name="genre" className={selectClass} defaultValue={v("genre")}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABEL[g]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled id="w-difficulty" label="Độ khó">
          <select id="w-difficulty" name="difficulty" className={selectClass} defaultValue={v("difficulty")}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </Labeled>
        <Field label="Thời lượng (phút)" name="estMinutes" type="number" min={1} defaultValue={v("estMinutes")} error={e.estMinutes} />
      </div>
      <Labeled id="w-status" label="Trạng thái" hint={segments === 0 ? "Chưa có văn bản: chưa xuất bản được." : STATUS_HINT[work.status]} error={e.status}>
        <select id="w-status" name="status" className={selectClass} defaultValue={v("status")}>
          <option value="DRAFT">Nháp</option>
          <option value="COMING_SOON">Sắp có</option>
          <option value="PUBLISHED">Đã xuất bản</option>
        </select>
      </Labeled>
      <Labeled id="w-summary" label="Tóm tắt">
        <textarea id="w-summary" name="summary" rows={4} className={areaClass} defaultValue={v("summary")} />
      </Labeled>
      <Labeled id="w-bio" label="Về tác giả">
        <textarea id="w-bio" name="authorBio" rows={3} className={areaClass} defaultValue={v("authorBio")} />
      </Labeled>
      <Labeled
        id="w-background"
        label="Thẻ kiến thức nền (trước khi đọc)"
        hint="HTML đơn giản: <p>, <em>, <strong>, <br>. Thẻ khác sẽ bị bỏ khi lưu."
      >
        <textarea id="w-background" name="background" rows={4} className={`${areaClass} font-mono text-xs`} defaultValue={v("background")} />
      </Labeled>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Tag (dùng cho bài test sở thích)</legend>
        {(["THEME", "MOOD"] as const).map((kind) => (
          <div key={kind} className="flex flex-wrap gap-2">
            <span className="w-full text-xs font-bold text-muted-foreground uppercase">{kind === "THEME" ? "Chủ đề" : "Không khí"}</span>
            {allTags
              .filter((t) => t.kind === kind)
              .map((t) => (
                <label key={t.slug} className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm has-checked:border-primary has-checked:bg-primary/10">
                  <input type="checkbox" name="tags" value={t.slug} defaultChecked={work.tags.includes(t.slug)} className="accent-primary" />
                  {t.label}
                </label>
              ))}
          </div>
        ))}
      </fieldset>
      <FormAlert state={state} />
      <SubmitButton className="justify-self-start uppercase">Lưu thông tin</SubmitButton>
    </form>
  );
}

export function NewTagForm() {
  const [state, formAction] = useActionState(createTagAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-2" noValidate>
      <Field label="Tên tag" name="label" placeholder="Ví dụ: Tình mẫu tử" defaultValue={state.ok ? "" : state.values?.label} error={state.fieldErrors?.label} />
      <Labeled id="tag-kind" label="Loại">
        <select id="tag-kind" name="kind" className={selectClass} defaultValue="THEME">
          <option value="THEME">Chủ đề</option>
          <option value="MOOD">Không khí</option>
        </select>
      </Labeled>
      <FormAlert state={state} />
      <SubmitButton size="sm" variant="outline" className="justify-self-start">
        Thêm tag
      </SubmitButton>
    </form>
  );
}

export function DeleteWorkForm({ id, title, disabled }: { id: string; title: string; disabled: boolean }) {
  const [state, formAction] = useActionState(deleteWorkAction, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Xóa hẳn “${title}”? Không hoàn tác được.`)) event.preventDefault();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <FormAlert state={state} />
      <SubmitButton variant="destructive" size="sm" disabled={disabled} className="justify-self-start">
        Xóa tác phẩm
      </SubmitButton>
    </form>
  );
}
