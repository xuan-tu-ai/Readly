import { getCurrentUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { track, trackPayloadSchema } from "@/server/services/reading";

/**
 * Reader tracking endpoint (progress, read segments, active time).
 * A route handler rather than a server action so the page can send its last
 * batch with `navigator.sendBeacon` while closing.
 */
export async function POST(request: Request) {
  // Same-origin only. The session cookie is SameSite=Lax, this is defence in depth.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(await request.text()); // sendBeacon posts text/plain
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = trackPayloadSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    await track(user, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return new Response(null, { status: 404 });
    throw error;
  }
  return new Response(null, { status: 204 });
}
