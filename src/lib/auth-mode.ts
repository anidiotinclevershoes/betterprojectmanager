/**
 * Auth mode selection for Lume Phase 2.
 *
 * Production / Supabase-configured → Supabase Auth
 * Explicit LUME_AUTH=demo → legacy DEMO_USERS cookie gate (dev only)
 * Neither configured → open local (auth not required)
 *
 * Production must never silently fall back to demo auth.
 */
import { parseDemoUsers } from "@/lib/auth-demo";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type LumeAuthMode = "none" | "demo" | "supabase";

export function getAuthMode(): LumeAuthMode {
  const forced = (process.env.LUME_AUTH || "").trim().toLowerCase();

  if (forced === "none" || forced === "off") return "none";
  if (forced === "demo") {
    return parseDemoUsers().length > 0 ? "demo" : "none";
  }
  if (forced === "supabase") {
    return isSupabaseConfigured() ? "supabase" : "none";
  }

  // Auto: prefer Supabase when configured. Demo only when Supabase is absent.
  if (isSupabaseConfigured()) return "supabase";
  if (parseDemoUsers().length > 0) return "demo";
  return "none";
}

export function authIsRequired() {
  if (process.env.AUTH_REQUIRED === "false") return false;
  if (process.env.AUTH_REQUIRED === "true") return true;
  return getAuthMode() !== "none";
}

export function isSupabaseAuth(): boolean {
  return getAuthMode() === "supabase";
}

export function isDemoAuth(): boolean {
  return getAuthMode() === "demo";
}
