import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHero({ eyebrow, title, description, actions, tone = "light" }: {
  eyebrow: string; title: string; description: string; actions?: React.ReactNode; tone?: "light" | "dark";
}) {
  return (
    <div className={cn("overflow-hidden rounded-3xl p-6 shadow-soft sm:p-8", tone === "dark" ? "bg-slate-900 text-white dark:border dark:border-white/10" : "border border-slate-200/80 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)]")}>
      <div className={cn("text-[11px] font-bold uppercase tracking-[0.14em]", tone === "dark" ? "text-brand-300" : "text-brand-600")}>{eyebrow}</div>
      <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight sm:text-[28px] sm:leading-tight">{title}</h1>
      <p className={cn("mt-2 max-w-2xl text-[14px] leading-relaxed", tone === "dark" ? "text-slate-300" : "text-slate-500 dark:text-[#9aa3b2]")}>{description}</p>
      {actions && <div className="mt-5 grid gap-2.5 sm:flex sm:flex-wrap sm:items-center">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white/60 px-6 py-10 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="max-w-sm text-[13px] text-slate-500 dark:text-[#9aa3b2]">{hint}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
