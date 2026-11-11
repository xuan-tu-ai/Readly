"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { refreshQuestionsAction, submitAnswerAction } from "@/app/actions/questions";
import { isResolved } from "@/lib/questions/rules";
import type { ReaderData } from "@/server/services/reading";

const POLL_MS = 5_000;
type Completion = ReaderData["completion"];

/**
 * Question state for the reader: submitting answers, polling while an answer
 * waits for AI feedback, and refreshing completion after new segments are read.
 */
export function useQuestions(data: ReaderData, readCount: number) {
  const [questions, setQuestions] = useState(data.questions);
  const [completion, setCompletion] = useState<Completion>(data.completion);

  const refresh = useCallback(async () => {
    const result = await refreshQuestionsAction(data.work.id);
    if (result.ok) {
      setQuestions(result.data.questions);
      setCompletion(result.data.completion);
    }
  }, [data.work.id]);

  const submit = useCallback(
    async (questionId: string, content: string): Promise<string | null> => {
      const result = await submitAnswerAction({ questionId, workId: data.work.id, content });
      if (!result.ok) return result.error;
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? result.data.question : q)));
      setCompletion(result.data.completion);
      return null;
    },
    [data.work.id],
  );

  const anyPending = questions.some((q) => q.state.status === "pending");
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [anyPending, refresh]);

  // New segments read → the server may now consider the work complete.
  const [seenReads, setSeenReads] = useState(readCount);
  useEffect(() => {
    if (readCount === seenReads) return;
    const timer = setTimeout(() => {
      setSeenReads(readCount);
      void refresh();
    }, 2_500); // after the tracker has reported the reads
    return () => clearTimeout(timer);
  }, [readCount, seenReads, refresh]);

  const bySegment = useMemo(() => {
    const map = new Map<string, typeof questions>();
    for (const q of questions) {
      if (q.stage !== "DURING" || !q.segmentId) continue;
      map.set(q.segmentId, [...(map.get(q.segmentId) ?? []), q]);
    }
    return map;
  }, [questions]);

  /** Segments that still have a required, unresolved question. */
  const owedSegments = useMemo(
    () =>
      new Set(
        questions.filter((q) => q.required && q.segmentId && !isResolved(q.state)).map((q) => q.segmentId as string),
      ),
    [questions],
  );

  return {
    pre: questions.filter((q) => q.stage === "PRE"),
    post: questions.filter((q) => q.stage === "POST"),
    bySegment,
    owedSegments,
    completion,
    submit,
  };
}
