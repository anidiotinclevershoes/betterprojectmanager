"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  FIRST_CAPTURE_CUE_KEY,
  FIRST_PROJECT_GUIDANCE_KEY,
  readCueDismissed,
  shouldShowFirstCaptureCue,
  shouldShowFirstProjectGuidance,
  writeCueDismissed,
} from "@/lib/first-run";
import { listCaptureSessions } from "@/lib/sessions/history";
import { useMission } from "@/lib/store";
import "./first-run.css";

function hasAnyCaptureHistory(): boolean {
  return listCaptureSessions().length > 0;
}

export function FirstCaptureCue({
  composeEmpty,
  analysing,
  reviewOpen,
}: {
  composeEmpty: boolean;
  analysing: boolean;
  reviewOpen: boolean;
}) {
  const { state, hydrated } = useMission();
  const [dismissed, setDismissed] = useState(true);
  const [hasHistory, setHasHistory] = useState(true);

  useEffect(() => {
    setDismissed(readCueDismissed(FIRST_CAPTURE_CUE_KEY));
    setHasHistory(hasAnyCaptureHistory());
  }, []);

  if (!hydrated) return null;
  if (
    !shouldShowFirstCaptureCue({
      dismissed,
      hasCaptureHistory: hasHistory,
      composeEmpty,
      analysing,
      reviewOpen,
      projectCount: state.projects.length,
    })
  ) {
    return null;
  }

  return (
    <QuietCue
      testId="first-capture-cue"
      title="Things changed? Tell Lume what happened."
      body="Meeting notes, pasted updates, or a few sentences about dates, owners, risks or actions. Lume proposes changes — nothing updates until you review."
      onDismiss={() => {
        writeCueDismissed(FIRST_CAPTURE_CUE_KEY);
        setDismissed(true);
      }}
    />
  );
}

export function FirstProjectGuidance() {
  const { state, hydrated } = useMission();
  const [dismissed, setDismissed] = useState(true);
  const [hasHistory, setHasHistory] = useState(true);

  useEffect(() => {
    setDismissed(readCueDismissed(FIRST_PROJECT_GUIDANCE_KEY));
    setHasHistory(hasAnyCaptureHistory());
  }, []);

  if (!hydrated) return null;
  if (
    !shouldShowFirstProjectGuidance({
      dismissed,
      projectCount: state.projects.length,
      hasCaptureHistory: hasHistory,
    })
  ) {
    return null;
  }

  return (
    <QuietCue
      testId="first-project-guidance"
      title="This is your Knowledge Centre."
      body="Capture is how you tell Lume what changed. Open Capture, share an update, then check what Lume understood before anything here changes."
      onDismiss={() => {
        writeCueDismissed(FIRST_PROJECT_GUIDANCE_KEY);
        setDismissed(true);
      }}
    />
  );
}

function QuietCue({
  testId,
  title,
  body,
  onDismiss,
}: {
  testId: string;
  title: string;
  body: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <aside className="first-run-cue" data-testid={testId} role="note">
      <div className="first-run-cue-copy">
        <p className="first-run-cue-title">{title}</p>
        <p className="first-run-cue-body">{body}</p>
      </div>
      <button
        type="button"
        className="first-run-cue-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        Got it
      </button>
    </aside>
  );
}
