import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = { title: "YRK Question Bank", description: "Collaborative question bank + interactive quiz prep" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <Toaster />
        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-6 pb-10 pt-4 text-xs tracking-wide text-slate-400">
          <span>YRK Question Bank, built together, learned together.</span>
          <a href="/terms" className="font-medium hover:text-slate-600 hover:underline">Terms</a>
          <a href="/bank" className="font-medium hover:text-slate-600 hover:underline">Bank</a>
          <a href="/play" className="font-medium hover:text-slate-600 hover:underline">Play</a>
          <a href="/archive" className="font-medium hover:text-slate-600 hover:underline">Archive</a>
        </footer>
      </body>
    </html>
  );
}
