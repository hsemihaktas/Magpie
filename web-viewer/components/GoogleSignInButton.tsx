"use client";

import { createBrowserClient } from "@/lib/supabase.browser";

/**
 * Client Component that initiates the Google OAuth flow via Supabase.
 *
 * Redirects back to /auth/callback after Google completes authentication,
 * using window.location.origin so it works in any environment (local, preview,
 * production) without hard-coding a URL.
 *
 * Requirements: 3.1, 12.2
 */
export default function GoogleSignInButton() {
  async function handleSignIn() {
    const supabase = createBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <button
      onClick={handleSignIn}
      className="flex items-center justify-center gap-3 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      {/* Google "G" logo */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.2z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z"
        />
        <path
          fill="#FBBC05"
          d="M10.8 28.8A14.7 14.7 0 0 1 10 24c0-1.7.3-3.3.8-4.8v-6.2H2.7A24 24 0 0 0 0 24c0 3.9.9 7.6 2.7 10.9l8.1-6.1z"
        />
        <path
          fill="#EA4335"
          d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.4 30.5 0 24 0 14.8 0 6.7 5.2 2.7 13.1l8.1 6.1C12.7 13.6 17.9 9.5 24 9.5z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
