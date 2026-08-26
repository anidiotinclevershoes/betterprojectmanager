"use client";

import { useAppearance, type LumeTheme } from "@/lib/appearance";

const OPTIONS: Array<{
  id: LumeTheme;
  label: string;
  lede: string;
}> = [
  {
    id: "ocean",
    label: "Ocean",
    lede: "Cool navy surfaces. The original Lume appearance.",
  },
  {
    id: "desert",
    label: "Desert",
    lede: "Warm espresso and sand surfaces. Same product, different light.",
  },
];

export function LumeThemePicker() {
  const { theme, setTheme, hydrated } = useAppearance();

  return (
    <div className="lume-theme-picker" data-testid="lume-theme-picker">
      <p className="meta">Appearance</p>
      <div className="lume-theme-options" role="radiogroup" aria-label="Lume theme">
        {OPTIONS.map((option) => {
          const active = hydrated ? theme === option.id : option.id === "ocean";
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`lume-theme-option ${active ? "is-active" : ""}`}
              data-testid={`lume-theme-${option.id}`}
              onClick={() => setTheme(option.id)}
            >
              <span className="lume-theme-option-name">{option.label}</span>
              <span className="meta">{option.lede}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
