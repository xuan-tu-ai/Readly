"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  BookHeart,
  BookOpen,
  Brain,
  Clock3,
  Drama,
  Feather,
  Flame,
  Hourglass,
  Landmark,
  Laugh,
  Mountain,
  Newspaper,
  Swords,
  Timer,
  Trees,
  UsersRound,
  Heart,
  Sparkles,
  Sprout,
  CloudRain,
  Gem,
  MessageSquareQuote,
  Lightbulb,
  Footprints,
  X,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { submitQuizAction } from "@/app/actions/quiz";
import { FormAlert, SubmitButton } from "@/components/form-fields";
import { Mascot, type MascotPose } from "@/components/mascot/mascot";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { initialFormState } from "@/lib/form-state";
import type { QuizAnswers, QuizQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/** Illustration for each option: icon + tile colour (falls back by position). */
const OPTION_ART: Record<string, { icon: LucideIcon; tone: string }> = {
  "genre:tho": { icon: Feather, tone: "bg-brand-pink" },
  "genre:truyen": { icon: BookOpen, tone: "bg-brand-orange" },
  "genre:kich": { icon: Drama, tone: "bg-brand-purple" },
  "genre:ki-nghi-luan": { icon: Newspaper, tone: "bg-brand-blue" },
  "length:short": { icon: Timer, tone: "bg-primary" },
  "length:medium": { icon: Clock3, tone: "bg-brand-blue" },
  "length:long": { icon: Hourglass, tone: "bg-brand-purple" },
  "mood:tru-tinh": { icon: CloudRain, tone: "bg-brand-blue" },
  "mood:hao-hung": { icon: Flame, tone: "bg-brand-orange" },
  "mood:bi-trang": { icon: BookHeart, tone: "bg-brand-pink" },
  "mood:hai-huoc": { icon: Laugh, tone: "bg-brand-yellow" },
  "mood:suy-tu": { icon: Brain, tone: "bg-brand-purple" },
  "theme:gia-dinh": { icon: UsersRound, tone: "bg-brand-orange" },
  "theme:que-huong": { icon: Trees, tone: "bg-primary" },
  "theme:chien-tranh": { icon: Swords, tone: "bg-[#8a6a4f]" },
  "theme:tinh-yeu": { icon: Heart, tone: "bg-brand-pink" },
  "theme:con-nguoi": { icon: Landmark, tone: "bg-brand-blue" },
  "challenge:easy": { icon: Sprout, tone: "bg-primary" },
  "challenge:medium": { icon: Footprints, tone: "bg-brand-orange" },
  "challenge:hard": { icon: Mountain, tone: "bg-brand-purple" },
  "focus:story": { icon: Sparkles, tone: "bg-brand-orange" },
  "focus:language": { icon: Gem, tone: "bg-brand-pink" },
  "focus:ideas": { icon: Lightbulb, tone: "bg-brand-yellow" },
  "focus:real": { icon: MessageSquareQuote, tone: "bg-brand-blue" },
};
const FALLBACK_TONES = ["bg-primary", "bg-brand-orange", "bg-brand-blue", "bg-brand-purple", "bg-brand-pink"];

/** What Mướp says above each question. */
const MASCOT_LINES: { pose: MascotPose; line: string }[] = [
  { pose: "wave", line: "Bắt đầu từ cái dễ nhé!" },
  { pose: "think", line: "Bạn hay có bao nhiêu thời gian?" },
  { pose: "read", line: "Cảm xúc cũng quan trọng lắm." },
  { pose: "think", line: "Chủ đề nào hấp dẫn bạn?" },
  { pose: "idle", line: "Sắp xong rồi!" },
  { pose: "read", line: "Câu cuối cùng!" },
];

/**
 * Brilliant-style onboarding: an optional welcome screen, then one question
 * per screen (pick a card, then "Tiếp tục"), then a summary with the submit.
 */
export function QuizForm({ questions, welcomeName }: { questions: QuizQuestion[]; welcomeName: string | null }) {
  const [step, setStep] = useState(welcomeName ? -1 : 0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [state, formAction] = useActionState(submitQuizAction, initialFormState);

  const done = step >= questions.length;
  const question = step >= 0 && !done ? questions[step] : null;
  const chosen = question ? answers[question.id] : undefined;
  const mascot = MASCOT_LINES[step] ?? MASCOT_LINES[0];

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-3xl grid-rows-[auto_1fr_auto] px-4 sm:px-6">
      <header className="flex items-center gap-4 py-5">
        {step > 0 ? (
          <Button variant="ghost" size="icon" aria-label="Câu trước" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="size-6" />
          </Button>
        ) : (
          <Link href="/student" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Đóng bài test">
            <X className="size-6" />
          </Link>
        )}
        <ProgressBar
          value={Math.max(0, Math.min(step, questions.length))}
          max={questions.length}
          label="Tiến độ bài test"
          className="flex-1"
        />
      </header>

      {step === -1 ? (
        <section className="grid animate-rise-in content-center justify-items-center gap-6 py-8 text-center">
          <Mascot pose="wave" size={180} />
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
            Chào {welcomeName}, mình là <span className="text-brand-orange italic">Mướp</span>!
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Mình sẽ đọc cùng bạn 45 tác phẩm lớp 12. Trả lời 6 câu hỏi nhanh để mình biết nên gợi ý gì nhé.
          </p>
        </section>
      ) : question ? (
        <section key={question.id} className="grid animate-rise-in content-center gap-8 py-8">
          <div className="flex items-center gap-4">
            <Mascot pose={mascot.pose} size={92} label="" />
            <div className="grid gap-1">
              <p className="text-sm font-bold text-muted-foreground">
                Câu {step + 1}/{questions.length} · {mascot.line}
              </p>
              <h1 id={`q-${question.id}`} className="font-heading text-2xl leading-snug font-semibold sm:text-3xl">
                {question.prompt}
              </h1>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-labelledby={`q-${question.id}`}
            className={cn("grid gap-3", question.options.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3")}
          >
            {question.options.map((option, i) => {
              const art = OPTION_ART[`${question.id}:${option.id}`];
              const Icon = art?.icon ?? Sparkles;
              const selected = chosen === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left font-semibold shadow-[0_4px_0_var(--border)] transition-[transform,box-shadow,background-color] duration-100 hover:bg-muted active:translate-y-1 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2",
                    question.options.length <= 3 && "sm:flex-col sm:py-6 sm:text-center",
                    selected &&
                      "border-brand-blue bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_4px_0_var(--brand-blue)] hover:bg-sidebar-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-xl text-white",
                      art?.tone ?? FALLBACK_TONES[i % FALLBACK_TONES.length],
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <form action={formAction} className="grid animate-rise-in content-center justify-items-center gap-6 py-8 text-center">
          {questions.map((q) => (
            <input key={q.id} type="hidden" name={q.id} value={answers[q.id] ?? ""} />
          ))}
          <Mascot pose="cheer" size={170} />
          <h1 className="font-heading text-3xl font-semibold">Xong rồi!</h1>
          <p className="max-w-md text-lg text-muted-foreground">Mướp đã hiểu gu đọc của bạn. Xem những tác phẩm hợp với bạn nhé.</p>
          <FormAlert state={state} />
          <SubmitButton size="xl" className="w-full max-w-sm uppercase" pendingText="Đang tìm tác phẩm…">
            Xem gợi ý
          </SubmitButton>
        </form>
      )}

      {done ? null : (
        <footer className="sticky bottom-0 -mx-4 border-t-2 bg-background px-4 py-5 sm:-mx-6 sm:px-6">
          <Button
            size="xl"
            className="w-full uppercase sm:ml-auto sm:flex sm:w-56"
            disabled={step >= 0 && !chosen}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === -1 ? "Bắt đầu" : step === questions.length - 1 ? "Hoàn tất" : "Tiếp tục"}
          </Button>
        </footer>
      )}
    </div>
  );
}
