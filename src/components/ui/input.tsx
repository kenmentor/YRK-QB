import * as React from "react";
import { cn } from "@/lib/utils";

const field = "flex min-h-[44px] w-full rounded-xl border border-slate-200 dark:border-[var(--yrk-border-subtle)] bg-white dark:bg-[var(--yrk-surface-elevated)] px-3.5 py-2.5 text-[14px] text-slate-900 dark:text-[var(--yrk-text-primary)] shadow-sm transition placeholder:text-slate-400 dark:placeholder:text-[var(--yrk-text-disabled)] hover:border-slate-300 dark:hover:border-[var(--yrk-border-default)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(field, "h-11", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(field, "min-h-[96px] leading-relaxed", className)} {...props} />
);
Textarea.displayName = "Textarea";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-11 appearance-none pr-8", className)} {...props} />;
}
