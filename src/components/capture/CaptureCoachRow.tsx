"use client";

import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { IntelligenceLoopStrip } from "@/components/tell-me/IntelligenceLoopStrip";
import { TellMeWorkspace } from "@/components/tell-me/TellMePanel";
import { useTellMeSession } from "@/components/tell-me/TellMeSessionContext";
import { useCoachSession } from "@/components/coach/CoachSessionContext";

/**
 * Intelligence stage: strip + active workspace (Capture or Tell Me).
 * Coach opens as a separated drawer owned by the Coach control.
 */
export function CaptureCoachRow({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const { maximized } = useCaptureSession();
  const { open: tellMeOpen } = useTellMeSession();
  const { drawerOpen: coachOpen } = useCoachSession();

  const mode = coachOpen ? "coach" : tellMeOpen ? "tell-me" : "capture";

  function scrollToKnowledge() {
    const el = document.getElementById("project-knowledge");
    if (!el) {
      // Graceful: no project Knowledge on this page
      window.dispatchEvent(
        new CustomEvent("lume:toast", {
          detail: {
            message:
              "Open a project to view what Lume remembers in Knowledge.",
          },
        }),
      );
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("knowledge-focus-pulse");
    // restart animation
    void el.offsetWidth;
    el.classList.add("knowledge-focus-pulse");
    window.setTimeout(() => {
      el.classList.remove("knowledge-focus-pulse");
    }, 1600);
  }

  return (
    <div
      className={`capture-coach-row is-capture-full intelligence-stage is-mode-${mode} ${maximized ? "is-capture-maximized" : ""}`}
      data-intelligence-mode={mode}
    >
      <div className="capture-coach-main">
        <IntelligenceLoopStrip onScrollToKnowledge={scrollToKnowledge} />
        <div
          className={`intelligence-workspace is-${mode} ${mode === "capture" ? "is-capture-owned" : ""} ${mode === "tell-me" ? "is-tell-me-owned" : ""}`}
        >
          {tellMeOpen ? (
            <TellMeWorkspace />
          ) : (
            <CaptureWorkspace defaultProjectId={defaultProjectId} />
          )}
        </div>
      </div>
    </div>
  );
}
