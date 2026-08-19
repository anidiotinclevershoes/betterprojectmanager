"use client";

import { useEffect, useId, useRef } from "react";
import type { FrameSize, WorkspaceFrameConfig } from "@/lib/workspace/layout";
import { FRAME_LABELS } from "@/lib/workspace/layout";

export function WorkspaceCustomiser({
  open,
  onClose,
  frames,
  onToggle,
  onMove,
  onSize,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  frames: WorkspaceFrameConfig[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onSize: (id: string, size: FrameSize) => void;
  onReset: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ordered = [...frames].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-lg rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 id={titleId} className="text-[15px] font-semibold text-[var(--text-primary)]">
            Customise workspace
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            Close
          </button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          <p className="text-[12px] text-[var(--text-muted)]">
            Show, hide, reorder and size frames. Timeline appears in the
            workspace when enabled. Capture and Coach stay available.
          </p>
          {ordered.map((frame, index) => (
            <div
              key={frame.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] px-3 py-2"
            >
              <label className="flex min-w-[140px] flex-1 items-center gap-2 text-[13px] text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={frame.visible}
                  onChange={() => onToggle(frame.id)}
                  className="accent-[var(--accent-primary)]"
                />
                {FRAME_LABELS[frame.type] ?? frame.title ?? frame.type}
              </label>
              <select
                value={frame.size}
                onChange={(e) => onSize(frame.id, e.target.value as FrameSize)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                aria-label={`Size for ${frame.type}`}
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
                <option value="full">Full</option>
              </select>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMove(frame.id, "up")}
                  className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={index === ordered.length - 1}
                  onClick={() => onMove(frame.id, "down")}
                  className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
