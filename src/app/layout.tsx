import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = { title: "YRK Question Bank", description: "Collaborative question bank + interactive quiz prep" };

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem('yrk-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-[var(--yrk-surface-canvas)] text-slate-900 dark:text-[var(--yrk-text-primary)] antialiased dark:bg-[#0f1115] dark:text-[#eceef2]">
        <Script id="yrk-theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:py-8 md:pb-8">{children}</main>
        <MobileNav />
        <Toaster />
        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-6 pb-10 pt-4 text-xs tracking-wide text-slate-400 dark:text-[var(--yrk-text-tertiary)]">
          <span>YRK Question Bank, built together, learned together.</span>
          <a href="/terms" className="font-medium hover:text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:underline">Terms</a>
          <a href="/bank" className="font-medium hover:text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:underline">Bank</a>
          <a href="/play" className="font-medium hover:text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:underline">Play</a>
          <a href="/archive" className="font-medium hover:text-slate-600 dark:text-[var(--yrk-text-secondary)] hover:underline">Archive</a>
        </footer>
      </body>
    </html>
  );
}
