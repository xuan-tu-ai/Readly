"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { POST_MAX, REPLY_MAX } from "@/lib/discussion";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { pushToUser, removePushSubscription, savePushSubscription } from "@/server/push";
import {
  createPost,
  createReply,
  dismissReports,
  moderatePost,
  moderateReply,
  reportContent,
  toggleLike,
} from "@/server/services/discussions";
import { markAllNotificationsRead, markNotificationRead } from "@/server/services/notifications";
import type { ActionResult } from "./reading";
import { formObject, invalid, toFormError, type FormState } from "./state";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

// ───────────────────────── Student: posting ─────────────────────────

const int = z.coerce.number().int().min(0);

const postSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(["QUESTION", "REFLECTION"], { error: "Chọn loại bài." }),
  body: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập nội dung." })
    .max(POST_MAX, { error: `Nội dung tối đa ${POST_MAX} ký tự.` }),
  quoteSegment: z.string().optional(),
  quoteStart: int.optional(),
  quoteEnd: int.optional(),
});

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("STUDENT");
  const parsed = postSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { slug, type, body, quoteSegment, quoteStart, quoteEnd } = parsed.data;
  let postId: string;
  try {
    const quote =
      quoteSegment && quoteStart !== undefined && quoteEnd !== undefined
        ? { segmentId: quoteSegment, start: quoteStart, end: quoteEnd }
        : null;
    postId = (await createPost(user, { slug, type, body, quote })).id;
  } catch (error) {
    return toFormError(error, formData);
  }
  // Back to the plain discussion URL (drops the quote from the address), at the new post.
  redirect(`/student/works/${slug}/discussion#post-${postId}`);
}

const replySchema = z.object({
  postId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập câu trả lời." })
    .max(REPLY_MAX, { error: `Câu trả lời tối đa ${REPLY_MAX} ký tự.` }),
});

/** Students of the class and its teacher reply. */
export async function replyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("STUDENT", "TEACHER");
  const parsed = replySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await createReply(user, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return toFormError(error, formData);
  }
}

export async function toggleLikeAction(postId: string): Promise<ActionResult<{ liked: boolean; likes: number }>> {
  const user = await requireUser("STUDENT");
  return run(() => toggleLike(user, postId));
}

export async function reportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("STUDENT");
  const parsed = z
    .object({ postId: z.string().min(1), replyId: z.string().optional(), reason: z.string().max(300).optional() })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await reportContent(user, { postId: parsed.data.postId, replyId: parsed.data.replyId || null, reason: parsed.data.reason });
    return { ok: true, message: "Đã gửi báo cáo, giáo viên sẽ xem xét." };
  } catch (error) {
    return toFormError(error, formData);
  }
}

// ───────────────────────── Teacher: moderation (form actions) ─────────────────────────

const flag = z.enum(["true", "false"]).transform((v) => v === "true");

export async function moderatePostAction(formData: FormData): Promise<void> {
  const user = await requireUser("TEACHER");
  const parsed = z
    .object({ postId: z.string().min(1), pinned: flag.optional(), hidden: flag.optional(), resolved: flag.optional() })
    .safeParse(formObject(formData));
  if (!parsed.success) return;
  const { postId, ...change } = parsed.data;
  await moderatePost(user, postId, change);
  refresh();
}

export async function moderateReplyAction(formData: FormData): Promise<void> {
  const user = await requireUser("TEACHER");
  const parsed = z.object({ replyId: z.string().min(1), hidden: flag }).safeParse(formObject(formData));
  if (!parsed.success) return;
  await moderateReply(user, parsed.data.replyId, parsed.data.hidden);
  refresh();
}

export async function dismissReportsAction(formData: FormData): Promise<void> {
  const user = await requireUser("TEACHER");
  const parsed = z.object({ postId: z.string().min(1), replyId: z.string().optional() }).safeParse(formObject(formData));
  if (!parsed.success) return;
  await dismissReports(user, { postId: parsed.data.postId, replyId: parsed.data.replyId || null });
  refresh();
}

// ───────────────────────── Notifications ─────────────────────────

/** Opens a notification: marks it read, then goes to its page. */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const user = await requireUser("STUDENT");
  const id = formData.get("id");
  const href = formData.get("href");
  if (typeof id === "string" && id) {
    try {
      await markNotificationRead(user, id);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  // The bell lives in the shared layout: refresh so its count drops on the next page too.
  refresh();
  // Only in-app paths, never an outside URL.
  if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) redirect(href);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser("STUDENT");
  await markAllNotificationsRead(user);
  refresh();
}

// ───────────────────────── Web push ─────────────────────────

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("STUDENT");
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Đăng ký thông báo không hợp lệ." };
  return run(async () => {
    await savePushSubscription(user, parsed.data);
    return null;
  });
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult<null>> {
  const user = await requireUser("STUDENT");
  return run(async () => {
    await removePushSubscription(user, endpoint);
    return null;
  });
}

/** Sends a test push to the signed-in student's browsers. */
export async function sendTestPushAction(): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser("STUDENT");
  return run(async () => {
    const result = await pushToUser(user.id, {
      title: "Readly: thông báo thử",
      body: "Thông báo đẩy đã hoạt động. Mướp sẽ báo khi có bài giao, nhắc hạn hay ai đó trả lời bạn.",
      href: "/student/notifications",
      tag: "readly-test",
    });
    if (result.skipped) throw new DomainError("INVALID_INPUT", "Máy chủ chưa cấu hình khóa VAPID cho thông báo đẩy.");
    return { sent: result.sent };
  });
}
