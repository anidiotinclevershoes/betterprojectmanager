"use client";

import { MeMark } from "@/components/brand/MeMark";

export type OceanProjectMode = "home" | "capture" | "knowledge" | "scan";

const MODES: Array<{
  id: OceanProjectMode;
  label: string;
  testId: string;
  ai?: boolean;
}> = [
  { id: "home", label: "Home", testId: "ocean-mode-home" },
  { id: "capture", label: "Capture", testId: "ocean-mode-capture", ai: true },
  {
    id: "knowledge",
    label: "Knowledge Centre",
    testId: "ocean-mode-knowledge",
  },
  { id: "scan", label: "Project Scan", testId: "ocean-mode-scan", ai: true },
];

/**
 * Home / Capture / Knowledge Centre / Project Scan — four equal workspace tabs.
 * Catch Me Up remains a derived briefing, not a tab. Advise is unmounted.
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
            {item.ai ? <MeMark size="button" /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
