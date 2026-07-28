"use client";

import type { ReactNode } from "react";
import { FRAME_LABELS } from "@/lib/workspace/layout";

export function WorkspaceFrame({
  type,
  title,
  children,
  action,
}: {
  type: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="workspace-frame">
      <header className="workspace-frame-header">
        <h2>{title ?? FRAME_LABELS[type] ?? type}</h2>
        {action ? <div className="workspace-frame-action">{action}</div> : null}
      </header>
      <div className="workspace-frame-body">{children}</div>
    </section>
  );
}
