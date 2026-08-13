/**
 * Require an authenticated production user for expensive AI routes.
 * Returns user id or a NextResponse error.
 */
import { NextResponse } from "next/server";
import { getAuthMode, isSupabaseAuth } from "@/lib/auth-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth-demo";
import { cookies } from "next/headers";
import { checkRateLimit, getAiRateLimits } from "@/lib/rate-limit";
import { serverLog } from "@/lib/server-log";

export type AiGateOk = {
  ok: true;
  userId: string;
  email?: string;
};

export type AiGateFail = {
  ok: false;
  response: NextResponse;
};

export async function requireAiCaller(
  feature: "capture" | "coach" | "transcribe" | "new-project",
): Promise<AiGateOk | AiGateFail> {
  const mode = getAuthMode();

  // Open local development (no auth configured) — allow for DX.
  if (mode === "none" && process.env.NODE_ENV !== "production") {
    return { ok: true, userId: "local-dev" };
  }

  let userId: string | null = null;
  let email: string | undefined;

  if (isSupabaseAuth()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        email = user.email ?? undefined;
      }
    } catch (err) {
      serverLog.error("ai.auth_lookup_failed", {
        feature,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  } else if (mode === "demo") {
    const jar = await cookies();
    const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
    if (session) {
      userId = `demo:${session.email}`;
      email = session.email;
    }
  }

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in required." },
        { status: 401 },
      ),
    };
  }

  const limits = getAiRateLimits();
  const limit =
    feature === "capture"
      ? limits.capturePerHour
      : feature === "coach"
        ? limits.coachPerHour
        : feature === "transcribe"
          ? limits.transcribePerHour
          : limits.newProjectPerHour;

  const result = checkRateLimit({
    key: `${feature}:${userId}`,
    limit,
    windowMs: limits.windowMs,
  });

  if (!result.allowed) {
    serverLog.warn("ai.rate_limited", { feature, userId });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Too many requests. Please wait and try again.",
          retryAt: new Date(result.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
            ),
          },
        },
      ),
    };
  }

  return { ok: true, userId, email };
}
