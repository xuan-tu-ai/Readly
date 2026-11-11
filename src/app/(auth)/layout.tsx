import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <BookOpen className="size-6 text-primary" aria-hidden />
        Readly
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
