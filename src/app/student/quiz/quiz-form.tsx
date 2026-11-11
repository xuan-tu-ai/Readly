"use client";

import { useActionState, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { submitQuizAction } from "@/app/actions/quiz";
import { FormAlert, SubmitButton } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/form-state";
import type { QuizAnswers, QuizQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/** One question per screen; choosing an option moves to the next one. */
export function QuizForm({ questions }: { questions: QuizQuestion[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [state, formAction] = useActionState(submitQuizAction, initialFormState);

  const done = step >= questions.length;
  const question = questions[Math.min(step, questions.length - 1)];

  function choose(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    setStep((s) => s + 1);
  }

  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{done ? "Hoàn tất" : `Câu ${step + 1}/${questions.length}`}</span>
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft aria-hidden /> Quay lại
            </Button>
          ) : null}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Tiến độ bài test"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={Math.min(step, questions.length)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${(Math.min(step, questions.length) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {done ? (
        <form action={formAction} className="grid gap-4">
          {questions.map((q) => (
            <input key={q.id} type="hidden" name={q.id} value={answers[q.id] ?? ""} />
          ))}
          <p className="text-lg">Xong rồi! Bấm để xem những tác phẩm hợp với bạn.</p>
          <FormAlert state={state} />
          <SubmitButton size="lg" className="justify-self-start" pendingText="Đang tìm tác phẩm…">
            Xem gợi ý
          </SubmitButton>
        </form>
      ) : (
        <fieldset key={question.id} className="grid gap-3">
          <legend className="mb-3 text-xl font-semibold">{question.prompt}</legend>
          {question.options.map((option) => {
            const selected = answers[question.id] === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(option.id)}
                className={cn(
                  "rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected && "border-primary bg-primary/10 font-medium",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
