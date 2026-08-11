"use client";

import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";

/**
 * Capture spans the full content width. Coach lives in the top header.
 */
export function CaptureCoachRow({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const { maximized } = useCaptureSession();

  return (
    <div
      className={`capture-coach-row is-capture-full ${maximized ? "is-capture-maximized" : ""}`}
    >
      <div className="capture-coach-main">
        <CaptureWorkspace defaultProjectId={defaultProjectId} />
      </div>
    </div>
  );
}
