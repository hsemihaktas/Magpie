import GoogleSignInButton from "@/components/GoogleSignInButton";

/**
 * Login page — Server Component.
 *
 * Reads `searchParams.error` to surface OAuth failure messages without
 * requiring a client-side hook (Requirement 3.6).
 *
 * Requirements: 3.1, 3.6, 12.2
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const oauthFailed = searchParams.error === "oauth_failed";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand area */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Magpie
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Your personal social content archive
          </p>
        </div>

        {/* OAuth error message — shown only when ?error=oauth_failed is present */}
        {oauthFailed && (
          <div
            role="alert"
            className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            Sign-in failed. Please try again or check that your Google account
            is accessible.
          </div>
        )}

        {/* Sign-in button */}
        <div className="flex flex-col items-center gap-4">
          <GoogleSignInButton />
        </div>
      </div>
    </main>
  );
}
