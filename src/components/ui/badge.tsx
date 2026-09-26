import * as React from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  draft: "bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-[#c6ccd6] ring-slate-200",
  in_review: "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 ring-amber-200",
  approved: "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 ring-emerald-200",
  changes_requested: "bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200 ring-orange-200",
  merged: "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 ring-blue-200",
  appliable: "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 ring-emerald-200",
  open: "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 ring-emerald-200",
  closed: "bg-slate-100 dark:bg-white/[0.07] text-slate-500 dark:text-[#9aa3b2] ring-slate-200",
  easy: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-emerald-100",
  medium: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-amber-100",
  hard: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 ring-rose-100"
};

export function Badge({ status, tone, className, children }: { status?: string; tone?: string; className?: string; children: React.ReactNode }) {
  const key = (tone ?? status ?? "").toLowerCase().replace(/-/g, "_");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset", tones[key] ?? "bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-[var(--yrk-text-secondary)] ring-slate-200", className)}>
      {children ?? status}
    </span>
  );
}
