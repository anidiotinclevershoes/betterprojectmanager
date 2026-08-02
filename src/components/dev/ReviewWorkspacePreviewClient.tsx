"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CaptureSummary,
  SuggestedChangesList,
} from "@/components/capture/review";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

function stubSuggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: "project",
    projectId: "golden-proj-website-refresh",
    ...partial,
  };
}

const FIXTURE_MODELS: ReviewChangeViewModel[] = [
  {
    id: "op-cab-1",
    suggestion: stubSuggestion({
      id: "op-cab-1",
      kind: "action",
      op: "complete",
      content: "Obtain CAB approval",
      targetTodoId: "golden-todo-cab",
    }),
    entityKind: "action",
    entityLabel: "To Do",
    recordName: "Obtain CAB approval",
    operation: "complete",
    operationLabel: "Complete",
    readiness: "ready",
    diff: { label: "Status", from: "Open", to: "Complete" },
    evidence: ["CAB approval has now been received."],
    interpretation:
      "Lume matched this statement to the existing CAB approval task and believes it has now been completed.",
    confidence: 95,
  },
  {
    id: "op-release-1",
    suggestion: stubSuggestion({
      id: "op-release-1",
      kind: "milestone",
      op: "update",
      content: "Website refresh go-live",
      date: "2025-08-19",
    }),
    entityKind: "milestone",
    entityLabel: "Milestone",
    recordName: "Website refresh go-live",
    operation: "update",
    operationLabel: "Update",
    readiness: "ready",
    diff: { label: "Release Date", from: "12 Aug", to: "19 Aug" },
    evidence: ["Release has moved to the nineteenth."],
    interpretation:
      "Lume detected a date change for the release milestone and proposes updating it to 19 August.",
    confidence: 92,
  },
  {
    id: "op-cdn-1",
    suggestion: stubSuggestion({
      id: "op-cdn-1",
      kind: "risk",
      op: "complete",
      content: "CDN deployment delayed",
    }),
    entityKind: "risk",
    entityLabel: "Risk",
    recordName: "CDN deployment delayed",
    operation: "complete",
    operationLabel: "Complete",
    readiness: "needs_review",
    needsReviewReason:
      "Lume detected evidence that the blocker has been resolved. A separate issue was also mentioned.",
    diff: { label: "Status", from: "Open", to: "Resolved" },
    evidence: [
      "CDN deployment blocker looks resolved.",
      "There was also mention of a separate hosting issue.",
    ],
    interpretation:
      "Evidence suggests the CDN risk may be resolved, but another issue nearby makes this uncertain.",
    confidence: 64,
  },
];

const OBSERVATIONS = [
  "CAB approval received",
  "Release moved to 19 August",
  "CDN deployment blocker resolved",
  "Sarah remains Business Owner",
  "Marcus supports release notes",
];

function initialAdded(state: string | null): Record<string, boolean> {
  if (state === "approved") {
    return { "op-cab-1": true, "op-release-1": true };
  }
  return {};
}

/** Development-only static preview of the Capture review workspace. */
export function ReviewWorkspacePreviewClient() {
  const search = useSearchParams();
  const previewState = search.get("state");
  const [added, setAdded] = useState<Record<string, boolean>>(() =>
    initialAdded(previewState),
  );
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const pending = useMemo(
    () => FIXTURE_MODELS.filter((m) => !added[m.id] && !dismissed[m.id]),
    [added, dismissed],
  );
  const readyCount = pending.filter((m) => m.readiness === "ready").length;
  const needsReviewCount = pending.filter(
    (m) => m.readiness === "needs_review",
  ).length;
  const reviewedCount = FIXTURE_MODELS.filter(
    (m) => added[m.id] || dismissed[m.id],
  ).length;
  const whyOpenIds = previewState === "why" ? ["op-cdn-1"] : undefined;

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Capture review workspace preview</h1>
        <p className="meta">
          Static Sprint 2.1 layout — no AI calls, no project writes from this
          page. States: default, ?state=why, ?state=approved
        </p>
      </header>

      <section className="capture-workspace capture-compact">
        <div className="capture-workspace-head">
          <div>
            <h2 className="capture-title">Capture anything</h2>
            <p className="capture-support meta">Last analysed just now</p>
          </div>
          <div className="capture-header-actions">
            <button type="button" className="ghost-btn capture-new-btn">
              New capture
            </button>
          </div>
        </div>

        <section className="capture-transcript-panel">
          <h3 className="capture-review-section-title">Capture Transcript</h3>
          <textarea
            className="capture-textarea capture-textarea-idle is-readonly"
            readOnly
            rows={4}
            value={`Okay so CAB approval has now been received. Release has moved to the nineteenth. CDN deployment blocker looks resolved — there was also mention of a separate hosting issue. Sarah is still the Business Owner. Marcus is helping with release notes.`}
          />
        </section>

        <div className="capture-review capture-review-workspace">
          <CaptureSummary
            observations={OBSERVATIONS}
            projectChanges={FIXTURE_MODELS.length}
            readyCount={readyCount}
            needsReviewCount={needsReviewCount}
          />
          <SuggestedChangesList
            models={FIXTURE_MODELS}
            added={added}
            dismissed={dismissed}
            readyCount={readyCount}
            needsReviewCount={needsReviewCount}
            reviewedCount={reviewedCount}
            totalCount={FIXTURE_MODELS.length}
            whyOpenIds={whyOpenIds}
            onApprove={(id) => setAdded((prev) => ({ ...prev, [id]: true }))}
            onDismiss={(id) =>
              setDismissed((prev) => ({ ...prev, [id]: true }))
            }
            onApproveReady={() => {
              setAdded((prev) => {
                const next = { ...prev };
                for (const m of pending) {
                  if (m.readiness === "ready") next[m.id] = true;
                }
                return next;
              });
            }}
          />
        </div>
      </section>
    </main>
  );
}
