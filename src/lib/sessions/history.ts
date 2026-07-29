/**
 * Durable Capture and Coaching session history (localStorage).
 * Active workspace sessions remain in their providers; these records
 * survive dismiss / New capture so users can reopen them later.
 */

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
