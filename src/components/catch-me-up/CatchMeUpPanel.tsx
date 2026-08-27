"use client";

/**
 * Catch Me Up mode shell.
 *
 * Iron Man owns the mode entry and this mount point.
 * Black Widow owns the briefing API, prompt, and panel body.
 *
 * Replace the interior of `CatchMeUpPanel` (keep export name + `projectId`).
 * Do not add a second Catch Me Up surface in the intelligence strip or sidebar.
 */
export type CatchMeUpPanelProps = {
  projectId: string;
};

export function CatchMeUpPanel({ projectId }: CatchMeUpPanelProps) {
  return (
    <section
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-8"
      data-testid="catch-me-up-panel"
      data-catch-me-up-slot="panel"
      data-project-id={projectId}
    >
      <h2 className="m-0 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
        Catch Me Up
      </h2>
      <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-[var(--text-muted)]">
        A read-only project briefing will appear here. This shell is the
        integration point — it does not call an AI route.
      </p>
    </section>
  );
}
