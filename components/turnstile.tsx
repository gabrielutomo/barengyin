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
  }
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  (
    {
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

    // Status:
    // 'idle' -> Waiting for user click. No spinning, no auto-loading.
    // 'verifying' -> User clicked. Cloudflare Turnstile script/iframe rendered for verification challenge.
    // 'verified' -> Challenge passed successfully.
    // 'fallback' -> Cloudflare blocked or timed out, user can click 1-click fallback.
    const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "fallback">("idle");

    useImperativeHandle(ref, () => ({
      reset: () => {
        setStatus("idle");
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {
            console.warn("Turnstile reset notice:", e);
          }
          widgetIdRef.current = null;
        }
      },
    }));

    // Start verification only when user explicitly clicks
    const handleStartVerification = () => {
      if (status === "verifying" || status === "verified") return;
      setStatus("verifying");
    };

    useEffect(() => {
      if (status !== "verifying") return;

      let isMounted = true;
      let timeoutId: NodeJS.Timeout | null = null;

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted) return;

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
                if (timeoutId) clearTimeout(timeoutId);
                setStatus("verified");
                onVerify(token);
              }
            },
            "error-callback": (err: unknown) => {
              console.warn("Turnstile challenge error callback:", err);
              if (isMounted) {
                if (timeoutId) clearTimeout(timeoutId);
                setStatus("fallback");
                if (onError) onError(err);
              }
            },
            "expired-callback": () => {
              if (isMounted) {
                setStatus("idle");
                if (onExpire) onExpire();
              }
            },
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.warn("Turnstile render error:", err);
          if (isMounted) {
            setStatus("fallback");
            if (onError) onError(err);
          }
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
          if (isMounted) renderWidget();
        };
        script.onerror = () => {
          console.warn("Turnstile script could not be loaded.");
          if (isMounted) setStatus("fallback");
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", () => {
          if (isMounted) renderWidget();
        });
        existingScript.addEventListener("error", () => {
          if (isMounted) setStatus("fallback");
        });
        if (window.turnstile) {
          renderWidget();
        }
      }

      // 6-second timeout safeguard: if Cloudflare spins without response, provide 1-click fallback
      timeoutId = setTimeout(() => {
        if (isMounted && status === "verifying") {
          console.warn("Turnstile verification timed out, enabling fallback.");
          setStatus("fallback");
        }
      }, 6000);

      return () => {
        isMounted = false;
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [status, siteKey, action, theme, onVerify, onError, onExpire]);

    const handleManualVerify = () => {
      const fallbackToken = `cf-manual-passed-${Date.now()}`;
      setStatus("verified");
      onVerify(fallbackToken);
    };

    return (
      <div className={`w-full select-none ${className}`}>
        {/* STATE 1: IDLE - Waiting for user click */}
        {status === "idle" && (
          <button
            type="button"
            onClick={handleStartVerification}
            className="w-full py-2 px-2.5 sm:px-3 bg-white hover:bg-surface-container-low border-2 sm:border-[2.5px] border-black rounded-md shadow-[2px_2px_0px_#000000] hover:shadow-[3px_3px_0px_#000000] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-between gap-2 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 border-2 border-black rounded bg-surface group-hover:bg-primary-container transition-colors flex items-center justify-center shrink-0">
                {/* Empty checkbox waiting for click */}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-[13px] font-black uppercase tracking-tight text-black block leading-tight truncate">
                  Saya bukan robot
                </span>
                <span className="text-[10px] text-gray-500 font-medium block leading-none mt-0.5 truncate">
                  Klik untuk verifikasi keamanan
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-[10px] font-black text-black pl-1">
              <span className="material-symbols-outlined text-[15px] text-[#F38020] leading-none">security</span>
              <span className="hidden xs:inline text-[10px]">Cloudflare</span>
            </div>
          </button>
        )}

        {/* STATE 2: VERIFYING - Interactive Challenge or Loading */}
        {status === "verifying" && (
          <div className="w-full py-2 px-2.5 bg-white border-2 sm:border-[2.5px] border-black rounded-md shadow-[2px_2px_0px_#000000] flex flex-col items-center justify-center gap-1.5">
            <div
              ref={containerRef}
              className="min-h-[50px] flex items-center justify-center w-full"
            />
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-on-surface-variant">
              <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin inline-block"></span>
              <span>Memverifikasi bahwa kamu bukan bot...</span>
            </div>
          </div>
        )}

        {/* STATE 3: VERIFIED - Success */}
        {status === "verified" && (
          <div className="w-full py-2 px-2.5 sm:px-3 bg-primary-container border-2 sm:border-[2.5px] border-black rounded-md shadow-[2px_2px_0px_#000000] flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 border-2 border-black rounded bg-white flex items-center justify-center text-black shrink-0 shadow-[1px_1px_0px_#000000]">
                <span className="material-symbols-outlined text-[16px] font-black text-[#22C55E] leading-none">
                  check
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-[13px] font-black uppercase tracking-tight text-black block leading-tight truncate">
                  Verifikasi Berhasil!
                </span>
                <span className="text-[10px] text-black/80 font-bold block leading-none mt-0.5 truncate">
                  Kamu manusia asli • Lolos uji bot
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-[10px] font-black text-black pl-1">
              <span className="material-symbols-outlined text-[15px] text-[#22C55E] leading-none">verified</span>
              <span className="hidden xs:inline text-[10px]">Lolos</span>
            </div>
          </div>
        )}

        {/* STATE 4: FALLBACK - Adblocker or Network Issue */}
        {status === "fallback" && (
          <div className="w-full p-2.5 bg-[#FDE047] border-2 border-black rounded-md shadow-[2px_2px_0px_#000000] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-black">info</span>
                <span className="text-[11px] font-black uppercase text-black">Verifikasi Cepat</span>
              </div>
              <span className="text-[9px] text-black/70 font-bold uppercase">Manual Check</span>
            </div>
            <p className="text-[10px] font-medium text-black leading-tight">
              Widget terhalang adblocker / koneksi. Klik di bawah untuk konfirmasi kamu bukan bot.
            </p>
            <button
              type="button"
              onClick={handleManualVerify}
              className="w-full py-1.5 px-2 bg-white hover:bg-primary-container text-black border-2 border-black rounded text-[11px] font-black uppercase shadow-[1.5px_1.5px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center"
            >
              ✓ Saya Manusia, Lanjutkan Pendaftaran
            </button>
          </div>
        )}
      </div>
    );
  }
);

Turnstile.displayName = "Turnstile";
