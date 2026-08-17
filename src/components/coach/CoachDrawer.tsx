"use client";

import { useEffect, useRef } from "react";
import { useCoachSession } from "@/components/coach/CoachSessionContext";
import { useMission } from "@/lib/store";

export function CoachDrawer() {
  const {
    drawerOpen,
    closeDrawer,
    scope,
    setScope,
    projectId,
    busy,
    error,
    title,
    provider,
    lastRunAt,
    markdown,
    runCoach,
  } = useCoachSession();
  const { state } = useMission();
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerReturnFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (drawerOpen) {
      triggerReturnFocus.current = document.activeElement;
      window.setTimeout(() => closeRef.current?.focus(), 50);
    } else if (triggerReturnFocus.current instanceof HTMLElement) {
      triggerReturnFocus.current.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {drawerOpen ? (
        <button
          type="button"
          className="coach-drawer-backdrop"
          aria-label="Close coach"
          onClick={closeDrawer}
        />
      ) : null}
      <aside
        className={`coach-drawer ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
        aria-label="Coach"
        role="dialog"
        aria-modal={drawerOpen}
      >
        <header className="coach-drawer-header">
          <div>
            <p className="eyebrow coach-drawer-kicker">Coach · optional guidance</p>
            <h2>{title || "Ready when you are"}</h2>
            <p className="meta">
              {provider
                ? provider === "openai"
                  ? "OpenAI"
                  : "Local"
                : "Does not run until you ask"}
              {lastRunAt
                ? ` · last run ${new Date(lastRunAt).toISOString().slice(0, 16).replace("T", " ")}`
                : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={closeDrawer}
            aria-label="Close coach"
          >
            ×
          </button>
        </header>

        <div className="coach-drawer-controls">
          <label className="field mb-0">
            <span>Scope</span>
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "overview" | "project")
              }
            >
              <option value="overview">All projects</option>
              <option value="project" disabled={!projectId}>
                {project ? `Current · ${project.code}` : "Current project"}
              </option>
            </select>
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void runCoach()}
          >
            {busy ? "Coaching…" : markdown ? "Run again" : "Run coaching"}
          </button>
          <p className="meta">
            Running coaching closes this drawer and opens results in the
            workspace.
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </aside>
    </>
  );
}
