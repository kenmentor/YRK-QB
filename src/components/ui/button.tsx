import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
        accent: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
        secondary: "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50",
        outline: "border border-slate-200 bg-transparent hover:bg-white hover:border-slate-300",
        ghost: "hover:bg-slate-100",
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
