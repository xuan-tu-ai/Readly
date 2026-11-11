import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";
import { getRecommendations } from "@/server/services/quiz";
import { getContinueReading } from "@/server/services/reading";
import { WorkCover } from "@/components/works/work-cover";
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
  const [activeClass, recommendations, continueReading] = await Promise.all([
    getActiveClass(user.id),
    getRecommendations(user.id, 4),
    getContinueReading(user.id),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chào {user.name}!</h1>
        <p className="text-muted-foreground">Hôm nay bạn muốn đọc gì?</p>
      </div>

      {continueReading ? (
        <Card>
          <CardContent className="grid grid-cols-[72px_1fr] items-center gap-4 sm:grid-cols-[72px_1fr_auto]">
            <WorkCover title={continueReading.title} genre={continueReading.genre} coverUrl={continueReading.coverUrl} />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Đang đọc</p>
              <p className="truncate font-medium">{continueReading.title}</p>
              <p className="text-sm text-muted-foreground">
                {continueReading.readSegments}/{continueReading.totalSegments} phân đoạn
              </p>
            </div>
            <Link
              href={`/student/read/${continueReading.slug}`}
              className={buttonVariants({ className: "col-span-2 sm:col-span-1" })}
            >
              Tiếp tục đọc
            </Link>
          </CardContent>
        </Card>
      ) : null}

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
