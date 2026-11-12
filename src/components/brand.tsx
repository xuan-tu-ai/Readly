import Link from "next/link";
import { cn } from "@/lib/utils";

/** Cat-ear "r" mark + wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <path d="M6 16 L9 3 L18 11 Z M34 16 L31 3 L22 11 Z" fill="var(--brand-orange)" stroke="var(--brand-orange)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="4" y="8" width="32" height="28" rx="12" fill="var(--brand-orange)" />
      <ellipse cx="14.5" cy="21" rx="2.6" ry="3.2" fill="#2d2a36" />
      <ellipse cx="25.5" cy="21" rx="2.6" ry="3.2" fill="#2d2a36" />
      <path d="M18 26 h4 l-2 2.2 z" fill="#f7a1a8" />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 px-2", className)} aria-label="Readly – trang chủ">
      <LogoMark />
      <span className="text-2xl font-extrabold tracking-tight text-primary">readly</span>
    </Link>
  );
}
