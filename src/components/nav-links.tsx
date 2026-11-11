"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Home, Shield, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { home: Home, users: Users, shield: Shield } satisfies Record<string, LucideIcon>;

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
          ? "mt-6 grid gap-1"
          : "fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      }
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              side
                ? "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                : "flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground",
              active &&
                (side
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "font-medium text-primary"),
            )}
          >
            <Icon className={side ? "size-4" : "size-5"} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
