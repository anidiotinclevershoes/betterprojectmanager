"use client";

import type { ReactNode } from "react";
import { FOCUS_LENSES, type FocusLens } from "@/lib/focus";

export function FocusLenses({
  value,
  onChange,
}: {
  value: FocusLens;
  onChange: (lens: FocusLens) => void;
}) {
  return (
    <div className="focus-lenses" role="tablist" aria-label="Focus lenses">
      {FOCUS_LENSES.map((lens) => {
        const active = value === lens.id;
        return (
          <button
            key={lens.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`focus-lens ${active ? "is-active" : ""}`}
            onClick={() =>
              onChange(
                active && lens.id !== "everything" ? "everything" : lens.id,
              )
            }
          >
            {lens.label}
          </button>
        );
      })}
    </div>
  );
}

export function FocusSection({
  lens,
  active,
  children,
  className = "",
}: {
  lens: FocusLens | string;
  active: FocusLens;
  children: ReactNode;
  className?: string;
}) {
  const dimmed =
    active !== "everything" &&
    active !== lens &&
    !(
      active === "today" &&
      (lens === "todo" ||
        lens === "meetings" ||
        lens === "risks" ||
        lens === "today")
    );

  return (
    <div
      className={`focus-section ${dimmed ? "is-dimmed" : "is-loud"} ${className}`}
      data-lens={lens}
    >
      {children}
    </div>
  );
}
