import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Mascot } from "@/components/mascot/mascot";

/** Sign-in / sign-up frame: brand panel with the mascot beside the form. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/10" />
        <Brand className="relative [&_span]:text-white" />
        <div className="relative grid gap-6">
          <Mascot pose="read" size={200} />
          <p className="max-w-md font-heading text-4xl leading-tight font-semibold">
            Đọc 45 tác phẩm lớp 12, <em className="text-brand-yellow">mỗi ngày một chút</em>.
          </p>
          <p className="max-w-md text-lg opacity-90">
            Câu hỏi gợi mở, nhận xét từ AI và người bạn mèo Mướp luôn đọc cùng bạn.
          </p>
        </div>
        <p className="relative text-sm opacity-75">Readly · đồ án kỹ thuật</p>
      </aside>
      <main className="flex flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 lg:hidden">
          <Mascot pose="wave" size={110} label="" />
          <Brand />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
