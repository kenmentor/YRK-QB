import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-[#e8ebf0] dark:text-[#16181c] dark:hover:bg-white",
        accent: "bg-brand-600 text-white shadow-sm hover:bg-brand-500",
        secondary: "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-[var(--yrk-border-subtle)] dark:bg-[var(--yrk-surface-elevated)] dark:text-[var(--yrk-text-primary)] dark:hover:bg-white/[0.05]",
        outline: "border border-slate-200 bg-transparent text-slate-700 hover:border-slate-300 hover:bg-white dark:border-[var(--yrk-border-subtle)] dark:text-[var(--yrk-text-secondary)] dark:hover:border-[var(--yrk-border-default)] dark:hover:bg-white/[0.05]",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--yrk-text-secondary)] dark:hover:bg-white/[0.07] dark:hover:text-white",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-500"
      },
      size: { default: "h-11 px-4 py-2 sm:h-10", sm: "h-10 px-3.5 text-[13px] sm:h-8 sm:px-3", lg: "h-12 px-6 text-[15px]", icon: "h-11 w-11 sm:h-9 sm:w-9" }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
