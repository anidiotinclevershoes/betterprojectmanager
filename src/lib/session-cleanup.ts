/** Project-domain keys that must not survive logout or account-switch. */
export const AUTHENTICATED_BROWSER_STORAGE_KEYS = [
  "mission-control-state-v5",
  "lume-mission-supabase-cache-v1",
  "lume-capture-sessions-v1",
  "lume-coaching-sessions-v1",
  "lume-capture-session-v1",
  "lume-tell-me-snapshots-v1",
  "lume-project-dictionary-v1",
] as const;

const AUTHENTICATED_BROWSER_STORAGE_PREFIXES = [
  "mc-workspace-layout-v3:",
  "mc-workspace-layout-v2:",
] as const;

function removeMatchingKeys(storage: Storage) {
  for (const key of AUTHENTICATED_BROWSER_STORAGE_KEYS) {
    storage.removeItem(key);
  }
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (
      AUTHENTICATED_BROWSER_STORAGE_PREFIXES.some((prefix) =>
        key.startsWith(prefix),
      )
    ) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) storage.removeItem(key);
}

/**
 * Clear authenticated application caches on logout / account-switch
 * (avoid cross-user leakage on a shared browser).
 */
export function clearAuthenticatedBrowserState() {
  if (typeof window === "undefined") return;
  try {
    removeMatchingKeys(window.localStorage);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    removeMatchingKeys(window.sessionStorage);
  } catch {
    /* ignore */
  }
}
