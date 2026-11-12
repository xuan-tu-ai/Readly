"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Award, BookOpenText, Home, Image as ImageIcon, Shield, Trophy, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  home: { icon: Home, tone: "bg-brand-orange text-white" },
  library: { icon: BookOpenText, tone: "bg-primary text-white" },
  users: { icon: Users, tone: "bg-brand-blue text-white" },
  shield: { icon: Shield, tone: "bg-brand-purple text-white" },
  image: { icon: ImageIcon, tone: "bg-brand-pink text-white" },
  trophy: { icon: Trophy, tone: "bg-[#f7b72a] text-white" },
  award: { icon: Award, tone: "bg-brand-purple text-white" },
} satisfies Record<string, { icon: LucideIcon; tone: string }>;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

type Variant = "side" | "bottom";
type IsActive = (href: string) => boolean;

const never: IsActive = () => false;

// Exact match for section roots (/student), prefix match for sub-pages.
function isActiveFor(pathname: string): IsActive {
  return (href) =>
    pathname === href || (href.split("/").length > 2 && pathname.startsWith(`${href}/`));
}

/**
 * The pathname is request data, so the highlighted state streams in behind
 * Suspense; the links themselves are part of the static shell.
 */
export function SideNav({ items }: { items: NavItem[] }) {
  return <Nav items={items} variant="side" />;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  return <Nav items={items} variant="bottom" />;
}

function Nav({ items, variant }: { items: NavItem[]; variant: Variant }) {
  return (
    <Suspense fallback={<NavView items={items} variant={variant} isActive={never} />}>
      <LiveNav items={items} variant={variant} />
    </Suspense>
  );
}

function LiveNav({ items, variant }: { items: NavItem[]; variant: Variant }) {
  const pathname = usePathname();
  return <NavView items={items} variant={variant} isActive={isActiveFor(pathname)} />;
}

function NavView({ items, variant, isActive }: { items: NavItem[]; variant: Variant; isActive: IsActive }) {
  const side = variant === "side";
  return (
    <nav
      aria-label="Điều hướng chính"
      className={
        side
          ? "mt-8 grid gap-2"
          : "fixed inset-x-0 bottom-0 z-20 flex justify-around border-t-2 bg-card px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      }
    >
      {items.map((item) => {
        const { icon: Icon, tone } = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-2 border-transparent transition-colors",
              side
                ? "flex items-center gap-4 rounded-xl px-3 py-2.5 text-sm font-bold tracking-wide text-sidebar-foreground uppercase hover:bg-muted"
                : "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[0.65rem] font-bold text-muted-foreground min-[400px]:px-3",
              active &&
                (side
                  ? "border-sidebar-accent-foreground/40 bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  : "border-sidebar-accent-foreground/30 bg-sidebar-accent text-sidebar-accent-foreground"),
            )}
          >
            <span className={cn("grid size-8 place-items-center rounded-lg", tone, !active && !side && "opacity-80")}>
              <Icon className="size-[18px]" aria-hidden strokeWidth={2.5} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
