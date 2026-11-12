import { Suspense } from "react";
import { RewardsProvider } from "@/components/gamification/celebrations";
import { PendingCelebrations } from "@/components/gamification/pending-celebrations";

/**
 * Focus screens (onboarding quiz, reader, mini games): no sidebar or bottom
 * navigation, each page brings its own minimal top bar.
 */
export default function FocusLayout({ children }: LayoutProps<"/student">) {
  return (
    <RewardsProvider>
      <div className="min-h-dvh">{children}</div>
      <Suspense fallback={null}>
        <PendingCelebrations />
      </Suspense>
    </RewardsProvider>
  );
}
