"use client";

export type OceanProjectMode = "capture" | "knowledge" | "advise";

/**
 * Capture / Knowledge Centre / Advise — project modes, not sidebar nav.
 */
export function ProjectModeSelector({
  mode,
  onChange,
}: {
  mode: OceanProjectMode;
  onChange: (mode: OceanProjectMode) => void;
}) {
  return (
    <div
      className="ocean-mode-selector"
      role="tablist"
      aria-label="Project mode"
      data-testid="ocean-mode-selector"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "capture"}
        className={`ocean-mode-tab is-capture ${mode === "capture" ? "is-selected" : ""}`}
        onClick={() => onChange("capture")}
        data-testid="ocean-mode-capture"
      >
        <span className="ocean-ai-glyph" aria-hidden>
          ✦
        </span>
        Capture
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "knowledge"}
        className={`ocean-mode-tab is-knowledge ${mode === "knowledge" ? "is-selected" : ""}`}
        onClick={() => onChange("knowledge")}
        data-testid="ocean-mode-knowledge"
      >
        Knowledge Centre
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        disabled
        className="ocean-mode-tab is-advise is-disabled"
        title="Advise is coming soon"
        data-testid="ocean-mode-advise"
      >
        <span className="ocean-ai-glyph" aria-hidden>
          ✦
        </span>
        Advise
        <span className="ocean-coming-soon">Coming soon</span>
      </button>
    </div>
  );
}
