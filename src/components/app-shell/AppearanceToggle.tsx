"use client";

import { useAppearance } from "@/lib/appearance";

export function AppearanceToggle() {
  const { appearance, toggleAppearance } = useAppearance();
  const isDark = appearance === "dark";

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleAppearance}
      aria-label={isDark ? "Switch to light appearance" : "Switch to dark appearance"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <span aria-hidden>☀</span>
      ) : (
        <span aria-hidden>☾</span>
      )}
    </button>
  );
}
