"use client";

import { useState } from "react";
import type { ProvenanceEntry } from "@/lib/canonical-truth/types";

/** On-demand evidence reveal — not always shown. */
export function EvidenceReveal({
  provenance,
}: {
  provenance?: ProvenanceEntry[] | null;
}) {
  const [open, setOpen] = useState(false);
  if (!provenance?.length) return null;
  return (
    <span className="lume-evidence-reveal">
      <button
        type="button"
        className="lume-evidence-btn"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide evidence" : "Why does Lume think this?"}
      </button>
      {open ? (
        <ul className="lume-evidence-list">
          {provenance.map((p, i) => (
            <li key={`${p.type}-${i}`}>
              {p.type}
              {p.at ? ` · ${p.at.slice(0, 10)}` : ""}
              {p.note ? ` — ${p.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}
