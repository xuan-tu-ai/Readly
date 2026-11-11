import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "readly_session";

/**
 * Optimistic check only: no session cookie on a protected area → login page.
 * The real check (session valid, correct role) happens in the DAL on every
 * page and server action.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"],
};
