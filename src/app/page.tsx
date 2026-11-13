import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { InstallApp } from "@/components/install-app";
import { HeroArt } from "@/components/landing/hero-art";
import { QrCode } from "@/components/qr-code";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { requestOrigin } from "@/server/qr";
import { RedirectIfSignedIn } from "./(auth)/redirect-if-signed-in";

export const metadata: Metadata = {
  title: { absolute: "Readly – Đọc văn lớp 12 theo cách vui nhất" },
};

/**
 * Landing page (one screen, no scrolling): what Readly is, sign up / sign in,
 * and installing it as an app. A signed-in user is sent to their own area.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-3 md:px-8 md:pt-6">
        <Brand />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center items-center gap-4 px-4 pb-6 md:grid-cols-2 md:gap-12 md:px-8">
        <HeroArt className="mx-auto w-full max-w-[min(20rem,42dvh)] md:max-w-md" />

        <div className="grid justify-items-center gap-6 text-center md:gap-8">
          <h1 className="max-w-md font-heading text-2xl leading-snug font-bold text-balance md:text-[2rem]">
            Đọc văn lớp 12 theo cách vui nhất!
          </h1>
          <div className="grid w-full max-w-xs gap-3">
            <Link href="/register" className={buttonVariants({ size: "xl", className: "w-full uppercase" })}>
              Bắt đầu
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "xl", className: "w-full text-primary uppercase" })}
            >
              Tôi đã có tài khoản
            </Link>
            <InstallApp />
          </div>
          <Suspense fallback={<div className="hidden h-[6.5rem] md:block" />}>
            <PhoneQr />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/** Computer only: scan to open Readly on a phone (and install it there). */
async function PhoneQr() {
  const origin = await requestOrigin();
  return (
    <div className="hidden items-center gap-4 rounded-2xl border-2 p-3 text-left md:flex">
      <QrCode value={`${origin}/`} label="Mã QR mở Readly trên điện thoại" className="size-20" />
      <p className="max-w-44 text-sm">
        <span className="font-bold">Đọc trên điện thoại?</span>
        <br />
        <span className="text-muted-foreground">Quét mã để mở Readly, rồi bấm Cài ứng dụng.</span>
      </p>
    </div>
  );
}
