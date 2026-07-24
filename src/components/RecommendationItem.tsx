"use client";

import Link from "next/link";
import type { Recommendation, RecommendationUrgency } from "@/lib/types";

const URGENCY_LABEL: Record<RecommendationUrgency, string> = {
  now: "Do now",
  today: "Today",
  this_week: "This week",
  watch: "Watch",
};

const URGENCY_CLASS: Record<RecommendationUrgency, string> = {
  now: "bg-signal text-paper",
  today: "bg-signal-soft text-signal",
  this_week: "bg-teal-soft text-teal",
  watch: "bg-mist-deep text-ink-soft",
};

export function RecommendationItem({
  recommendation,
  onDone,
  onDismiss,
  compact = false,
}: {
  recommendation: Recommendation;
  onDone: () => void;
  onDismiss: () => void;
  compact?: boolean;
}) {
  return (
    <article
      className={`border-t border-line first:border-t-0 ${compact ? "py-4" : "py-5"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${URGENCY_CLASS[recommendation.urgency]}`}
        >
          {URGENCY_LABEL[recommendation.urgency]}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {recommendation.kind.replaceAll("_", " ")}
        </span>
      </div>
      <h3
        className={`brand-mark mt-2 font-bold tracking-tight text-ink ${compact ? "text-base" : "text-lg"}`}
      >
        {recommendation.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">
        {recommendation.action}
      </p>
      {!compact ? (
        <>
          <p className="coach-voice mt-3 text-[15px] leading-relaxed text-ink-soft">
            {recommendation.why}
          </p>
          <p className="mt-2 text-sm text-teal">
            Leadership impact: {recommendation.leadershipImpact}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft line-clamp-2">
          {recommendation.why}
        </p>
      )}
      {recommendation.suggestedScript && !compact ? (
        <blockquote className="mt-3 border-l-2 border-teal pl-3 text-sm leading-relaxed text-ink-soft">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-teal">
            Suggested opening
          </span>
          {recommendation.suggestedScript}
        </blockquote>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-ink/90"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-3 py-1.5 text-xs text-ink-soft transition hover:bg-mist"
        >
          Not now
        </button>
      </div>
    </article>
  );
}

export function RecommendationLink({
  href,
  recommendation,
}: {
  href: string;
  recommendation: Recommendation;
}) {
  return (
    <Link
      href={href}
      className="block border-t border-line py-3 first:border-t-0 first:pt-0 hover:bg-mist/40 -mx-1 rounded-md px-1"
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${URGENCY_CLASS[recommendation.urgency]}`}
        >
          {URGENCY_LABEL[recommendation.urgency]}
        </span>
        <span className="truncate text-sm font-medium text-ink">
          {recommendation.title}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-xs text-ink-soft">
        {recommendation.why}
      </p>
    </Link>
  );
}
