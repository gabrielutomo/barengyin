"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";

export interface TurnstileRef {
  reset: () => void;
}

interface TurnstileProps {
  siteKey?: string;
  action?: string;
  onVerify: (token: string) => void;
  onError?: (error?: unknown) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "error-callback"?: (err?: unknown) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  (
    {
      // Default to Cloudflare's canonical test key (Always passes on localhost & any domain)
      siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
      action = "signup",
      onVerify,
      onError,
      onExpire,
      theme = "light",
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isDevBypassed, setIsDevBypassed] = useState(false);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setIsDevBypassed(false);
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.warn("Turnstile reset notice:", e);
          }
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted) return;

        // Clear existing widget if re-rendering
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme,
            callback: (token: string) => {
              if (isMounted) {
                setHasError(false);
                onVerify(token);
              }
            },
            "error-callback": (err: unknown) => {
              console.warn("Turnstile challenge error callback:", err);
              if (isMounted) {
                setHasError(true);
                if (onError) onError(err);
              }
            },
            "expired-callback": () => {
              if (isMounted && onExpire) onExpire();
            },
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.warn("Turnstile render error:", err);
          if (isMounted) setHasError(true);
        }
      };

      const scriptSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      const existingScript = document.querySelector(`script[src*="turnstile"]`) as HTMLScriptElement | null;

      if (window.turnstile) {
        renderWidget();
      } else if (!existingScript) {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          renderWidget();
        };
        script.onerror = () => {
          console.warn("Turnstile script could not be loaded (likely blocked by Adblocker/Firewall).");
          if (isMounted) setHasError(true);
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", () => {
          renderWidget();
        });
        existingScript.addEventListener("error", () => {
          if (isMounted) setHasError(true);
        });
      }

      return () => {
        isMounted = false;
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, action, theme, onVerify, onError, onExpire]);

    const handleDevBypass = () => {
      const devToken = `dev-bypass-${Date.now()}`;
      setIsDevBypassed(true);
      setHasError(false);
      onVerify(devToken);
    };

    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <div
          ref={containerRef}
          className="min-h-[65px] flex items-center justify-center"
        />

        {hasError && !isDevBypassed && (
          <div className="mt-2 p-2.5 bg-[#FDE047] border-2 border-black rounded text-[11px] font-bold text-center space-y-1.5 shadow-[2px_2px_0px_#000]">
            <p className="text-black">
              Widget Turnstile terhalang adblocker atau domain belum di-whitelist di Cloudflare.
            </p>
            <button
              type="button"
              onClick={handleDevBypass}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-black border-2 border-black rounded font-headline-sm uppercase text-[10px] font-black cursor-pointer shadow-[1px_1px_0px_#000]"
            >
              ✓ Verifikasi Manual (Dev/Testing Mode)
            </button>
          </div>
        )}

        {isDevBypassed && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#15803d]">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Verifikasi bot terlewati (Dev Mode)</span>
          </div>
        )}

        <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-[#22C55E]">verified_user</span>
          <span>Dilindungi oleh Cloudflare Turnstile Bot Guard</span>
        </div>
      </div>
    );
  }
);

Turnstile.displayName = "Turnstile";
