/** Clear authenticated application caches on logout (avoid cross-user leakage). */
export function clearAuthenticatedBrowserState() {
  if (typeof window === "undefined") return;
  const keys = [
    "mission-control-state-v5",
    "lume-mission-supabase-cache-v1",
    "lume-hydrated-auth-user-id",
    "lume-capture-sessions-v1",
    "lume-coaching-sessions-v1",
    "lume-capture-session-v1",
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
