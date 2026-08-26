import React from "react";

const accentColors: Record<string, string> = {
  position: "#8b6cff",
  risks: "#e45b5b",
  todo: "#5b8def",
  people: "#35b97f",
  deps: "#2eb7c9",
  decisions: "#8a93a5",
  dates: "#e4a23b",
  waiting: "#e4a23b",
  meeting: "#9b7bff",
  timeline: "#5a9bb8",
};

/** The approved Ocean knowledge frame. Structure unchanged. */
export function FrameShell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <header
        className="border-b border-[var(--border-subtle)] px-3.5 pb-2 pt-3"
        style={{ borderTop: `2px solid ${accentColors[accent]}` }}
      >
        <h3 className="m-0 text-[0.95rem] font-semibold text-[var(--text-primary)]">{title}</h3>
      </header>
      <div className="lume-scroll flex flex-1 flex-col gap-2 overflow-auto p-3 pb-3.5">
        {children}
      </div>
    </section>
  );
}
