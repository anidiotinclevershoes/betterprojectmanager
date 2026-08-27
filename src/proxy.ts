import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  authBackendUnavailable,
  authIsRequired,
  getAuthMode,
  verifySessionToken,
} from "@/lib/auth";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/favicon.ico",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  // Stripe webhooks authenticate via signature, not user session.
  if (pathname === "/api/billing/webhook") return true;
  return false;
}

function isAuthPage(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = getAuthMode();

  // --- Supabase Auth ---
  if (mode === "supabase") {
    const { response, user } = await updateSupabaseSession(request);

    if (!authIsRequired()) {
      return response;
    }

    if (user) {
      if (isAuthPage(pathname)) {
        const redirect = NextResponse.redirect(new URL("/", request.url));
        response.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value);
        });
        return redirect;
      }
      return response;
    }

    if (isPublicPath(pathname)) {
      return response;
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Demo auth, or fail-closed when no identity backend ---
  if (isPublicPath(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (!authIsRequired()) {
    return NextResponse.next();
  }

  // Missing identity backend (typical: production without Supabase keys).
  // Never treat this as an open app — login pages stay public, everything else fails closed.
  if (authBackendUnavailable() || mode === "none") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Service unavailable." },
        { status: 503 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    if (isAuthPage(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
