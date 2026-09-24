import * as React from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  in_review: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  changes_requested: "bg-orange-50 text-orange-800 ring-orange-200",
  merged: "bg-blue-50 text-blue-800 ring-blue-200",
  appliable: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  open: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-slate-100 text-slate-500 ring-slate-200",
  easy: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  medium: "bg-amber-50 text-amber-700 ring-amber-100",
  hard: "bg-rose-50 text-rose-700 ring-rose-100"
};

export function Badge({ status, tone, className, children }: { status?: string; tone?: string; className?: string; children: React.ReactNode }) {
  const key = (tone ?? status ?? "").toLowerCase().replace(/-/g, "_");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset", tones[key] ?? "bg-slate-100 text-slate-600 ring-slate-200", className)}>
      {children ?? status}
    </span>
  );
}
