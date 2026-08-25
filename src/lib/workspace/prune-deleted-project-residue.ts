import { clearActiveCaptureIfSeeded, pruneSessionsForProject } from "@/lib/sessions/history";

const TELL_ME_SNAPSHOT_KEY = "lume-tell-me-snapshots-v1";
const ACTIVE_CAPTURE_KEY = "lume-capture-session-v1";

function removeActiveCaptureIfProject(projectId: string) {
  clearActiveCaptureIfSeeded([projectId], ACTIVE_CAPTURE_KEY);
  try {
    const raw = window.localStorage.getItem(ACTIVE_CAPTURE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { projectId?: string | null };
    if (parsed.projectId === projectId) {
      window.localStorage.removeItem(ACTIVE_CAPTURE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Tiny browser cleanup after a confirmed project delete.
 * Does not redesign Capture/Coach/Ask sessions (Phase 3D).
 * Prevents a deleted project's leftover Capture/Ask records from appearing
 * as if they belong to the next selected project.
 */
export function pruneBrowserResidueForDeletedProject(projectId: string) {
  if (typeof window === "undefined") return;
  if (!projectId) return;

  pruneSessionsForProject(projectId);
  removeActiveCaptureIfProject(projectId);

  try {
    const raw = window.localStorage.getItem(TELL_ME_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && projectId in parsed) {
        delete parsed[projectId];
        window.localStorage.setItem(TELL_ME_SNAPSHOT_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    /* ignore quota / parse */
  }

  window.dispatchEvent(
    new CustomEvent("lume:project-deleted", { detail: { projectId } }),
  );
}
