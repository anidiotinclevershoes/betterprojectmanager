"use client";

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
}: {
  recommendation: Recommendation;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${URGENCY_CLASS[recommendation.urgency]} rounded px-2 py-1`}
        >
          {URGENCY_LABEL[recommendation.urgency]}
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {recommendation.kind.replaceAll("_", " ")}
        </span>
      </div>
      <h3 className="brand-mark mt-3 text-2xl font-700 tracking-tight text-ink md:text-[1.7rem]">
        {recommendation.title}
      </h3>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink">
        {recommendation.action}
      </p>
      <p className="coach-voice mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-soft">
        {recommendation.why}
      </p>
      <p className="mt-3 max-w-3xl text-sm text-teal">
        Leadership impact: {recommendation.leadershipImpact}
      </p>
      {recommendation.suggestedScript ? (
        <blockquote className="mt-4 max-w-3xl border-l-2 border-teal pl-4 text-sm leading-relaxed text-ink-soft">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
            Suggested opening
          </span>
          {recommendation.suggestedScript}
        </blockquote>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md bg-ink px-3.5 py-2 text-sm text-paper transition hover:bg-ink/90"
        >
          Done — I led this
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-3.5 py-2 text-sm text-ink-soft transition hover:bg-mist"
        >
          Not now
        </button>
      </div>
    </article>
  );
}
