/**
 * Auth mode selection for Lume.
 *
 * Production → Supabase Auth only (never silent demo fallback).
 * Development → Supabase when configured, else demo, else open.
 */
import { parseDemoUsers } from "@/lib/auth-demo";
import { isProductionRuntime } from "@/lib/runtime-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type LumeAuthMode = "none" | "demo" | "supabase";

export function getAuthMode(
  env: NodeJS.ProcessEnv = process.env,
): LumeAuthMode {
  const forced = (env.LUME_AUTH || "").trim().toLowerCase();
  const prod = (env.NODE_ENV || process.env.NODE_ENV) === "production";

  if (prod) {
    if (forced === "demo" || forced === "none" || forced === "off") {
      // Dangerous in production — treat as misconfigured supabase requirement.
      return isSupabaseConfigured(env) ? "supabase" : "none";
    }
    return isSupabaseConfigured(env) ? "supabase" : "none";
  }

  if (forced === "none" || forced === "off") return "none";
  if (forced === "demo") {
    return parseDemoUsers(env.DEMO_USERS).length > 0 ? "demo" : "none";
  }
  if (forced === "supabase") {
    return isSupabaseConfigured(env) ? "supabase" : "none";
  }

  if (isSupabaseConfigured(env)) return "supabase";
  if (parseDemoUsers(env.DEMO_USERS).length > 0) return "demo";
  return "none";
}

export function authIsRequired(env: NodeJS.ProcessEnv = process.env) {
  if (env.AUTH_REQUIRED === "false") {
    // Never allow open production.
    if ((env.NODE_ENV || process.env.NODE_ENV) === "production") return true;
    return false;
  }
  if (env.AUTH_REQUIRED === "true") return true;
  if (isProductionRuntime() || env.NODE_ENV === "production") return true;
  return getAuthMode(env) !== "none";
}

/**
 * Auth is required but no identity backend is configured.
 * Production missing Supabase keys must never be treated as an open app.
 */
export function authBackendUnavailable(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return authIsRequired(env) && getAuthMode(env) === "none";
}

export function isSupabaseAuth(env?: NodeJS.ProcessEnv): boolean {
  return getAuthMode(env) === "supabase";
}

export function isDemoAuth(env?: NodeJS.ProcessEnv): boolean {
  return getAuthMode(env) === "demo";
}
