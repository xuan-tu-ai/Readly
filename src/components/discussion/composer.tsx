"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Quote, X } from "lucide-react";
import { createPostAction } from "@/app/actions/discussions";
import { DiscussionIcon } from "@/components/art/notification-icons";
import { SubmitButton } from "@/components/form-fields";
import { Textarea } from "@/components/ui/textarea";
import { POST_MAX } from "@/lib/discussion";
import { initialFormState } from "@/lib/form-state";

export type ComposerQuote = { segmentId: string; segmentTitle: string; start: number; end: number; text: string };

/** New post: question or reflection, optionally quoting a passage picked in the reader. */
export function Composer({ slug, quote, className }: { slug: string; quote: ComposerQuote | null; className?: string }) {
  const [state, formAction] = useActionState(createPostAction, initialFormState);
  const type = state.values?.type ?? (quote ? "QUESTION" : "REFLECTION");
  return (
    <form action={formAction} className={className} noValidate>
      <input type="hidden" name="slug" value={slug} />
      {quote ? (
        <>
          <input type="hidden" name="quoteSegment" value={quote.segmentId} />
          <input type="hidden" name="quoteStart" value={quote.start} />
          <input type="hidden" name="quoteEnd" value={quote.end} />
        </>
      ) : null}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Loại bài</legend>
        {(
          [
            ["QUESTION", "question", "Câu hỏi", "Hỏi cả lớp điều bạn thắc mắc"],
            ["REFLECTION", "reflection", "Cảm nhận", "Chia sẻ điều bạn thấy hay"],
          ] as const
        ).map(([value, marker, label, hint]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 py-2 has-checked:border-primary has-checked:bg-primary/10"
          >
            <input type="radio" name="type" value={value} defaultChecked={type === value} className="sr-only" />
            <DiscussionIcon marker={marker} size="sm" />
            <span className="grid leading-tight">
              <span className="text-sm font-bold">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {quote ? (
        <div className="flex gap-2 rounded-xl border-l-4 border-brand-orange bg-brand-orange/10 px-3 py-2 text-sm">
          <Quote className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-heading leading-relaxed">{quote.text}</span>
            <span className="mt-1 block text-xs font-bold text-muted-foreground">Trích {quote.segmentTitle}</span>
          </p>
          <Link
            href={`/student/works/${slug}/discussion`}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Bỏ trích dẫn"
          >
            <X className="size-4" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor="post-body" className="sr-only">
          Nội dung
        </label>
        <Textarea
          id="post-body"
          name="body"
          rows={3}
          maxLength={POST_MAX}
          placeholder={quote ? "Đoạn này khiến bạn nghĩ gì?" : "Viết câu hỏi hoặc cảm nhận của bạn về tác phẩm…"}
          defaultValue={state.values?.body}
          aria-invalid={state.fieldErrors?.body || state.error ? true : undefined}
        />
        {state.error || state.fieldErrors?.body || state.fieldErrors?.type ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error ?? state.fieldErrors?.body ?? state.fieldErrors?.type}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Bài đăng ngay cho cả lớp. Lời lẽ tôn trọng nhau nhé!</p>
        <SubmitButton className="uppercase" pendingText="Đang đăng…">
          Đăng bài
        </SubmitButton>
      </div>
    </form>
  );
}
