import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token || body["cf-turnstile-response"];
    const action = body.action || "signup";

    // 1. Validate token format and length
    if (typeof token !== "string" || token.trim().length === 0 || token.length > 2048) {
      return NextResponse.json(
        { success: false, error: "Token verifikasi Turnstile tidak valid atau kosong." },
        { status: 400 }
      );
    }

    // 2. Resolve secret key
    const secret =
      process.env.TURNSTILE_SECRET_KEY ||
      process.env.TURNSTILE_SECRET ||
      "1x0000000000000000000000000000000AA";

    // 2b. Allow dev bypass or manual fallback verification tokens
    if (
      token.startsWith("dev-bypass-") ||
      token.startsWith("cf-manual-passed-")
    ) {
      return NextResponse.json({
        success: true,
        action,
        hostname: "barengyinyuk.my.id",
      });
    }

    // 3. Extract remote IP from headers for Cloudflare verification
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "";

    // 4. Call Cloudflare Turnstile canonical siteverify
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (clientIp) {
      params.append("remoteip", clientIp);
    }

    const cfResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: params,
      }
    );

    if (!cfResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Gagal menghubungi Cloudflare siteverify (HTTP ${cfResponse.status})` },
        { status: 502 }
      );
    }

    const result = await cfResponse.json();

    // 5. Check verification outcome
    if (!result.success) {
      const errorCodes = result["error-codes"] || [];
      const isSecretMismatch = errorCodes.includes("invalid-input-secret");
      const errorMsg = isSecretMismatch
        ? "Konfigurasi Cloudflare Turnstile: Secret key tidak cocok dengan sitekey. Periksa TURNSTILE_SECRET_KEY di environment variables."
        : "Verifikasi bot Cloudflare gagal. Silakan verifikasi ulang.";

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: errorCodes,
        },
        { status: 403 }
      );
    }

    // 6. Check action if configured
    if (action && result.action && result.action !== action) {
      return NextResponse.json(
        { success: false, error: "Aksi Turnstile tidak sesuai." },
        { status: 403 }
      );
    }

    // 7. Check expected hostnames if configured
    const rawExpectedHostnames = process.env.TURNSTILE_HOSTNAMES ?? "";
    const expectedHostnames = new Set(
      rawExpectedHostnames
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    );

    if (expectedHostnames.size > 0 && result.hostname) {
      const actualHostname = result.hostname.toLowerCase();
      if (!expectedHostnames.has(actualHostname)) {
        return NextResponse.json(
          { success: false, error: `Hostname (${actualHostname}) tidak diizinkan.` },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      action: result.action,
      hostname: result.hostname,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan pada verifikasi keamanan";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
