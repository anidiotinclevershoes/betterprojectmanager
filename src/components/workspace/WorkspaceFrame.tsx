"use client";

import type { ReactNode } from "react";
import { FRAME_LABELS } from "@/lib/workspace/layout";

const FRAME_ICON: Record<string, string> = {
  todo: "✓",
  meetingPrep: "◎",
  risks: "⚠",
  nudge: "↗",
  timeline: "▭",
  knowledge: "◇",
};

export function WorkspaceFrame({
  type,
  title,
  children,
  action,
  expanded,
}: {
  type: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  expanded?: boolean;
}) {
  const icon = FRAME_ICON[type] ?? "•";
  return (
    <section
      className={`workspace-frame frame-identity frame-type-${type} ${expanded ? "is-expanded" : ""}`}
    >
      <header className="workspace-frame-header">
        <h2>
          <span className="frame-identity-icon" aria-hidden>
            {icon}
          </span>
          {title ?? FRAME_LABELS[type] ?? type}
        </h2>
        {action ? <div className="workspace-frame-action">{action}</div> : null}
      </header>
      <div className="workspace-frame-body">{children}</div>
    </section>
  );
}
