import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { resetStudentPasswordAction } from "@/app/actions/teacher";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { getClassRoster } from "@/server/services/classes";
import { ClassCodeControls, RemoveStudentButton } from "./class-controls";

export const metadata: Metadata = { title: "Chi tiết lớp" };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

async function loadRoster(classId: string) {
  const user = await requireUser("TEACHER");
  try {
    return await getClassRoster(user, classId);
  } catch (error) {
    // Another teacher's class looks the same as a missing one.
    if (error instanceof DomainError) notFound();
    throw error;
  }
}

export default function ClassDetailPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassDetail params={params} />
    </Suspense>
  );
}

async function ClassDetail({ params }: Pick<PageProps<"/teacher/classes/[classId]">, "params">) {
  const { classId } = await params;
  const { class: cls, students } = await loadRoster(classId);

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Tất cả lớp
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{cls.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Mã lớp</CardDescription>
          <CardTitle className="font-mono text-3xl tracking-[0.3em]">{cls.code}</CardTitle>
          <CardDescription>
            {cls.codeActive
              ? "Học sinh dùng mã này để đăng ký hoặc chuyển vào lớp."
              : "Mã đang bị khóa – không ai đăng ký thêm được."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassCodeControls classId={cls.id} codeActive={cls.codeActive} />
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Học sinh ({students.length})</h2>
        {students.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            Chưa có học sinh nào. Gửi mã lớp để các em đăng ký.
          </p>
        ) : (
          <ul className="grid gap-3">
            {students.map((student) => (
              <li key={student.id}>
                <Card>
                  <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="font-medium">{student.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {student.email} · vào lớp {dateFormat.format(student.joinedAt)}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:w-64">
                      <ResetPasswordForm
                        userId={student.id}
                        userName={student.name}
                        action={resetStudentPasswordAction}
                      />
                      <RemoveStudentButton classId={cls.id} studentId={student.id} studentName={student.name} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
