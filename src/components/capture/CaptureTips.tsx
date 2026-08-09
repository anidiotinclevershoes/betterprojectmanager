"use client";

import { useId, useState } from "react";

export function CaptureTips() {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <div className="capture-tips">
      <button
        type="button"
        className="capture-tips-toggle"
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((v) => !v)}
      >
        How to get the best Capture
      </button>
      {open ? (
        <div id={tipId} className="capture-tips-panel" role="note">
          <p className="capture-tips-lead">
            Tip: clear instructions help Lume. Everyday notes still work —
            be explicit when you want the most precise result.
          </p>
          <ul className="capture-tips-list">
            <li>“Complete…”</li>
            <li>“Change… to…”</li>
            <li>“Remove…”</li>
            <li>“Resolve…”</li>
            <li>“Create a To Do…”</li>
            <li>“Raise a Risk…”</li>
          </ul>
        </div>
      ) : (
        <p className="capture-tips-inline meta">
          Tip: try “Complete…”, “Create a To Do…”, “Raise a Risk…”
        </p>
      )}
    </div>
  );
}
