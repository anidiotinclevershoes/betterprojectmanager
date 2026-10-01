"use client";

import { MeMark } from "@/components/brand/MeMark";

export type OceanProjectMode = "home" | "capture" | "knowledge" | "scan";

const MODES: Array<{
  id: OceanProjectMode;
  label: string;
  narrowLabel?: string;
  testId: string;
  ai?: boolean;
  homeIcon?: boolean;
}> = [
  { id: "home", label: "Home", testId: "ocean-mode-home", homeIcon: true },
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
 * One tab tree. Desktop follows Page 09 TopProjectNav; the narrow
 * breakpoint only changes presentation. Catch Me Up is not a tab.
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
            aria-label={item.label}
            className={`ocean-mode-tab is-${item.id} ${selected ? "is-selected" : ""}`}
            onClick={() => onChange(item.id)}
            data-testid={item.testId}
          >
            {item.homeIcon ? (
              <img
                className="ocean-mode-home-icon"
                src="/brand/nav-home.svg"
                alt=""
                width={16}
                height={16}
              />
            ) : null}
            {item.ai ? <MeMark size="button" /> : null}
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
