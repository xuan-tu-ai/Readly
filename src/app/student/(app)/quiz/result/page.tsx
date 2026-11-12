import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RotateCcw } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { MascotSays } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { RecommendationGrid } from "@/components/works/recommendations";
import { requireUser } from "@/server/auth/dal";
import { getRecommendations } from "@/server/services/quiz";

export const metadata: Metadata = { title: "Gợi ý cho bạn" };

export default function QuizResultPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuizResult />
    </Suspense>
  );
}

async function QuizResult() {
  const user = await requireUser("STUDENT");
  const recommendations = await getRecommendations(user.id);
  if (!recommendations) redirect("/student/quiz");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <MascotSays pose="cheer" size={96}>
          <span className="block font-heading text-2xl font-semibold">Gợi ý cho bạn</span>
          <span className="text-muted-foreground">Mướp chọn theo câu trả lời mới nhất của bạn.</span>
        </MascotSays>
        <Link href="/student/quiz" className={buttonVariants({ variant: "outline", className: "uppercase" })}>
          <RotateCcw aria-hidden /> Làm lại bài test
        </Link>
      </div>
      {recommendations.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed p-8 text-center text-muted-foreground">
          Chưa tìm được tác phẩm phù hợp.{" "}
          <Link href="/student/library" className="font-medium text-primary underline-offset-4 hover:underline">
            Xem cả thư viện
          </Link>
        </p>
      ) : (
        <RecommendationGrid items={recommendations} />
      )}
    </div>
  );
}
