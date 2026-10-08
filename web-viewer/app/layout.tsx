import type { Metadata } from "next";
import Image from "next/image";
import { HeaderWrapper } from "@/components/HeaderWrapper";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import { UserEmail } from "@/components/UserEmail";

export const metadata: Metadata = {
  title: "Magpie",
  description: "Your personal social content archive",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash */}
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
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        {/* Header — hidden on login page, always visible otherwise */}
        <HeaderWrapper>
        <header className="sticky top-0 z-40 h-14 flex items-center px-6 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-1">
            <Image
              src="/logo.png"
              alt="Magpie"
              width={28}
              height={28}
              className="rounded-lg"
              priority
            />
            <span className="font-semibold text-gray-900 dark:text-white tracking-tight">
              Magpie
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserEmail />
          </div>
        </header>
        </HeaderWrapper>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
