import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";

export const metadata: Metadata = { title: "Trang chủ" };

export default function StudentHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentHome />
    </Suspense>
  );
}

async function StudentHome() {
  const user = await requireUser("STUDENT");
  const activeClass = await getActiveClass(user.id);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chào {user.name}!</h1>
        <p className="text-muted-foreground">Hôm nay bạn muốn đọc gì?</p>
      </div>

      {activeClass ? (
        <Card>
          <CardHeader>
            <CardDescription>Lớp của bạn</CardDescription>
            <CardTitle>{activeClass.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Giáo viên: {activeClass.teacher.name}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle>Bạn chưa thuộc lớp nào</CardTitle>
            <CardDescription>
              Bạn vẫn đọc được, nhưng cần nhập mã lớp mới để nhận bài giao và tham gia thảo luận.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/student/class" className={buttonVariants()}>
              Nhập mã lớp
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thư viện đang được chuẩn bị</CardTitle>
          <CardDescription>
            Thư viện 45 tác phẩm và bài test sở thích sẽ có ở giai đoạn tiếp theo.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
