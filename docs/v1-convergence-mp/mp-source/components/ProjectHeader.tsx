import React from "react";
import { project, askSuggestions } from "../data/project";

/**
 * Approved Ocean header: intelligence strip, project title, mode navigation,
 * and the Search / Ask Lume area. Structure unchanged.
 */
export function ProjectHeader({ needsYouCount }: { needsYouCount: number }) {
  return (
    <>
      {/* Intelligence strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[rgba(16,22,34,0.9)] px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.82rem] text-[var(--text-secondary)]">
          <span>
            <span className="mr-1 text-[var(--info)]" aria-hidden>
              ✦
            </span>
            I know{" "}
            <strong className="font-semibold text-[var(--text-primary)]">
              {project.knownCount}
            </strong>{" "}
            things
          </span>
          <span>
            I see{" "}
            <strong className="font-semibold text-[var(--text-primary)]">
              {project.riskCount}
            </strong>{" "}
            risks
          </span>
          <span className="text-[var(--warning)]">{needsYouCount} need you</span>
          <span className="text-[var(--text-muted)]">Updated today</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(108,140,255,0.45)] bg-[rgba(108,140,255,0.12)] px-3 py-1.5 text-[0.82rem] font-semibold text-[#d7e0ff] transition-colors duration-150 hover:bg-[rgba(108,140,255,0.2)]"
          >
            <span className="font-bold text-[#6c8cff]" aria-hidden>
              ✦
            </span>
            Refresh
          </button>
          <span className="rounded-full border border-[var(--border-subtle)] bg-white/[0.03] px-2.5 py-1 text-[0.78rem] text-[var(--text-muted)]">
            {project.actionsLeft} actions left
          </span>
        </div>
      </div>

      {/* Project header */}
      <header>
        <h1 className="m-0 text-[1.55rem] font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-[0.88rem] text-[var(--text-muted)]">{project.subtitle}</p>
      </header>

      {/* Mode bar — the full-width working surface. Never narrowed by the inspector. */}
      <div
        className="flex w-full items-stretch gap-1 border-b border-[var(--border-subtle)]"
        role="tablist"
        aria-label="Project mode"
      >
        <button
          type="button"
          role="tab"
          className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-[0.9rem] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
        >
          <span className="font-bold text-[#6c8cff]" aria-hidden>
            ✦
          </span>
          Capture
        </button>
        <button
          type="button"
          role="tab"
          aria-selected
          className="inline-flex items-center gap-1.5 border-b-2 border-[#6c8cff] bg-[rgba(108,140,255,0.1)] px-4 py-2.5 text-[0.9rem] font-medium text-[var(--text-primary)]"
        >
          Knowledge Centre
        </button>
        <button
          type="button"
          role="tab"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-[0.9rem] text-[var(--text-secondary)] opacity-55"
        >
          <span className="font-bold text-[#6c8cff]" aria-hidden>
            ✦
          </span>
          Advise
          <span className="ml-1 rounded-full border border-[var(--border-subtle)] px-1.5 py-px text-[0.68rem] text-[var(--text-muted)]">
            Coming soon
          </span>
        </button>
      </div>

      {/* Search / Ask */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-[1fr_auto_1.15fr] items-center gap-2.5">
          <label className="flex min-h-[2.6rem] items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3">
            <span className="text-[var(--text-muted)]" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search knowledge…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[0.92rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>
          <span className="text-center text-[0.8rem] text-[var(--text-muted)]">or</span>
          <div className="flex min-h-[2.6rem] items-center gap-2 rounded-[10px] border border-[rgba(108,140,255,0.28)] bg-[var(--bg-surface)] px-3">
            <span className="font-bold text-[#6c8cff]" aria-hidden>
              ✦
            </span>
            <input
              type="text"
              placeholder="Ask Lume anything…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[0.92rem] text-[var(--text-primary)] outline-none placeholder:text-[#8b97b5]"
            />
            <button
              type="button"
              className="border-0 bg-transparent p-0.5 text-[1.1rem] text-[#6c8cff]"
              aria-label="Ask Lume"
            >
              →
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {askSuggestions.map((q) => (
            <button
              key={q}
              type="button"
              className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-transparent px-2.5 py-1 text-[0.78rem] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-transparent px-2.5 py-1 text-[0.78rem] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
          >
            View all ›
          </button>
        </div>
      </div>
    </>
  );
}
