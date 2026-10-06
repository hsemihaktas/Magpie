import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; reason?: string } }) {
  const oauthFailed = searchParams.error === "oauth_failed";
  const expired = searchParams.reason === "expired";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="text-5xl mb-2">🪶</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Magpie</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your personal social content archive
          </p>
        </div>

        {/* Error messages */}
        {oauthFailed && (
          <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400 text-center">
            Sign-in failed. Please try again.
          </div>
        )}
        {expired && (
          <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 text-center">
            Your session has expired. Please sign in again.
          </div>
        )}

        {/* Sign-in */}
        <div className="flex justify-center">
          <GoogleSignInButton />
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          Only you can see your saved content.
        </p>
      </div>
    </div>
  );
}
