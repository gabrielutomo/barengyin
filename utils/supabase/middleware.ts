import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = async (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: DO NOT REMOVE. This refreshes the session token and updates cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = [
    "/dashboard",
    "/dompet",
    "/transaksi",
    "/tabungan",
    "/laporan",
    "/pasangan",
    "/anggaran",
    "/profil",
    "/pengaturan",
    "/scan-struk",
  ];

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  // 1. Guard protected routes from unauthenticated access
  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/masuk";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Redirect logged-in users away from /masuk to /dashboard
  if (user && pathname === "/masuk") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
};

