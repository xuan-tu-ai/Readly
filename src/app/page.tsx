import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/dal";
import { PageSkeleton } from "@/components/app-shell";

/** Entry point: sends each user to their own area, or to the login page. */
export default function RootPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoleRedirect />
    </Suspense>
  );
}

async function RoleRedirect(): Promise<null> {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user.role) : "/login");
}
