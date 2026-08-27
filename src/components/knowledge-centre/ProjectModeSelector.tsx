"use client";

export type OceanProjectMode =
  | "capture"
  | "knowledge"
  | "catch-me-up"
  | "advise";

const MODES: Array<{
  id: Exclude<OceanProjectMode, "advise">;
  label: string;
  testId: string;
  ai?: boolean;
}> = [
  { id: "capture", label: "Capture", testId: "ocean-mode-capture", ai: true },
  {
    id: "knowledge",
    label: "Knowledge Centre",
    testId: "ocean-mode-knowledge",
  },
  {
    id: "catch-me-up",
    label: "Catch Me Up",
    testId: "ocean-mode-catch-me-up",
    ai: true,
  },
];

/**
 * Capture / Knowledge Centre / Catch Me Up / Advise — project modes, not sidebar nav.
 * Advise stays parked (Coming soon). Coach is not a mode.
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
      {MODES.map((item) => {
        const selected = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`ocean-mode-tab is-${item.id} ${selected ? "is-selected" : ""}`}
            onClick={() => onChange(item.id)}
            data-testid={item.testId}
          >
            {item.ai ? (
              <span className="ocean-ai-glyph" aria-hidden>
                ✦
              </span>
            ) : null}
            {item.label}
          </button>
        );
      })}
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
