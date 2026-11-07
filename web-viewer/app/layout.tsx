import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderWrapper } from "@/components/HeaderWrapper";
import { UserEmail } from "@/components/UserEmail";
import { SettingsButton } from "@/components/SettingsButton";
import NavSearchBar from "@/components/NavSearchBar";
import { AuthSyncProvider } from "@/components/AuthSyncProvider";
import { NavbarAuth } from "@/components/NavbarAuth";
import { createServerClient } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magpie Archive",
  description: "Your personal social content archive",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Magpie",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
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
        {/* JetBrains Mono — loaded via link to avoid next/font loader bug in 14.2.x */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Theme detection (before paint) */}
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
        {/* PWA Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(e) {
                    console.log('SW registration failed:', e);
                  });
                });
              }
            `,
          }}
        />
        {/* iOS PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/logo-512.png" />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased"
        suppressHydrationWarning
      >
        <AuthSyncProvider>
          <HeaderWrapper>
            <header className="sticky top-0 z-40 h-12 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              {/* Left side - Logo */}
              <Link
                href="/feed"
                className="flex items-center gap-3 shrink-0 w-48"
              >
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
              </Link>

              {/* Center - Search bar (only on /feed) */}
              <div className="flex-1 flex justify-center px-8">
                <Suspense fallback={null}>
                  <NavSearchBar />
                </Suspense>
              </div>

              {/* Right side - auth-dependent components */}
              <div className="flex items-center gap-2 shrink-0 w-48 justify-end">
                <NavbarAuth>
                  <Suspense fallback={null}>
                    <SettingsButtonWithEmail />
                  </Suspense>
                  <Suspense fallback={null}>
                    <UserEmail />
                  </Suspense>
                </NavbarAuth>
              </div>
            </header>
          </HeaderWrapper>

          <main className="flex-1">{children}</main>
        </AuthSyncProvider>
      </body>
    </html>
  );
}
