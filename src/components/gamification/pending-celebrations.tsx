import { getCurrentUser } from "@/server/auth/dal";
import { getCelebrations } from "@/server/services/gamification";
import { CelebrateOnMount } from "./celebrations";

/**
 * Badges and level-ups earned while the student was elsewhere (e.g. an essay
 * graded by the worker). Render inside <Suspense> under a RewardsProvider.
 */
export async function PendingCelebrations() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return null;
  const celebrations = await getCelebrations(user.id);
  if (celebrations.badges.length === 0 && !celebrations.levelUp) return null;
  return <CelebrateOnMount celebrations={celebrations} />;
}
