"use client";

import type { CaptureLayoutExperiment } from "@/lib/capture/layout-experiment";

export function CaptureLayoutToggle({
  layout,
  onChange,
}: {
  layout: CaptureLayoutExperiment;
  onChange: (next: CaptureLayoutExperiment) => void;
}) {
  return (
    <div
      className="capture-layout-toggle"
      role="radiogroup"
      aria-label="Capture layout"
      data-testid="capture-layout-toggle"
    >
      <button
        type="button"
        role="radio"
        aria-checked={layout === "classic"}
        className={layout === "classic" ? "is-selected" : ""}
        onClick={() => onChange("classic")}
        data-testid="capture-layout-classic"
      >
        Classic
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={layout === "simplified"}
        className={layout === "simplified" ? "is-selected" : ""}
        onClick={() => onChange("simplified")}
        data-testid="capture-layout-simplified"
      >
        Simplified
        <span className="capture-layout-experiment-tag">Experiment</span>
      </button>
    </div>
  );
}
