import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/dal";

/** Rendered inside Suspense on auth pages: a signed-in user goes to their home. */
export async function RedirectIfSignedIn(): Promise<null> {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  return null;
}
