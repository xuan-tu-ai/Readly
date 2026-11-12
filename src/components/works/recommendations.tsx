import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { formatReasons, type Recommendation } from "@/lib/quiz";
import type { WorkCard as WorkCardData } from "@/server/services/works";
import { WorkCard, WorkGrid, WorkShelf } from "./work-card";

export function RecommendationGrid({ items }: { items: Recommendation<WorkCardData>[] }) {
  return (
    <WorkGrid>
      {items.map(({ work, reasons }) => (
        <li key={work.id}>
          <WorkCard work={work} note={formatReasons(reasons)} />
        </li>
      ))}
    </WorkGrid>
  );
}

export function RecommendationRow({ items }: { items: Recommendation<WorkCardData>[] }) {
  return (
    <WorkShelf label="Tác phẩm gợi ý">
      {items.map(({ work, reasons }) => (
        <li key={work.id}>
          <WorkCard work={work} note={formatReasons(reasons)} />
        </li>
      ))}
    </WorkShelf>
  );
}

export function QuizCallToAction() {
  return (
    <div className="grid items-center gap-4 rounded-3xl border-2 bg-card p-6 sm:grid-cols-[auto_1fr_auto]">
      <Mascot pose="think" size={88} label="" />
      <div>
        <p className="font-heading text-xl font-semibold">Chưa biết đọc gì?</p>
        <p className="text-sm text-muted-foreground">
          Trả lời 6 câu hỏi nhanh, Mướp sẽ gợi ý tác phẩm hợp với bạn.
        </p>
      </div>
      <Link href="/student/quiz" className={buttonVariants({ variant: "blue", size: "lg", className: "uppercase" })}>
        <Sparkles aria-hidden /> Làm bài test
      </Link>
    </div>
  );
}
