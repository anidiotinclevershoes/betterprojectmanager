/**
 * Durable Capture and Coaching session history (localStorage).
 * Active workspace sessions remain in their providers; these records
 * survive dismiss / New capture so users can reopen them later.
 */

import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureResult } from "@/lib/types";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

export type CaptureSessionStatus =
  | "in_review"
  | "completed"
  | "dismissed"
  | "partially_accepted";

export type CaptureSource = "typed" | "recorded" | "uploaded";

export type CaptureSessionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  analysedAt: string;
  projectId?: string | null;
  source: CaptureSource;
  transcript: string;
  result: CaptureResult;
  suggestions: PendingSuggestion[];
  dismissed: Record<string, boolean>;
  added: Record<string, boolean>;
  status: CaptureSessionStatus;
  /** Optional Phase 1 observability; older sessions may omit this. */
  contextManifest?: CaptureContextManifest | null;
  /** Development seed / demo marker for selective reset. */
  isSeeded?: boolean;
};

export type CoachingSessionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  scope: "all_projects" | "project";
  projectId?: string | null;
  title: string;
  markdown: string;
  provider: "openai" | "local" | null;
  recommendationStates: Record<string, "pending" | "accepted" | "dismissed">;
  status: "active" | "dismissed" | "completed";
  /** Development seed / demo marker for selective reset. */
  isSeeded?: boolean;
};

const CAPTURE_HISTORY_KEY = "lume-capture-sessions-v1";
const COACHING_HISTORY_KEY = "lume-coaching-sessions-v1";
const MAX_SESSIONS = 80;

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch {
    /* ignore quota */
  }
}

export function computeCaptureStatus(
  suggestions: PendingSuggestion[],
  added: Record<string, boolean>,
  dismissed: Record<string, boolean>,
): CaptureSessionStatus {
  if (suggestions.length === 0) return "completed";
  const accepted = suggestions.filter((s) => added[s.id]).length;
  const dismissedCount = suggestions.filter((s) => dismissed[s.id]).length;
  const pending = suggestions.length - accepted - dismissedCount;
  if (pending > 0 && (accepted > 0 || dismissedCount > 0)) {
    return "partially_accepted";
  }
  if (pending > 0) return "in_review";
  if (accepted > 0 && dismissedCount > 0) return "partially_accepted";
  if (accepted > 0) return "completed";
  return "dismissed";
}

export function listCaptureSessions(): CaptureSessionRecord[] {
  return readList<CaptureSessionRecord>(CAPTURE_HISTORY_KEY).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getCaptureSession(sessionId: string) {
  return listCaptureSessions().find((s) => s.id === sessionId) ?? null;
}

export function upsertCaptureSession(
  input: Omit<CaptureSessionRecord, "updatedAt"> & { updatedAt?: string },
): CaptureSessionRecord {
  const now = new Date().toISOString();
  const record: CaptureSessionRecord = {
    ...input,
    updatedAt: input.updatedAt ?? now,
  };
  const list = listCaptureSessions().filter((s) => s.id !== record.id);
  writeList(CAPTURE_HISTORY_KEY, [record, ...list]);
  return record;
}

export function createCaptureSessionId() {
  return id("cap");
}

export function listCoachingSessions(): CoachingSessionRecord[] {
  return readList<CoachingSessionRecord>(COACHING_HISTORY_KEY).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getCoachingSession(sessionId: string) {
  return listCoachingSessions().find((s) => s.id === sessionId) ?? null;
}

export function upsertCoachingSession(
  input: Omit<CoachingSessionRecord, "updatedAt"> & { updatedAt?: string },
): CoachingSessionRecord {
  const now = new Date().toISOString();
  const record: CoachingSessionRecord = {
    ...input,
    updatedAt: input.updatedAt ?? now,
  };
  const list = listCoachingSessions().filter((s) => s.id !== record.id);
  writeList(COACHING_HISTORY_KEY, [record, ...list]);
  return record;
}

export function createCoachingSessionId() {
  return id("coach");
}

/**
 * Remove durable Capture/Coach sessions that belong to seeded demo projects
 * or are explicitly marked `isSeeded`. User sessions for other projects stay.
 */
export function pruneSeededSessions(options: {
  seedProjectIds: readonly string[];
  seedCaptureSessionIds?: readonly string[];
  seedCoachingSessionIds?: readonly string[];
}): { captureRemoved: number; coachingRemoved: number } {
  const projectIds = new Set(options.seedProjectIds);
  const captureSeedIds = new Set(options.seedCaptureSessionIds ?? []);
  const coachingSeedIds = new Set(options.seedCoachingSessionIds ?? []);

  const captures = listCaptureSessions();
  const nextCaptures = captures.filter((s) => {
    const seededFlag = (s as CaptureSessionRecord & { isSeeded?: boolean })
      .isSeeded;
    if (seededFlag) return false;
    if (captureSeedIds.has(s.id)) return false;
    if (s.projectId && projectIds.has(s.projectId)) return false;
    return true;
  });
  writeList(CAPTURE_HISTORY_KEY, nextCaptures);

  const coaching = listCoachingSessions();
  const nextCoaching = coaching.filter((s) => {
    const seededFlag = (s as CoachingSessionRecord & { isSeeded?: boolean })
      .isSeeded;
    if (seededFlag) return false;
    if (coachingSeedIds.has(s.id)) return false;
    if (s.projectId && projectIds.has(s.projectId)) return false;
    return true;
  });
  writeList(COACHING_HISTORY_KEY, nextCoaching);

  return {
    captureRemoved: captures.length - nextCaptures.length,
    coachingRemoved: coaching.length - nextCoaching.length,
  };
}

/** Clear active Capture workspace if it targets a seeded project. */
export function clearActiveCaptureIfSeeded(
  seedProjectIds: readonly string[],
  activeKey = "lume-capture-session-v1",
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(activeKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { projectId?: string | null };
    if (parsed.projectId && seedProjectIds.includes(parsed.projectId)) {
      window.sessionStorage.removeItem(activeKey);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function pruneSessionsForProject(projectId: string): {
  captureRemoved: number;
  coachingRemoved: number;
} {
  if (!projectId) {
    return { captureRemoved: 0, coachingRemoved: 0 };
  }

  const captures = listCaptureSessions();
  const nextCaptures = captures.filter((s) => s.projectId !== projectId);
  writeList(CAPTURE_HISTORY_KEY, nextCaptures);

  const coaching = listCoachingSessions();
  const nextCoaching = coaching.filter((s) => s.projectId !== projectId);
  writeList(COACHING_HISTORY_KEY, nextCoaching);

  return {
    captureRemoved: captures.length - nextCaptures.length,
    coachingRemoved: coaching.length - nextCoaching.length,
  };
}

export function statusLabel(status: CaptureSessionStatus) {
  switch (status) {
    case "in_review":
      return "In review";
    case "completed":
      return "Completed";
    case "dismissed":
      return "Dismissed";
    case "partially_accepted":
      return "Partially accepted";
  }
}
