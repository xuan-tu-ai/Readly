import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/dal";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { BottomNav, SideNav, type NavItem } from "./nav-links";

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/student", label: "Trang chủ", icon: "home" },
    { href: "/student/library", label: "Thư viện", icon: "library" },
    { href: "/student/class", label: "Lớp học", icon: "users" },
  ],
  TEACHER: [{ href: "/teacher", label: "Lớp học", icon: "users" }],
  ADMIN: [{ href: "/admin", label: "Giáo viên", icon: "shield" }],
};

/**
 * Responsive app frame: sidebar on tablet/desktop, bottom navigation on phones.
 * The frame itself is static; the signed-in user streams in behind Suspense.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const items = NAV[role];
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <Brand />
        <p className="mt-1 px-2 text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
        <SideNav items={items} />
        <div className="mt-auto">
          <Suspense fallback={<UserSkeleton />}>
            <UserBlock />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <Suspense fallback={null}>
            <LogoutButton compact />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 font-semibold">
      <BookOpen className="size-5 text-primary" aria-hidden />
      Readly
    </Link>
  );
}

async function UserBlock() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="grid gap-2 border-t pt-4">
      <div className="px-2">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <LogoutButton />
    </div>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant={compact ? "ghost" : "outline"} size="sm" className="w-full">
        Đăng xuất
      </Button>
    </form>
  );
}

function UserSkeleton() {
  return <div className="h-20 animate-pulse rounded-md bg-muted" />;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Đang tải">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
