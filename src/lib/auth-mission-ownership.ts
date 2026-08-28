/**
 * D-036 — auth-owned MissionState.
 *
 * A workspace hydrated for user X must never remain renderable after the
 * authenticated user becomes Y or signed-out. This helper is the deterministic
 * transition; MissionProvider applies it. Login/logout also full-navigate so
 * providers remount.
 */

export const HYDRATED_AUTH_USER_KEY = "lume-hydrated-auth-user-id";

export type MissionAuthAction = "keep" | "reset" | "reset-and-hydrate";

export function missionAuthTransition(input: {
  event: string;
  sessionUserId: string | null;
  ownerUserId: string | null;
}): MissionAuthAction {
  const { event, sessionUserId, ownerUserId } = input;

  if (event === "SIGNED_OUT") return "reset";

  if (!sessionUserId) {
    return ownerUserId ? "reset" : "keep";
  }

  if (
    event !== "SIGNED_IN" &&
    event !== "INITIAL_SESSION" &&
    event !== "TOKEN_REFRESHED"
  ) {
    return "keep";
  }

  if (ownerUserId && ownerUserId === sessionUserId) {
    return "keep";
  }

  return "reset-and-hydrate";
}

/** True when serialised workspace text contains any foreign marker. */
export function missionStateContainsMarkers(
  state: unknown,
  markers: readonly string[],
): boolean {
  const blob = JSON.stringify(state).toLowerCase();
  return markers.some((marker) => blob.includes(marker.toLowerCase()));
}

export function safeAuthNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/** Full document navigation so MissionProvider cannot survive an identity change. */
export function navigateAuthBoundary(path: string): void {
  window.location.assign(safeAuthNextPath(path));
}

export function readHydratedAuthUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(HYDRATED_AUTH_USER_KEY);
  } catch {
    return null;
  }
}

export function writeHydratedAuthUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!userId) {
      window.sessionStorage.removeItem(HYDRATED_AUTH_USER_KEY);
      return;
    }
    window.sessionStorage.setItem(HYDRATED_AUTH_USER_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function cachePaintAllowedForUser(cachedUserId: string): boolean {
  const owner = readHydratedAuthUserId();
  return Boolean(owner && owner === cachedUserId);
}
