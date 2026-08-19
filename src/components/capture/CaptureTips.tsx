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
            For the clearest results, use direct language and name the project
            when it could be ambiguous. Everyday notes still work.
          </p>
          <ul className="capture-tips-list">
            <li>“ATLAS: complete the CAB task.”</li>
            <li>“HORIZON: change launch to 24 September.”</li>
            <li>“Resolve the gateway risk.”</li>
            <li>“Create a To Do for ATLAS to call the vendor.”</li>
            <li>“Remember that CAB needs the pack 24h before the board.”</li>
          </ul>
        </div>
      ) : (
        <p className="capture-tips-inline meta">
          Tip: name the project when ambiguous — “ATLAS: complete…”, “Remember
          that…”
        </p>
      )}
    </div>
  );
}
