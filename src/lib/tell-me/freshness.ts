import {
  computeProjectRevision,
  estimateMeaningfulChangeCount,
} from "@/lib/tell-me/revision";
import type { MissionState } from "@/lib/types";
import type {
  ProjectIntelligenceSnapshot,
  TellMeFreshness,
} from "@/lib/tell-me/types";

export function assessFreshness(args: {
  state: MissionState;
  projectId: string | null;
  snapshot: ProjectIntelligenceSnapshot | null | undefined;
}): TellMeFreshness {
  if (!args.projectId) {
    return {
      currentRevision: "workspace",
      snapshotRevision: args.snapshot?.sourceRevision ?? null,
      snapshotCreatedAt: args.snapshot?.createdAt ?? null,
      isStale: false,
      changeCountHint: 0,
      message: null,
    };
  }

  const currentRevision = computeProjectRevision(args.state, args.projectId);
  const snapshotRevision = args.snapshot?.sourceRevision ?? null;
  const snapshotCreatedAt = args.snapshot?.createdAt ?? null;
  const changeCountHint = estimateMeaningfulChangeCount(
    args.state,
    args.projectId,
    snapshotCreatedAt,
  );
  const isStale = Boolean(
    snapshotRevision && snapshotRevision !== currentRevision,
  );

  let message: string | null = null;
  if (!args.snapshot) {
    message = null;
  } else if (isStale) {
    message =
      changeCountHint > 0
        ? `Project information has changed since Lume last refreshed its understanding (${changeCountHint} meaningful change${changeCountHint === 1 ? "" : "s"}).`
        : "Project information has changed since Lume last refreshed its understanding.";
  } else if (snapshotCreatedAt) {
    message = `Lume’s project understanding was refreshed ${formatRelative(snapshotCreatedAt)}.`;
  }

  return {
    currentRevision,
    snapshotRevision,
    snapshotCreatedAt,
    isStale,
    changeCountHint,
    message,
  };
}

export function questionImpliesLatest(question: string): boolean {
  return /\b(latest|current|now|today|still|most recent|right now|up to date)\b/i.test(
    question,
  );
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "recently";
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
