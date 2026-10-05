/**
 * OAuth callback route handler.
 *
 * Supabase redirects back here after the Google OAuth flow completes.
 * This handler exchanges the authorization `code` for a session, then
 * redirects the user to the feed on success or back to the login page
 * with an error on failure.
 *
 * Requirements: 3.3, 3.6
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", request.url)
    );
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerSupabaseClient(cookieStore);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        new URL("/login?error=oauth_failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/feed", request.url));
  } catch (err) {
    console.error("[auth/callback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", request.url)
    );
  }
}
