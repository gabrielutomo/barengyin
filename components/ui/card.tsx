import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, level = 1, children, ...props }, ref) => {
    const levelStyles = {
      1: "border-[3px] border-black shadow-[4px_4px_0px_#000000]",
      2: "border-[4px] border-black shadow-[6px_6px_0px_#000000]",
      3: "border-[4px] border-black shadow-[8px_8px_0px_#000000]",
    }[level];

    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-container-lowest rounded-md p-space-md text-on-surface",
          levelStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
