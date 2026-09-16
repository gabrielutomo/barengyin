import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "tertiary" | "accent" | "dark" | "outline";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    const variantStyles = {
      primary: "bg-primary-container text-on-surface",
      secondary: "bg-secondary-container text-on-surface",
      tertiary: "bg-tertiary-container text-on-surface",
      accent: "bg-accent-yellow text-black",
      dark: "bg-black text-white",
      outline: "bg-white text-on-surface",
    }[variant];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 font-label-badge text-label-badge uppercase border-[2px] border-black shadow-[2px_2px_0px_#000000] rounded-sm select-none",
          variantStyles,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";
