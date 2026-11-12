import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ClassTabs } from "@/components/teacher/class-tabs";
import { requireUser } from "@/server/auth/dal";
import { assertTeacherOfClass } from "@/server/authz";
import { DomainError } from "@/server/errors";

/** Header and tabs shared by every page of one class. */
export default function ClassLayout({ children, params }: LayoutProps<"/teacher/classes/[classId]">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <ClassHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function ClassHeader({ params }: Pick<LayoutProps<"/teacher/classes/[classId]">, "params">) {
  const { classId } = await params;
  const user = await requireUser("TEACHER");
  let cls;
  try {
    cls = await assertTeacherOfClass(user, classId);
  } catch (error) {
    // Another teacher's class looks the same as a missing one.
    if (error instanceof DomainError) notFound();
    throw error;
  }
  return (
    <header className="grid gap-4">
      <div>
        <Link
          href="/teacher"
          className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> Tất cả lớp
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-semibold">{cls.name}</h1>
          <p className="text-sm text-muted-foreground">
            Mã lớp <span className="font-mono font-bold tracking-widest text-foreground">{cls.code}</span>
            {cls.codeActive ? "" : " (đã khóa)"}
          </p>
        </div>
      </div>
      <ClassTabs classId={cls.id} />
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      <div className="h-9 w-48 animate-pulse rounded-xl bg-muted" />
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
