import { Suspense, type ReactNode } from "react";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/dal";
import { logoutAction } from "@/app/actions/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerChips, PlayerChipsSkeleton } from "./gamification/player-chips";
import { NotificationBell, NotificationBellSkeleton } from "./notifications/bell";
import { Brand } from "./brand";
import { BottomNav, SideNav, type NavItem } from "./nav-links";
import { InstallApp } from "./install-app";
import { ThemeToggle } from "./theme-toggle";

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/student", label: "Trang chủ", icon: "home" },
    { href: "/student/library", label: "Thư viện", icon: "library" },
    { href: "/student/leaderboard", label: "Xếp hạng", icon: "trophy" },
    { href: "/student/achievements", label: "Thành tích", icon: "award" },
    { href: "/student/class", label: "Lớp học", icon: "users" },
    { href: "/student/profile", label: "Hồ sơ", icon: "user" },
  ],
  TEACHER: [{ href: "/teacher", label: "Lớp học", icon: "users" }],
  ADMIN: [
    { href: "/admin/works", label: "Tác phẩm", icon: "library" },
    { href: "/admin/gamification", label: "Điểm & huy hiệu", icon: "award" },
    { href: "/admin/reports", label: "Báo cáo AI", icon: "flag" },
    { href: "/admin", label: "Giáo viên", icon: "shield" },
    { href: "/admin/assets", label: "Hình ảnh", icon: "image" },
  ],
};

/**
 * Responsive app frame: sidebar on tablet/desktop, bottom navigation on phones.
 * The frame itself is static; the signed-in user streams in behind Suspense.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const items = NAV[role];
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-2 bg-sidebar px-4 py-6 md:flex">
        <Brand />
        {role === "STUDENT" ? null : (
          <p className="mt-2 px-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">{ROLE_LABEL[role]}</p>
        )}
        <SideNav items={items} />
        <div className="mt-auto">
          <Suspense fallback={<UserSkeleton />}>
            <UserBlock />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-1 min-[400px]:gap-2 border-b-2 bg-background/90 px-3 py-2 backdrop-blur md:hidden">
          <Brand className={role === "STUDENT" ? "[&_span]:hidden min-[420px]:[&_span]:inline [&_span]:text-xl [&_svg]:size-7" : "[&_span]:text-xl [&_svg]:size-7"} />
          {role === "STUDENT" ? (
            <Suspense fallback={<PlayerChipsSkeleton />}>
              <PlayerChips compact />
            </Suspense>
          ) : null}
          <div className="flex items-center">
            {role === "STUDENT" ? (
              <Suspense fallback={<NotificationBellSkeleton />}>
                <NotificationBell />
              </Suspense>
            ) : null}
            <InstallApp variant="icon" />
            <ThemeToggle />
            <LogoutButton compact />
          </div>
        </header>
        {role === "STUDENT" ? (
          <div className="sticky top-0 z-10 hidden items-center justify-end gap-3 border-b-2 bg-background/90 px-10 py-2 backdrop-blur md:flex">
            <Suspense fallback={<PlayerChipsSkeleton />}>
              <PlayerChips />
            </Suspense>
            <Suspense fallback={<NotificationBellSkeleton />}>
              <NotificationBell />
            </Suspense>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-10">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}

async function UserBlock() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="grid gap-3 rounded-2xl border-2 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
          {initial(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <InstallApp variant="menu" />
      <ThemeToggle withLabel />
      <LogoutButton />
    </div>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      {compact ? (
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="Đăng xuất">
          <LogOut />
        </Button>
      ) : (
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Đăng xuất
        </Button>
      )}
    </form>
  );
}

function UserSkeleton() {
  return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Đang tải">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

/** First letter of the given name (Vietnamese names end with the given name). */
function initial(name: string) {
  return name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
}
