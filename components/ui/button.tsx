import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "destructive" | "accent" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const variantStyles = {
      primary:
        "bg-primary-container text-on-surface hover:bg-[#c5e638]",
      secondary:
        "bg-secondary-container text-on-surface hover:bg-[#ff7b5a]",
      outline:
        "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
      destructive:
        "bg-error text-on-error hover:bg-[#a61515]",
      accent:
        "bg-accent-yellow text-black hover:bg-[#fae870]",
      ghost:
        "bg-transparent hover:bg-black/5 shadow-none border-none",
    }[variant];

    const sizeStyles = {
      sm: "px-3 py-1.5 text-body-sm font-semibold",
      md: "px-4 py-2.5 text-body-md font-bold",
      lg: "px-6 py-3.5 text-headline-sm font-bold",
    }[size];

    const baseShadow =
      variant === "ghost"
        ? ""
        : "border-[3px] border-black shadow-hard-1 active:translate-x-1 active:translate-y-1 active:shadow-hard-press hover:-translate-x-px hover:-translate-y-px transition-all";

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded select-none cursor-pointer uppercase tracking-tight",
          baseShadow,
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
