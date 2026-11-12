import webpush from "web-push";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";

/**
 * Web Push delivery (VAPID). Optional: without WEB_PUSH_PUBLIC_KEY and
 * WEB_PUSH_PRIVATE_KEY the app works the same, notifications just stay in
 * the in-app bell. Generate keys with `npx web-push generate-vapid-keys`.
 */

export type PushPayload = { title: string; body?: string | null; href?: string | null; tag?: string };

export function pushPublicKey(): string | null {
  return process.env.WEB_PUSH_PUBLIC_KEY?.trim() || null;
}

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = pushPublicKey();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:admin@readly.local", publicKey, privateKey);
  return (configured = true);
}

// ───────────────────────── Subscriptions ─────────────────────────

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** A browser accepted push for this user. Re-subscribing moves the endpoint to the current user. */
export async function savePushSubscription(actor: Actor, sub: SubscriptionInput) {
  assertRole(actor, "STUDENT", "TEACHER");
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: actor.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId: actor.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removePushSubscription(actor: Actor, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: actor.id } });
}

export function countPushSubscriptions(userId: string) {
  return db.pushSubscription.count({ where: { userId } });
}

// ───────────────────────── Sending ─────────────────────────

/** Sends one payload to every browser of a user; drops subscriptions the push service says are gone. */
export async function pushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, removed: 0, skipped: true };
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 3600 },
      );
      sent++;
      await db.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser unsubscribed or the subscription expired.
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        removed++;
      } else {
        console.error("[push] gửi thất bại", status ?? error);
      }
    }
  }
  return { sent, removed, skipped: false };
}

/** Job: push the given notifications to their recipients' browsers. */
export async function pushNotificationsJob(ids: string[]) {
  if (!isPushConfigured()) return { skipped: true };
  const rows = await db.notification.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true, title: true, body: true, href: true },
  });
  let sent = 0;
  for (const n of rows) {
    sent += (await pushToUser(n.userId, { title: n.title, body: n.body, href: n.href, tag: n.id })).sent;
  }
  return { notifications: rows.length, sent };
}
