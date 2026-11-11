import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";
import { getRecommendations } from "@/server/services/quiz";
import { QuizCallToAction, RecommendationGrid } from "@/components/works/recommendations";

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
  const [activeClass, recommendations] = await Promise.all([
    getActiveClass(user.id),
    getRecommendations(user.id, 4),
  ]);

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

      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Gợi ý cho bạn</h2>
          <Link href="/student/library" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Xem thư viện
          </Link>
        </div>
        {recommendations ? <RecommendationGrid items={recommendations} /> : <QuizCallToAction />}
      </section>
    </div>
  );
}
