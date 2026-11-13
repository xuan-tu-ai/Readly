"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, EllipsisVertical, Plus, Share } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { detectPlatform, INSTALL_CHANGE, type InstallPlatform } from "@/lib/install";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
/** Set by INSTALL_SCRIPT in <head>. */
type InstallWindow = Window & { __readlyInstall?: InstallPromptEvent | null; __readlyInstalled?: boolean };

/** "hidden": already installed (or server render); "prompt": the browser can show its install dialog. */
type State = "hidden" | "prompt" | InstallPlatform;

function read(): State {
  const w = window as InstallWindow;
  const standalone =
    matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (w.__readlyInstalled || standalone) return "hidden";
  if (w.__readlyInstall) return "prompt";
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

function subscribe(onChange: () => void) {
  window.addEventListener(INSTALL_CHANGE, onChange);
  return () => window.removeEventListener(INSTALL_CHANGE, onChange);
}

const LABEL = "Cài ứng dụng";

/**
 * Installs Readly as an app. Where the browser allows it (Chrome/Edge on
 * Android and computers) this opens the browser's own one-tap dialog;
 * elsewhere (iPhone/iPad, or before Chrome offers it) it shows how to add
 * Readly from the browser menu. Hidden once Readly runs as an installed app.
 */
export function InstallApp({ variant = "button", className }: { variant?: "button" | "menu" | "icon"; className?: string }) {
  const state = useSyncExternalStore(subscribe, read, () => "hidden" as State);
  const [guide, setGuide] = useState<InstallPlatform | null>(null);
  if (state === "hidden") return null;

  const install = async () => {
    const w = window as InstallWindow;
    const event = w.__readlyInstall;
    if (!event) {
      setGuide(state === "prompt" ? "desktop" : state);
      return;
    }
    await event.prompt();
    await event.userChoice.catch(() => null);
    // The event can only be used once; Chrome fires a new one if it still applies.
    w.__readlyInstall = null;
    window.dispatchEvent(new Event(INSTALL_CHANGE));
  };

  return (
    <>
      {variant === "icon" ? (
        <Button type="button" variant="ghost" size="icon-sm" onClick={install} aria-label={LABEL} title={LABEL} className={className}>
          <Download aria-hidden />
        </Button>
      ) : variant === "menu" ? (
        <Button type="button" variant="outline" size="sm" onClick={install} className={cn("w-full justify-start gap-2", className)}>
          <Download aria-hidden /> {LABEL}
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="lg" onClick={install} className={cn("gap-2 text-primary uppercase", className)}>
          <Download aria-hidden /> {LABEL}
        </Button>
      )}
      <InstallGuide platform={guide} onClose={() => setGuide(null)} />
    </>
  );
}

function InstallGuide({ platform, onClose }: { platform: InstallPlatform | null; onClose: () => void }) {
  const steps = platform ? STEPS[platform] : [];
  return (
    <Sheet open={platform !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="flex-row items-center gap-3">
          <Mascot pose="point" size={64} label="" />
          <div className="grid gap-1">
            <SheetTitle className="font-heading text-xl font-semibold">Cài Readly lên máy</SheetTitle>
            <SheetDescription>
              {platform === "ios"
                ? "iPhone và iPad chỉ cho cài từ menu Chia sẻ. Làm 3 bước:"
                : "Làm theo các bước sau trong trình duyệt:"}
            </SheetDescription>
          </div>
        </SheetHeader>
        <ol className="grid gap-3 px-4">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border-2 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-sm leading-snug">{step}</span>
            </li>
          ))}
        </ol>
        {platform === "desktop" ? (
          <p className="px-4 text-xs text-muted-foreground">
            Firefox chưa hỗ trợ cài ứng dụng web. Trên Safari (máy Mac): menu Tệp → Thêm vào Dock.
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-md border-2 px-1.5 py-0.5 font-bold whitespace-nowrap">{children}</span>
);

const STEPS: Record<InstallPlatform, React.ReactNode[]> = {
  ios: [
    <>
      Bấm nút <Key><Share className="size-4" aria-hidden /> Chia sẻ</Key> trên thanh công cụ của trình duyệt.
    </>,
    <>
      Kéo xuống, chọn <Key><Plus className="size-4" aria-hidden /> Thêm vào MH chính</Key>.
    </>,
    <>
      Bấm <Key>Thêm</Key>. Biểu tượng Readly sẽ nằm trên màn hình chính.
    </>,
  ],
  android: [
    <>
      Bấm nút menu <Key><EllipsisVertical className="size-4" aria-hidden /></Key> ở góc trên của Chrome.
    </>,
    <>
      Chọn <Key>Cài đặt ứng dụng</Key> hoặc <Key>Thêm vào MH chính</Key>.
    </>,
    <>
      Bấm <Key>Cài đặt</Key>. Readly sẽ mở như một ứng dụng riêng.
    </>,
  ],
  desktop: [
    <>
      Mở Readly bằng <Key>Chrome</Key> hoặc <Key>Edge</Key>.
    </>,
    <>
      Bấm biểu tượng <Key><Download className="size-4" aria-hidden /> Cài đặt</Key> ở cuối thanh địa chỉ, hoặc tìm mục Cài Readly
      trong menu <Key><EllipsisVertical className="size-4" aria-hidden /></Key>.
    </>,
    <>
      Bấm <Key>Cài đặt</Key>. Readly có biểu tượng riêng trên máy tính.
    </>,
  ],
};
