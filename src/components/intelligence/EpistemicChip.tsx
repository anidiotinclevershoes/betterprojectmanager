"use client";

import type { EpistemicStatus } from "@/lib/canonical-truth/types";

/** Sparse epistemic chips — only material/uncertain states. */
export function EpistemicChip({
  status,
}: {
  status: EpistemicStatus | null | undefined;
}) {
  if (!status || status === "confirmed" || status === "legacy") return null;
  const label =
    status === "unknown"
      ? "Needs confirmation"
      : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`lume-epistemic-chip is-${status}`}>{label}</span>;
}
