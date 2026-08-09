"use client";

import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { CoachPreview } from "@/components/coach/CoachPreview";

export function CaptureCoachRow({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const { isExpandedSession, collapsed, maximized } = useCaptureSession();
  const showCoachTeaser = (!isExpandedSession || collapsed) && !maximized;

  return (
    <div
      className={`capture-coach-row ${showCoachTeaser ? "" : "is-capture-full"} ${maximized ? "is-capture-maximized" : ""}`}
    >
      <div className="capture-coach-main">
        <CaptureWorkspace defaultProjectId={defaultProjectId} />
      </div>
      {showCoachTeaser ? <CoachPreview /> : null}
    </div>
  );
}
