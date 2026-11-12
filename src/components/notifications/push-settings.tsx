"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/app/actions/discussions";
import { Button } from "@/components/ui/button";

type Status = "checking" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Opt-in for web push on this browser (spec §11). In-app notifications work
 * without it; on iPhone, push needs the app added to the home screen.
 */
export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const set = (s: Status) => !cancelled && setStatus(s);
    if (!pushSupported()) set("unsupported");
    else if (!publicKey) set("unconfigured");
    else if (Notification.permission === "denied") set("denied");
    else currentSubscription().then((sub) => set(sub ? "on" : "off"), () => set("off"));
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey!) }));
        const json = sub.toJSON();
        const result = await savePushSubscriptionAction({ endpoint: json.endpoint, keys: json.keys });
        if (!result.ok) throw new Error(result.error);
        setStatus("on");
        setMessage("Đã bật thông báo đẩy trên trình duyệt này.");
      } catch (error) {
        setMessage(error instanceof Error ? `Không bật được: ${error.message}` : "Không bật được thông báo đẩy.");
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const sub = await currentSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Đã tắt thông báo đẩy. Bạn vẫn thấy thông báo trong chuông.");
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestPushAction();
      setMessage(
        result.ok
          ? result.data.sent > 0
            ? "Đã gửi thông báo thử, kiểm tra góc màn hình nhé."
            : "Chưa có trình duyệt nào đăng ký, hãy bật lại."
          : result.error,
      );
    });

  const text: Record<Status, string> = {
    checking: "Đang kiểm tra trình duyệt…",
    unsupported: "Trình duyệt này không hỗ trợ thông báo đẩy. Trên iPhone, hãy thêm Readly vào Màn hình chính trước.",
    unconfigured: "Máy chủ chưa bật thông báo đẩy (thiếu khóa VAPID). Thông báo vẫn hiện trong chuông.",
    denied: "Bạn đã chặn thông báo cho trang này. Mở cài đặt trang của trình duyệt để cho phép lại.",
    off: "Nhận thông báo ngay cả khi không mở Readly: bài mới, nhắc hạn, có người trả lời bạn.",
    on: "Thông báo đẩy đang bật trên trình duyệt này.",
  };

  return (
    <section aria-labelledby="push-heading" className="grid gap-3 rounded-2xl border-2 bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid gap-1">
        <h2 id="push-heading" className="flex items-center gap-2 font-bold">
          {status === "on" ? <BellRing className="size-5 text-primary" aria-hidden /> : <BellOff className="size-5 text-muted-foreground" aria-hidden />}
          Thông báo đẩy
        </h2>
        <p className="text-sm text-muted-foreground">{text[status]}</p>
        {message ? (
          <p role="status" className="text-sm font-semibold text-primary">
            {message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "off" ? (
          <Button onClick={enable} disabled={busy} size="sm">
            <BellRing aria-hidden /> Bật thông báo đẩy
          </Button>
        ) : null}
        {status === "on" ? (
          <>
            <Button onClick={test} disabled={busy} size="sm" variant="outline">
              <Send aria-hidden /> Gửi thử
            </Button>
            <Button onClick={disable} disabled={busy} size="sm" variant="ghost">
              Tắt
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
