import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/dal";
import { listTeacherClasses } from "@/server/services/classes";
import { CreateClassForm } from "./create-class-form";

export const metadata: Metadata = { title: "Lớp học" };

export default function TeacherHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeacherHome />
    </Suspense>
  );
}

async function TeacherHome() {
  const user = await requireUser("TEACHER");
  const classes = await listTeacherClasses(user);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Lớp học của bạn</h1>
        <p className="text-muted-foreground">Chào {user.name}.</p>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          Bạn chưa có lớp nào. Tạo lớp đầu tiên rồi gửi mã lớp cho học sinh để các em đăng ký.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((cls) => (
            <li key={cls.id}>
              <Link href={`/teacher/classes/${cls.id}`} className="block rounded-xl focus-visible:outline-2">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{cls.name}</CardTitle>
                    <CardDescription>
                      {cls.studentCount} học sinh · {cls.openAssignments} bài đang giao · mã{" "}
                      <span className="font-mono tracking-widest">{cls.code}</span>
                      {cls.codeActive ? "" : " (đã khóa)"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tạo lớp mới</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateClassForm />
        </CardContent>
      </Card>
    </div>
  );
}
