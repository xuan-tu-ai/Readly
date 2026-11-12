"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { EyeOff, Flag, Heart, MessageCircle, Pin, Quote } from "lucide-react";
import {
  dismissReportsAction,
  moderatePostAction,
  moderateReplyAction,
  reportAction,
  replyAction,
  toggleLikeAction,
} from "@/app/actions/discussions";
import { CatAvatar } from "@/components/art/avatars";
import { DiscussionIcon } from "@/components/art/notification-icons";
import { FormAlert, SubmitButton } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { POST_TYPE_LABEL, REPLY_MAX } from "@/lib/discussion";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import { formatTimeDayMonth } from "@/lib/vn-date";
import type { PostView, ReplyView } from "@/server/services/discussions";

type Mode = "student" | "teacher";

/** One discussion post with its replies, for students (like, reply, report) or the teacher (moderate). */
export function PostCard({ post, slug, mode }: { post: PostView; slug: string; mode: Mode }) {
  const [showReplies, setShowReplies] = useState(post.replies.length > 0 && post.replies.length <= 3);
  const teacher = mode === "teacher";
  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        "grid scroll-mt-24 gap-3 rounded-2xl border-2 bg-card p-4 sm:p-5",
        post.pinned && "border-brand-yellow",
        post.hidden && "border-dashed opacity-75",
      )}
    >
      <header className="flex items-start gap-3">
        <CatAvatar avatar={post.author.avatar} size={40} label="" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{post.author.name}</span>
            {post.mine ? <span className="text-xs font-extrabold text-brand-blue uppercase">Bạn</span> : null}
            <span className="text-xs text-muted-foreground">{formatTimeDayMonth(post.createdAt)}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <Marker marker={post.type === "QUESTION" ? "question" : "reflection"} text={POST_TYPE_LABEL[post.type]} />
            {post.pinned ? <Marker marker="pinned" text="Đã ghim" /> : null}
            {post.resolved ? <Marker marker="resolved" text="Đã giải đáp" /> : null}
            {teacher && post.openReports > 0 ? <Marker marker="reported" text={`${post.openReports} báo cáo`} /> : null}
            {post.hidden ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <EyeOff className="size-3.5" aria-hidden /> {post.mine && !teacher ? "Giáo viên đã ẩn bài này" : "Đang ẩn"}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {post.quote ? <QuoteBlock quote={post.quote} slug={slug} linked={!teacher} /> : null}
      <p className="leading-relaxed whitespace-pre-line">{post.body}</p>

      <div className="flex flex-wrap items-center gap-2">
        {teacher ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className="size-4" aria-hidden /> {post.likes}
          </span>
        ) : (
          <LikeButton postId={post.id} liked={post.likedByMe} likes={post.likes} disabled={post.hidden} />
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowReplies((v) => !v)} aria-expanded={showReplies}>
          <MessageCircle aria-hidden /> {post.replies.length > 0 ? `${post.replies.length} trả lời` : "Trả lời"}
        </Button>
        {!teacher && !post.mine && !post.hidden ? <ReportButton postId={post.id} done={post.reportedByMe} /> : null}
        {teacher ? <PostModeration post={post} /> : null}
      </div>

      {showReplies ? (
        <div className="grid gap-3 border-t-2 pt-3">
          {post.replies.map((r) => (
            <ReplyItem key={r.id} reply={r} postId={post.id} mode={mode} />
          ))}
          {post.hidden ? null : <ReplyForm postId={post.id} teacher={teacher} />}
        </div>
      ) : null}
    </article>
  );
}

function Marker({ marker, text }: { marker: "question" | "reflection" | "pinned" | "resolved" | "reported"; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 pr-2">
      <DiscussionIcon marker={marker} size="sm" className="size-5 rounded-md [&_svg]:size-3" />
      {text}
    </span>
  );
}

function QuoteBlock({ quote, slug, linked }: { quote: NonNullable<PostView["quote"]>; slug: string; linked: boolean }) {
  const inner = (
    <>
      <Quote className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden />
      <span className="grid gap-1">
        <span className="font-heading leading-relaxed">{quote.text}</span>
        {quote.segmentTitle ? (
          <span className="text-xs font-bold text-muted-foreground">
            {quote.segmentTitle}
            {linked ? " · bấm để mở trong trang đọc" : ""}
          </span>
        ) : null}
      </span>
    </>
  );
  const className = "flex gap-2 rounded-xl border-l-4 border-brand-orange bg-brand-orange/10 px-3 py-2 text-sm";
  return linked ? (
    <Link href={`/student/read/${slug}?seg=${quote.segmentId}&q=${quote.start}-${quote.end}`} className={cn(className, "hover:bg-brand-orange/15")}>
      {inner}
    </Link>
  ) : (
    <blockquote className={className}>{inner}</blockquote>
  );
}

function LikeButton({ postId, liked, likes, disabled }: { postId: string; liked: boolean; likes: number; disabled?: boolean }) {
  const [state, setState] = useState({ liked, likes });
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const before = state;
    setState({ liked: !before.liked, likes: before.likes + (before.liked ? -1 : 1) });
    startTransition(async () => {
      const result = await toggleLikeAction(postId);
      setState(result.ok ? result.data : before);
    });
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={pending || disabled}
      aria-pressed={state.liked}
      aria-label={state.liked ? `Bỏ thích (${state.likes})` : `Thích (${state.likes})`}
      className={cn(state.liked && "text-brand-pink")}
    >
      <Heart aria-hidden className={cn(state.liked && "fill-current")} /> {state.likes}
    </Button>
  );
}

