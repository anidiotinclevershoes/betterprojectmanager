"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CaptureSummary,
  SuggestedChangesList,
} from "@/components/capture/review";
import {
  computeReviewCounts,
  pendingReadyModels,
  type ReviewChangeViewModel,
} from "@/lib/capture/review/viewModel";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import type { CaptureResult } from "@/lib/types";

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

function stubResult(partial: Partial<CaptureResult> = {}): CaptureResult {
  return {
    memory: {
      id: "mem-preview",
      type: "conversation",
      title: "Preview",
      content: "",
      tags: [],
      people: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
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
    diff: {
      label: "Status",
      from: "Open",
      to: "Complete",
      layout: "from_to",
    },
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
    diff: {
      label: "Release Date",
      from: "12 Aug",
      to: "19 Aug",
      layout: "from_to",
    },
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
    diff: {
      label: "Status",
      from: "Open",
      to: "Resolved",
      layout: "from_to",
    },
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
  "Marcus is supporting release notes",
];

/** Minimal result so shared counters derive changesDetected from findings. */
const FIXTURE_RESULT: CaptureResult = stubResult({
  findings: [
    {
      id: "f-cab",
      fact: "CAB approval received",
      evidence: "CAB approval has now been received.",
      findingType: "ENTITY_COMPLETED",
      target: {
        entityType: "todo",
        entityId: "golden-todo-cab",
        title: "Obtain CAB approval",
      },
      confidence: 95,
      requiresClarification: false,
      reasoningSummary: "CAB complete",
    },
    {
      id: "f-release",
      fact: "Release moved to 19 August",
      evidence: "Release has moved to the nineteenth.",
      findingType: "ENTITY_UPDATED",
      target: {
        entityType: "milestone",
        entityId: "golden-ms-release",
        title: "Website refresh go-live",
      },
      changes: {
        date: { previous: "2025-08-12", proposed: "2025-08-19" },
      },
      confidence: 92,
      requiresClarification: false,
      reasoningSummary: "Date update",
    },
    {
      id: "f-cdn",
      fact: "CDN deployment blocker resolved",
      evidence: "CDN deployment blocker looks resolved.",
      findingType: "AMBIGUOUS",
      target: {
        entityType: "risk",
        entityId: "golden-risk-cdn",
        title: "CDN deployment delayed",
      },
      confidence: 64,
      requiresClarification: true,
      clarificationQuestion: "Confirm CDN risk resolution.",
      reasoningSummary: "Ambiguous with hosting issue",
    },
  ],
});

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

  const counts = useMemo(
    () =>
      computeReviewCounts({
        result: FIXTURE_RESULT,
        models: FIXTURE_MODELS,
        added,
        dismissed,
      }),
    [added, dismissed],
  );
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
            changesDetected={counts.changesDetected}
            readyCount={counts.ready}
            needsAttentionCount={counts.needsAttention}
          />
          <SuggestedChangesList
            models={FIXTURE_MODELS}
            added={added}
            dismissed={dismissed}
            readyCount={counts.ready}
            needsReviewCount={counts.needsReview}
            unmatchedCount={counts.unmatched}
            reviewedCount={counts.reviewed}
            totalCount={counts.total}
            whyOpenIds={whyOpenIds}
            onApprove={(id) => setAdded((prev) => ({ ...prev, [id]: true }))}
            onDismiss={(id) =>
              setDismissed((prev) => ({ ...prev, [id]: true }))
            }
            onApproveReady={() => {
              setAdded((prev) => {
                const next = { ...prev };
                for (const m of pendingReadyModels(
                  FIXTURE_MODELS,
                  prev,
                  dismissed,
                )) {
                  next[m.id] = true;
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
