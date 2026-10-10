"use client";

export type OceanProjectMode = "home" | "capture" | "knowledge" | "scan";

const MODES: Array<{
  id: OceanProjectMode;
  label: string;
  narrowLabel?: string;
  testId: string;
  ai?: boolean;
}> = [
  { id: "home", label: "Home", testId: "ocean-mode-home" },
  { id: "capture", label: "Capture", testId: "ocean-mode-capture", ai: true },
  {
    id: "knowledge",
    label: "Knowledge Centre",
    narrowLabel: "Knowledge",
    testId: "ocean-mode-knowledge",
  },
  {
    id: "scan",
    label: "Project Scan",
    narrowLabel: "Scan",
    testId: "ocean-mode-scan",
    ai: true,
  },
];

/**
 * Home / Capture / Knowledge Centre / Project Scan.
 * One tab list inside the existing project workspace.
 * Catch Me Up stays a briefing inside Knowledge Centre, not a fifth mode.
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
      className="ocean-mode-selector lume-home-modes"
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
            aria-label={item.label}
            className={`ocean-mode-tab is-${item.id} ${selected ? "is-selected" : ""}`}
            onClick={() => onChange(item.id)}
            data-testid={item.testId}
          >
            {item.id === "home" ? (
              <svg
                className="lume-home-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden
              >
                <path
                  d="M2 6.2L7 2.2L12 6.2V11.2C12 11.6 11.6 12 11.2 12H2.8C2.4 12 2 11.6 2 11.2V6.2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            {item.ai ? (
              <span className="ocean-ai-glyph" aria-hidden>
                ✦
              </span>
            ) : null}
            <span className="ocean-mode-label">{item.label}</span>
            {item.narrowLabel ? (
              <span className="ocean-mode-narrow-label">{item.narrowLabel}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
