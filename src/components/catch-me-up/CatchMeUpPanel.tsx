"use client";

import { CatchMeUpSurface } from "./CatchMeUpSurface";

/**
 * Catch Me Up mode shell.
 *
 * Iron Man owns the mode entry and this mount point.
 * Black Widow owns the briefing API, prompt, and panel body.
 *
 * One implementation: this panel mounts CatchMeUpSurface with projectId only.
 * Do not add a second Catch Me Up surface in the intelligence strip or sidebar.
 */
export type CatchMeUpPanelProps = {
  projectId: string;
};

export function CatchMeUpPanel({ projectId }: CatchMeUpPanelProps) {
  return (
    <section
      className="min-w-0"
      data-testid="catch-me-up-panel"
      data-catch-me-up-slot="panel"
      data-project-id={projectId}
    >
      <CatchMeUpSurface projectId={projectId} />
    </section>
  );
}
