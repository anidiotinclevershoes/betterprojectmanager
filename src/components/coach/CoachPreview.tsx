"use client";

import { LumeLogo } from "@/components/brand/LumeLogo";
import { useCoachSession } from "@/components/coach/CoachSessionContext";

export function CoachPreview() {
  const { openDrawer } = useCoachSession();

  return (
    <aside className="coach-preview" aria-label="Lume Coach">
      <div className="coach-preview-brand">
        <LumeLogo size={20} className="lume-logo" />
        <div>
          <p className="coach-preview-title">Lume Coach</p>
          <span className="tag">Beta</span>
        </div>
      </div>
      <h3 className="coach-preview-question">
        What would an exceptional PM do next?
      </h3>
      <p className="coach-preview-copy">
        Review your meetings, tasks, risks, stakeholders and knowledge to
        discover what deserves your attention before anyone else notices.
      </p>
      <button
        type="button"
        className="primary-btn coach-preview-cta"
        onClick={openDrawer}
      >
        Open Coach →
      </button>
    </aside>
  );
}