function ReportButton({ postId, replyId, done }: { postId: string; replyId?: string; done: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reportAction, initialFormState);
  if (done || state.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Flag className="size-3.5" aria-hidden /> Đã báo cáo
      </span>
    );
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag aria-hidden /> Báo cáo
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="postId" value={postId} />
      {replyId ? <input type="hidden" name="replyId" value={replyId} /> : null}
      <label className="sr-only" htmlFor={`reason-${replyId ?? postId}`}>
        Lý do báo cáo
      </label>
      <input
        id={`reason-${replyId ?? postId}`}
        name="reason"
        maxLength={300}
        placeholder="Lý do (không bắt buộc)"
        defaultValue={state.values?.reason}
        className="h-8 min-w-0 flex-1 rounded-lg border-2 bg-background px-2 text-sm"
      />
      <SubmitButton size="sm" variant="destructive">
        Gửi
      </SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Hủy
      </Button>
      {state.error ? <FormAlert state={state} /> : null}
    </form>
  );
}

function ReplyItem({ reply, postId, mode }: { reply: ReplyView; postId: string; mode: Mode }) {
  const teacher = mode === "teacher";
  return (
    <div className={cn("flex gap-3", reply.hidden && "opacity-60")}>
      <CatAvatar avatar={reply.author.avatar} size={32} label="" />
      <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-bold">{reply.author.name}</span>
          {reply.author.isTeacher ? (
            <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[0.65rem] font-extrabold text-white uppercase">Giáo viên</span>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatTimeDayMonth(reply.createdAt)}</span>
          {reply.hidden ? <span className="text-xs font-bold text-muted-foreground">· đang ẩn</span> : null}
          {teacher && reply.openReports > 0 ? (
            <span className="text-xs font-bold text-destructive">· {reply.openReports} báo cáo</span>
          ) : null}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{reply.body}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {!teacher && !reply.mine && !reply.hidden ? <ReportButton postId={postId} replyId={reply.id} done={reply.reportedByMe} /> : null}
          {teacher ? (
            <>
              <form action={moderateReplyAction}>
                <input type="hidden" name="replyId" value={reply.id} />
                <input type="hidden" name="hidden" value={String(!reply.hidden)} />
                <Button type="submit" variant="ghost" size="xs">
                  <EyeOff aria-hidden /> {reply.hidden ? "Hiện lại" : "Ẩn"}
                </Button>
              </form>
              {reply.openReports > 0 ? (
                <form action={dismissReportsAction}>
                  <input type="hidden" name="postId" value={postId} />
                  <input type="hidden" name="replyId" value={reply.id} />
                  <Button type="submit" variant="ghost" size="xs">
                    Bỏ qua báo cáo
                  </Button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyForm({ postId, teacher }: { postId: string; teacher: boolean }) {
  const [state, formAction] = useActionState(replyAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="postId" value={postId} />
      <label className="sr-only" htmlFor={`reply-${postId}`}>
        Viết câu trả lời
      </label>
      <Textarea
        id={`reply-${postId}`}
        name="body"
        rows={2}
        maxLength={REPLY_MAX}
        placeholder={teacher ? "Trả lời với tư cách giáo viên…" : "Viết câu trả lời…"}
        defaultValue={state.ok ? "" : state.values?.body}
      />
      {state.error || state.fieldErrors?.body ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error ?? state.fieldErrors?.body}
        </p>
      ) : null}
      <SubmitButton size="sm" className="justify-self-end" pendingText="Đang gửi…">
        Gửi trả lời
      </SubmitButton>
    </form>
  );
}

function PostModeration({ post }: { post: PostView }) {
  const toggle = (name: "pinned" | "hidden" | "resolved", value: boolean, label: string, icon?: React.ReactNode) => (
    <form action={moderatePostAction}>
      <input type="hidden" name="postId" value={post.id} />
      <input type="hidden" name={name} value={String(value)} />
      <Button type="submit" variant="outline" size="sm">
        {icon}
        {label}
      </Button>
    </form>
  );
  return (
    <div className="ml-auto flex flex-wrap gap-2">
      {toggle("pinned", !post.pinned, post.pinned ? "Bỏ ghim" : "Ghim", <Pin aria-hidden />)}
      {post.type === "QUESTION" ? toggle("resolved", !post.resolved, post.resolved ? "Bỏ đánh dấu giải đáp" : "Đã giải đáp") : null}
      {toggle("hidden", !post.hidden, post.hidden ? "Hiện lại" : "Ẩn", <EyeOff aria-hidden />)}
      {post.openReports > 0 ? (
        <form action={dismissReportsAction}>
          <input type="hidden" name="postId" value={post.id} />
          <Button type="submit" variant="ghost" size="sm">
            Bỏ qua báo cáo
          </Button>
        </form>
      ) : null}
    </div>
  );
}
