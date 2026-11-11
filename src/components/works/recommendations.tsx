import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatReasons, type Recommendation } from "@/lib/quiz";
import type { WorkCard as WorkCardData } from "@/server/services/works";
import { WorkCard, WorkGrid } from "./work-card";

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

export function QuizCallToAction() {
  return (
    <div className="grid gap-3 rounded-xl border border-dashed p-6 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="font-medium">Chưa biết đọc gì?</p>
        <p className="text-sm text-muted-foreground">Trả lời 6 câu hỏi nhanh, Readly sẽ gợi ý tác phẩm hợp với bạn.</p>
      </div>
      <Link href="/student/quiz" className={buttonVariants()}>
        <Sparkles aria-hidden /> Làm bài test
      </Link>
    </div>
  );
}
