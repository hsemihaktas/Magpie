/**
 * Next.js middleware for route protection.
 *
 * Runs on every request (excluding static files and the auth callback) to:
 *   1. Refresh the Supabase session cookie so it stays alive across navigations.
 *   2. Redirect unauthenticated visitors to /login (Requirement 3.2).
 *   3. Append ?reason=expired when a session cookie was present but the token
 *      had already expired (Requirement 3.7).
 *   4. Redirect authenticated users away from /login to /feed (Requirement 3.3).
 *
 * Requirements: 3.2, 3.4, 3.5, 3.7
 */

import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  // We must pass this `res` to the Supabase client so it can write the
  // refreshed session cookie onto the outgoing response.
  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(request, res);

  // Detect whether a Supabase auth cookie was sent with this request.
  // If cookies are present but getSession() returns null below, the token
  // was expired or revoked → we add ?reason=expired to the login redirect.
  const hadSessionCookie = request.cookies.getAll().some(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
  );

  // Calling getSession() also silently refreshes the access token when
  // possible and writes the new cookie into `res`.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Routes that do not require an active session
  const isPublicRoute =
    pathname === "/login" || pathname.startsWith("/auth/");

  // ── Unauthenticated → protected route ──────────────────────────────────
  if (!session && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);

    // Requirement 3.7: surface a helpful message when the cookie existed
    // but the session is no longer valid (token expired/revoked).
    if (hadSessionCookie) {
      loginUrl.searchParams.set("reason", "expired");
    }

    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated → login page ──────────────────────────────────────────
  // Requirement 3.3: send logged-in users straight to the feed.
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // Return `res` (not NextResponse.next()) so the refreshed session cookie
  // is forwarded to the browser.
  return res;
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     *   - _next/static  (static build assets)
     *   - _next/image   (image optimisation endpoint)
     *   - favicon.ico   (browser favicon request)
     *   - auth/callback (Supabase OAuth exchange — must run unauthenticated)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|auth/callback).*)",
  ],
};
