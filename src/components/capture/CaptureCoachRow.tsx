"use client";

import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { CoachPreview } from "@/components/coach/CoachPreview";
import { CoachResultsCard } from "@/components/coach/CoachResultsCard";

export function CaptureCoachRow({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const { isExpandedSession, collapsed } = useCaptureSession();
  const showCoachTeaser = !isExpandedSession || collapsed;

  return (
    <div className="space-y-4">
      <div
        className={`capture-coach-row ${showCoachTeaser ? "" : "is-capture-full"}`}
      >
        <div className="capture-coach-main">
          <CaptureWorkspace defaultProjectId={defaultProjectId} />
        </div>
        {showCoachTeaser ? <CoachPreview /> : null}
      </div>
      <CoachResultsCard />
    </div>
  );
}
