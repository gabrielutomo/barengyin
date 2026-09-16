import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full bg-surface-container-lowest border-[3px] border-black rounded p-3 text-body-md font-medium text-on-surface placeholder:text-black/50 transition-all focus:outline-none focus:shadow-[4px_4px_0px_#000000] disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-error focus:border-error focus:shadow-[4px_4px_0px_#ba1a1a]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
