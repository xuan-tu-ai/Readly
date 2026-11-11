import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { resetTeacherPasswordAction } from "@/app/actions/admin";
import { requireUser } from "@/server/auth/dal";
import { listTeachers } from "@/server/services/accounts";
import { CreateTeacherForm } from "./create-teacher-form";

export const metadata: Metadata = { title: "Giáo viên" };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const user = await requireUser("ADMIN");
  const teachers = await listTeachers(user);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Tài khoản giáo viên</h1>

      {teachers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          Chưa có giáo viên nào.
        </p>
      ) : (
        <ul className="grid gap-3">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <Card>
                <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="font-medium">{teacher.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {teacher.email} · {teacher._count.classesTaught} lớp
                    </p>
                  </div>
                  <div className="sm:w-64">
                    <ResetPasswordForm
                      userId={teacher.id}
                      userName={teacher.name}
                      action={resetTeacherPasswordAction}
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tạo tài khoản giáo viên</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTeacherForm />
        </CardContent>
      </Card>
    </div>
  );
}
