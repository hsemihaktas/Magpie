import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { HeaderWrapper } from "@/components/HeaderWrapper";
import { UserEmail } from "@/components/UserEmail";
import { SettingsButton } from "@/components/SettingsButton";
import NavSearchBar from "@/components/NavSearchBar";
import { createServerClient } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magpie Archive",
  description: "Your personal social content archive",
};

async function SettingsButtonWithEmail() {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return <SettingsButton email={user.email} />;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('magpie-theme');
                const p = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && p)) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased"
        suppressHydrationWarning
      >
        <HeaderWrapper>
          <header className="sticky top-0 z-40 h-12 flex items-center gap-6 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <Image
                src="/logo-96.png"
                alt="Magpie"
                width={20}
                height={20}
                className="opacity-80"
                priority
              />
              <span className="mono text-[11px] font-semibold tracking-[0.15em] text-zinc-900 dark:text-zinc-100 uppercase">
                Magpie Archive
              </span>
            </div>

            {/* Search bar - center */}
            <Suspense fallback={null}>
              <NavSearchBar />
            </Suspense>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Suspense fallback={<div className="w-8 h-8" />}>
                <SettingsButtonWithEmail />
              </Suspense>
              <UserEmail />
            </div>
          </header>
        </HeaderWrapper>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
