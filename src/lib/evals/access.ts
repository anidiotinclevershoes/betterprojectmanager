/**
 * Server-side allowlist for the Intelligence Evaluation dashboard.
 * Configure via LUME_EVAL_ALLOWED_EMAILS (comma-separated, case-insensitive).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthMode, isSupabaseAuth } from "@/lib/auth-mode";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-demo";
import { cookies } from "next/headers";

export function parseEvalAllowedEmails(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = (env.LUME_EVAL_ALLOWED_EMAILS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,;\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowedForEvals(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!email) return false;
  const allowed = parseEvalAllowedEmails(env);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export type EvalAccessOk = {
  ok: true;
  email: string;
  userId: string;
};

export type EvalAccessFail = {
  ok: false;
  status: 401 | 403;
  error: string;
};

/**
 * Authenticate + allowlist. Never trust client claims.
 */
export async function requireEvalAccess(): Promise<
  EvalAccessOk | EvalAccessFail
> {
  const mode = getAuthMode();
  let email: string | null = null;
  let userId: string | null = null;

  if (isSupabaseAuth()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        email = user.email;
        userId = user.id;
      }
    } catch {
      /* fall through */
    }
  } else if (mode === "demo") {
    const jar = await cookies();
    const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
    if (session?.email) {
      email = session.email;
      userId = `demo:${session.email}`;
    }
  } else if (mode === "none" && process.env.NODE_ENV !== "production") {
    // Local open mode: still require allowlist to include a synthetic email
    // only if explicitly listed — otherwise deny.
    email = null;
  }

  if (!email || !userId) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  if (!isEmailAllowedForEvals(email)) {
    return {
      ok: false,
      status: 403,
      error: "You are not authorised to access Lume evaluations.",
    };
  }

  return { ok: true, email, userId };
}

export function evalAccessDeniedResponse(fail: EvalAccessFail) {
  return NextResponse.json({ error: fail.error }, { status: fail.status });
}
