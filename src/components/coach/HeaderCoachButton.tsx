"use client";

import { useCoachSession } from "@/components/coach/CoachSessionContext";

/** Compact Coach entry for the top header (next to theme toggle). */
export function HeaderCoachButton() {
  const { openDrawer } = useCoachSession();

  return (
    <button
      type="button"
      className="ghost-btn coach-trigger"
      onClick={openDrawer}
      title="Open Lume Coach"
      aria-label="Open Lume Coach"
    >
      Lume Coach
    </button>
  );
}
