/**
 * Require an authenticated caller for expensive AI routes.
 * Enforces auth and (in Supabase mode) workspace entitlement separately.
 * Returns user id or a NextResponse error.
 */
import { NextResponse } from "next/server";
import { getAuthMode, isSupabaseAuth } from "@/lib/auth-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-demo";
import { cookies } from "next/headers";
import { checkRateLimit, getAiRateLimits } from "@/lib/rate-limit";
import { serverLog } from "@/lib/server-log";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import {
  ensureWorkspaceTrial,
  getWorkspaceEntitlement,
} from "@/lib/billing/service";
import type { WorkspaceEntitlement } from "@/lib/billing/types";

export type AiGateOk = {
  ok: true;
  userId: string;
  email?: string;
  displayName?: string;
  entitlement?: WorkspaceEntitlement;
};

export type AiGateFail = {
  ok: false;
  response: NextResponse;
};

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | undefined {
  const meta = user.user_metadata ?? {};
  const raw =
    (typeof meta.display_name === "string" && meta.display_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (user.email ? user.email.split("@")[0] : "") ||
    "";
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/**
 * Signed-in caller without spending an AI rate-limit token.
 * Used for cheap status GETs that must not advertise secrets.
 */
export async function requireSignedIn(
  feature: "capture" | "coach" | "transcribe" | "new-project" | "tell-me" | "status" = "status",
): Promise<AiGateOk | AiGateFail> {
  const mode = getAuthMode();

  // Open local development (no auth configured) — allow for DX.
  if (mode === "none" && process.env.NODE_ENV !== "production") {
    return { ok: true, userId: "local-dev" };
  }

  let userId: string | null = null;
  let email: string | undefined;
  let displayName: string | undefined;

  if (isSupabaseAuth()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        email = user.email ?? undefined;
        displayName = displayNameFromUser(user);
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
      displayName = session.name || session.email.split("@")[0];
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

  return { ok: true, userId, email, displayName };
}

export async function requireAiCaller(
  feature: "capture" | "coach" | "transcribe" | "new-project" | "tell-me",
): Promise<AiGateOk | AiGateFail> {
  const signedIn = await requireSignedIn(feature);
  if (!signedIn.ok) return signedIn;

  const { userId, email, displayName } = signedIn;

  // Entitlement is separate from auth. Enforce only for Supabase-backed product paths.
  let entitlement: WorkspaceEntitlement | undefined;
  if (isSupabaseAuth()) {
    try {
      const supabaseClient = await createServerSupabaseClient();
      const { workspaceId } = await ensurePersonalWorkspace(supabaseClient);
      await ensureWorkspaceTrial(supabaseClient, workspaceId);
      entitlement = await getWorkspaceEntitlement(supabaseClient, workspaceId);
      if (!entitlement.canUseLume) {
        serverLog.warn("ai.entitlement_denied", {
          feature,
          userId,
          status: entitlement.status,
          reason: entitlement.reason,
        });
        return {
          ok: false,
          response: NextResponse.json(
            {
              error:
                "Your Lume trial or subscription is not active. Update billing to continue.",
              code: "entitlement_required",
              status: entitlement.status,
              reason: entitlement.reason,
            },
            { status: 403 },
          ),
        };
      }
    } catch (err) {
      serverLog.error("ai.entitlement_check_failed", {
        feature,
        userId,
        error: err instanceof Error ? err.message : "unknown",
      });
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Could not verify billing entitlement." },
          { status: 503 },
        ),
      };
    }
  }

  const limits = getAiRateLimits();
  const limit =
    feature === "capture"
      ? limits.capturePerHour
      : feature === "coach"
        ? limits.coachPerHour
        : feature === "transcribe"
          ? limits.transcribePerHour
          : feature === "tell-me"
            ? limits.tellMePerHour
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

  return { ok: true, userId, email, displayName, entitlement };
}
