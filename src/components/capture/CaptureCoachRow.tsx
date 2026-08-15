"use client";

import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { IntelligenceLoopStrip } from "@/components/tell-me/IntelligenceLoopStrip";

/**
 * Capture spans the content width. Tell Me sits as a sibling intelligence path.
 * Coach remains in the top header.
 */
export function CaptureCoachRow({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const { maximized } = useCaptureSession();

  function scrollToKnowledge() {
    const el = document.getElementById("project-knowledge");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Overview: soft message via hash if knowledge not on page
    window.location.hash = "project-knowledge";
  }

  return (
    <div
      className={`capture-coach-row is-capture-full ${maximized ? "is-capture-maximized" : ""}`}
    >
      <div className="capture-coach-main">
        <IntelligenceLoopStrip onScrollToKnowledge={scrollToKnowledge} />
        <CaptureWorkspace defaultProjectId={defaultProjectId} />
      </div>
    </div>
  );
}
