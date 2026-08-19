/**
 * Public auth surface — re-exports demo helpers + mode detection.
 * Prefer importing getAuthMode / isSupabaseAuth from auth-mode for new code.
 */
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  parseDemoUsers,
  createSessionToken,
  verifySessionToken,
  findDemoUser,
  sessionCookieOptions,
  type DemoUser,
  type SessionPayload,
} from "@/lib/auth-demo";

export {
  authIsRequired,
  getAuthMode,
  isDemoAuth,
  isSupabaseAuth,
  type LumeAuthMode,
} from "@/lib/auth-mode";
