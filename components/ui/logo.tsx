import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  showBadge?: boolean;
}

export function Logo({ className, size = "md", href = "/", showBadge = size !== "sm" }: LogoProps) {
  const iconSize = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  }[size];

  const iconTextSize = {
    sm: "text-[18px]",
    md: "text-[22px]",
    lg: "text-[26px]",
  }[size];

  const textSize = {
    sm: "text-lg sm:text-xl",
    md: "text-2xl md:text-[26px]",
    lg: "text-3xl",
  }[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2 group select-none max-w-full", className)}>
      {/* Neo-brutalist Wallet Icon Mark */}
      <div
        className={cn(
          "bg-primary-container border-[3px] border-black shadow-[3px_3px_0px_#000000] rounded flex items-center justify-center -rotate-2 group-hover:rotate-0 transition-transform shrink-0",
          iconSize
        )}
      >
        <span
          className={cn(
            "material-symbols-outlined text-black font-black leading-none flex items-center justify-center",
            iconTextSize
          )}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          wallet
        </span>
      </div>

      {/* Brand Text + Badge */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "font-headline-lg tracking-tight text-on-surface font-black uppercase leading-none truncate",
            textSize
          )}
        >
          Barengyin<span className="text-secondary">.</span>
        </span>
        {showBadge && (
          <span className="bg-surface border-2 border-black px-1.5 py-0.5 text-[10px] font-label-badge font-black text-on-surface rounded shadow-[2px_2px_0px_#000000] leading-none shrink-0">
            ID
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
