"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { useCoachSession } from "@/components/coach/CoachSessionContext";
import { useTellMeSession } from "@/components/tell-me/TellMeSessionContext";
import { useMission } from "@/lib/store";

export type IntelligenceMode = "capture" | "tell-me" | "coach";

/**
 * Horizontal Lume intelligence strip.
 * Hierarchy: Capture+Learn → Tell Me  |  Coach (optional)
 */
export function IntelligenceLoopStrip({
  onScrollToKnowledge,
}: {
  onScrollToKnowledge?: () => void;
}) {
  const pathname = usePathname();
  const { state } = useMission();
  const { open: tellMeOpen, openTellMe, closeTellMe } = useTellMeSession();
  const { drawerOpen: coachOpen, openDrawer, closeDrawer } = useCoachSession();
  const { expandCapture } = useCaptureSession();

  const mode: IntelligenceMode = coachOpen
    ? "coach"
    : tellMeOpen
      ? "tell-me"
      : "capture";

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1];
  const projectId = routeId && routeId !== "new" ? routeId : null;
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;

  function activateCapture() {
    closeTellMe();
    closeDrawer();
    expandCapture();
  }

  function activateTellMe() {
    closeDrawer();
    openTellMe({ projectId });
  }

  function activateCoach() {
    closeTellMe();
    openDrawer();
  }

  function viewMemory(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    closeTellMe();
    closeDrawer();
    onScrollToKnowledge?.();
  }

  function viewMemoryKey(ev: KeyboardEvent) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      closeTellMe();
      closeDrawer();
      onScrollToKnowledge?.();
    }
  }

  return (
    <div
      className={`intelligence-loop is-mode-${mode}`}
      data-intelligence-mode={mode}
      aria-label="Lume intelligence"
    >
      <div className="intelligence-loop-primary">
        <button
          type="button"
          className={`intelligence-mode is-capture ${mode === "capture" ? "is-active" : ""}`}
          onClick={activateCapture}
          aria-pressed={mode === "capture"}
        >
          <span className="intelligence-mode-title">Capture</span>
          <span className="intelligence-mode-copy">
            Tell Lume what happened
          </span>
          <span className="intelligence-learn">
            <span className="intelligence-learn-label">
              Lume learns as you work
            </span>
            <span className="intelligence-learn-sep" aria-hidden>
              ·
            </span>
            <span
              role="link"
              tabIndex={0}
              className="intelligence-learn-link"
              onClick={viewMemory}
              onKeyDown={viewMemoryKey}
            >
              View what Lume remembers
            </span>
          </span>
        </button>

        <span className="intelligence-loop-arrow" aria-hidden>
          →
        </span>

        <button
          type="button"
          className={`intelligence-mode is-tell-me ${mode === "tell-me" ? "is-active" : ""}`}
          onClick={activateTellMe}
          aria-pressed={mode === "tell-me"}
        >
          <span className="intelligence-mode-title">Tell Me</span>
          <span className="intelligence-mode-copy">Ask what Lume knows</span>
          {project ? (
            <span className="intelligence-mode-scope">{project.code}</span>
          ) : null}
        </button>
      </div>

      <div className="intelligence-loop-divider" role="separator" aria-hidden />

      <button
        type="button"
        className={`intelligence-mode is-coach is-optional ${mode === "coach" ? "is-active" : ""}`}
        onClick={activateCoach}
        aria-pressed={mode === "coach"}
      >
        <span className="intelligence-mode-kicker">Optional</span>
        <span className="intelligence-mode-title">Coach</span>
        <span className="intelligence-mode-copy">
          PM guidance when you want it
        </span>
      </button>
    </div>
  );
}
