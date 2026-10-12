/**
 * Global Loading State
 *
 * Shown during page transitions and initial load.
 * Matches auth callback loading style.
 */

import Image from "next/image";

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo-dark@2x.png"
            alt="Magpie"
            width={48}
            height={48}
            className="dark:hidden"
            priority
          />
          <Image
            src="/logo@2x.png"
            alt="Magpie"
            width={48}
            height={48}
            className="hidden dark:block"
            priority
          />
        </div>

        {/* Spinner */}
        <div className="w-10 h-10 border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin mx-auto" />

        <p className="mono text-sm text-zinc-500">Yükleniyor...</p>
      </div>
    </div>
  );
}
