import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { RewardsProvider } from "@/components/gamification/celebrations";
import { PendingCelebrations } from "@/components/gamification/pending-celebrations";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return (
    <RewardsProvider>
      <AppShell role="STUDENT">{children}</AppShell>
      <Suspense fallback={null}>
        <PendingCelebrations />
      </Suspense>
    </RewardsProvider>
  );
}
