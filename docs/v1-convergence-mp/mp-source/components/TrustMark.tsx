import React from "react";
import type { Trust } from "../types/knowledge";

/**
 * Epistemic state, expressed as quietly as it can be.
 * `known` renders nothing at all — most of the project is ordinary knowledge
 * and should look like it.
 */
export function TrustMark({ trust, className = "" }: { trust: Trust; className?: string }) {
  if (trust === "known") return null;

  if (trust === "noticed") {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-medium text-[var(--info-text)] ${className}`}
      >
        <span className="text-[0.72rem] leading-none" aria-hidden>
          ✦
        </span>
        Lume noticed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[0.7rem] font-medium text-[var(--warning)] ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" aria-hidden />
      Needs you
    </span>
  );
}

/** A left edge tint that carries trust without adding a badge to every row. */
export function trustEdge(trust: Trust): string {
  if (trust === "noticed") return "rgba(108,140,255,0.55)";
  if (trust === "needs-you") return "rgba(228,162,59,0.7)";
  return "transparent";
}
