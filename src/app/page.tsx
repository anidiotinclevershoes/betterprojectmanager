"use client";

import { CaptureBar } from "@/components/CaptureBar";
import { ProjectWidgetGrid } from "@/components/ProjectWidgetGrid";
import { useMission } from "@/lib/store";

export default function OverviewPage() {
  const { state, hydrated } = useMission();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="brand-mark text-xl font-extrabold tracking-tight md:text-2xl">
            Overview
          </h1>
          <p className="text-xs text-ink-soft md:text-sm">
            Per-project widgets — capture at the top, lead from the board.
          </p>
        </div>
      </div>

      <CaptureBar compact />

      {!hydrated ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        state.projects.map((project) => (
          <ProjectWidgetGrid key={project.id} project={project} />
        ))
      )}
    </div>
  );
}
