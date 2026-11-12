"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FileText, Gamepad2, ListChecks, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "", label: "Thông tin", icon: FileText },
  { path: "/text", label: "Văn bản", icon: ScrollText },
  { path: "/questions", label: "Câu hỏi", icon: ListChecks },
  { path: "/games", label: "Mini game", icon: Gamepad2 },
];

export function WorkTabs({ workId }: { workId: string }) {
  return (
    <Suspense fallback={<View workId={workId} active={null} />}>
      <Live workId={workId} />
    </Suspense>
  );
}

function Live({ workId }: { workId: string }) {
  const pathname = usePathname();
  const base = `/admin/works/${workId}`;
  const active =
    [...TABS].reverse().find((t) => (t.path ? pathname.startsWith(base + t.path) : pathname === base))?.path ??
    (pathname.startsWith(`${base}/import`) ? "/text" : null);
  return <View workId={workId} active={active} />;
}

function View({ workId, active }: { workId: string; active: string | null }) {
  return (
    <nav aria-label="Mục của tác phẩm" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b-2">
        {TABS.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              href={`/admin/works/${workId}${path}`}
              aria-current={active === path ? "page" : undefined}
              className={cn(
                "-mb-0.5 flex items-center gap-2 border-b-[3px] border-transparent px-3 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground",
                active === path && "border-primary text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
