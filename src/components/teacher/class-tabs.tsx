"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BarChart3, Highlighter, MessageSquareText, MessagesSquare, Settings, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "", label: "Tổng quan", icon: BarChart3 },
  { path: "/students", label: "Học sinh", icon: Users },
  { path: "/answers", label: "Câu trả lời", icon: MessageSquareText },
  { path: "/highlights", label: "Highlight", icon: Highlighter },
  { path: "/discussions", label: "Thảo luận", icon: MessagesSquare },
  { path: "/settings", label: "Cài đặt lớp", icon: Settings },
];

/** Section tabs of one class. The active tab is request data, so it streams in. */
export function ClassTabs({ classId }: { classId: string }) {
  return (
    <Suspense fallback={<TabsView classId={classId} active={null} />}>
      <LiveTabs classId={classId} />
    </Suspense>
  );
}

function LiveTabs({ classId }: { classId: string }) {
  const pathname = usePathname();
  const base = `/teacher/classes/${classId}`;
  const active =
    [...TABS].reverse().find((t) => (t.path ? pathname.startsWith(base + t.path) : pathname === base))?.path ?? null;
  return <TabsView classId={classId} active={active} />;
}

function TabsView({ classId, active }: { classId: string; active: string | null }) {
  return (
    <nav aria-label="Mục của lớp" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b-2">
        {TABS.map(({ path, label, icon: Icon }) => {
          const current = active === path;
          return (
            <li key={path}>
              <Link
                href={`/teacher/classes/${classId}${path}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-0.5 flex items-center gap-2 border-b-[3px] border-transparent px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground",
                  current && "border-primary text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
