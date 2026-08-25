"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { CaptureAutoTextarea } from "@/components/capture/CaptureAutoTextarea";
import { CaptureBestPractice } from "@/components/capture/CaptureBestPractice";
import { CaptureContextInspector } from "@/components/capture/CaptureContextInspector";
import { CaptureLayoutToggle } from "@/components/capture/CaptureLayoutToggle";
import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { CaptureSimplifiedWorkspace } from "@/components/capture/simplified/CaptureSimplifiedWorkspace";
import { useCaptureLayoutExperiment } from "@/components/capture/useCaptureLayoutExperiment";
import { useRecordingBridge } from "@/components/capture/useRecordingBridge";
import type { CaptureLayoutExperiment } from "@/lib/capture/layout-experiment";
import { useMission } from "@/lib/store";
import { analysesRemaining } from "@/lib/workspace/history";
import { shouldWarnBeforeAnalysis } from "@/lib/capture/reliability";
import {
  buildCaptureObservations,
  type CaptureObservation,
} from "@/lib/capture/review/observations";
import {
  buildReviewChangeViewModels,
  computeReviewCounts,
  pendingReadyModels,
} from "@/lib/capture/review/viewModel";
import {
  CaptureSummary,
  SuggestedChangesList,
} from "@/components/capture/review";
import type { TargetOption } from "@/components/capture/review/TargetPicker";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { KIND_LABEL } from "@/lib/capture/suggestions";

type CaptureBlock = {
  id: string;
  text: string;
  source: "typed" | "recorded";
};

function makeBlock(
  source: CaptureBlock["source"],
  text = "",
): CaptureBlock {
  return {
    id: `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    source,
  };
}

function joinBlocks(blocks: CaptureBlock[]) {
  return blocks
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatAnalysedAt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function CaptureWorkspace({
  defaultProjectId,
  variant = "legacy",
}: {
  defaultProjectId?: string;
  /** Ocean project-mode embed — presentation only; lifecycle unchanged. */
  variant?: "legacy" | "ocean";
}) {
  const experiment = useCaptureLayoutExperiment();
  if (experiment.layout === "simplified") {
    return (
      <CaptureSimplifiedWorkspace
        defaultProjectId={defaultProjectId}
        variant={variant}
        layout={experiment.layout}
        onLayoutChange={experiment.setLayout}
      />
    );
  }
  return (
    <CaptureClassicWorkspace
      defaultProjectId={defaultProjectId}
      variant={variant}
      layout={experiment.layout}
      onLayoutChange={experiment.setLayout}
    />
  );
}

function CaptureClassicWorkspace({
  defaultProjectId,
  variant = "legacy",
  layout,
  onLayoutChange,
}: {
  defaultProjectId?: string;
  variant?: "legacy" | "ocean";
  layout: CaptureLayoutExperiment;
  onLayoutChange: (next: CaptureLayoutExperiment) => void;
}) {
  const { state, openaiConfigured } = useMission();
  const usage = analysesRemaining(state);
  const session = useCaptureSession();
  const {
    content,
    setContent,
    projectId,
    setProjectId,
    fileNames,
    result,
    suggestions,
    dismissed,
    added,
    collapsed,
    busy,
    setBusy,
    error,
    setError,
    statusMessage,
    announce,
    analyse: runAnalyse,
    cancelAnalyse,
    applyOne,
    dismissOne,
    clearSession,
    expandAnalysis,
    editCapture,
    dismissPreReliabilityWarn,
    isAnalysed,
    setSource,
    analysedAt,
    contextManifest,
    reliability,
    preWarnDismissed,
    reviewOverrides,
    setReviewOverride,
    updateSuggestion,
    maximized,
    minimiseCapture,
    restoreCapture,
  } = session;

  const effectiveProjectId = projectId || defaultProjectId || "";
  // Soft context hint only — Capture remains project-agnostic.
  const softHintProjectId = defaultProjectId || undefined;

  const [blocks, setBlocks] = useState<CaptureBlock[]>(() => [
    makeBlock("typed", content),
  ]);
  const recordingIdRef = useRef<string | null>(null);
  const pushingContentRef = useRef(false);

  // Keep analyse payload in sync with visible blocks.
  useEffect(() => {
    const joined = joinBlocks(blocks);
    if (joined === content) return;
    pushingContentRef.current = true;
    setContent(joined);
  }, [blocks, content, setContent]);

  // Adopt external content changes (session hydrate / New Capture) without
  // collapsing multi-block structure when we were the ones who pushed.
  useEffect(() => {
    if (pushingContentRef.current) {
      pushingContentRef.current = false;
      return;
    }
    if (!content.trim()) {
      setBlocks((prev) =>
        prev.some((b) => b.text.trim()) ? [makeBlock("typed")] : prev,
      );
      recordingIdRef.current = null;
      return;
    }
    setBlocks((prev) =>
      joinBlocks(prev).trim() ? prev : [makeBlock("typed", content)],
    );
  }, [content]);

  function updateBlockText(id: string, text: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function deleteBlock(id: string) {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (!next.length) return [makeBlock("typed")];
      if (next[next.length - 1]?.source !== "typed") {
        return [...next, makeBlock("typed")];
      }
      return next;
    });
    if (recordingIdRef.current === id) recordingIdRef.current = null;
  }

  function prepareRecordingBlock() {
    const rec = makeBlock("recorded", "");
    recordingIdRef.current = rec.id;
    setBlocks((prev) => {
      const trimmed = [...prev];
      while (
        trimmed.length &&
        trimmed[trimmed.length - 1]!.source === "typed" &&
        !trimmed[trimmed.length - 1]!.text.trim()
      ) {
        trimmed.pop();
      }
      return [...trimmed, rec];
    });
    return rec.id;
  }

  function setRecordingText(text: string) {
    const id = recordingIdRef.current;
    if (!id) return;
    updateBlockText(id, text);
  }

  function finalizeRecordingBlock() {
    const id = recordingIdRef.current;
    recordingIdRef.current = null;
    setBlocks((prev) => {
      let next = [...prev];
      const idx = id ? next.findIndex((b) => b.id === id) : -1;
      if (idx >= 0 && !next[idx]!.text.trim()) {
        next = next.filter((b) => b.id !== id);
      }
      if (!next.length || next[next.length - 1]!.source !== "typed") {
        next = [...next, makeBlock("typed")];
      }
      return next;
    });
  }

  const recording = useRecordingBridge({
    setRecordingText,
    prepareRecordingBlock,
    finalizeRecordingBlock,
    setBusy,
    setError,
    announce,
    locked: isAnalysed,
    onRecorded: () => setSource("recorded"),
  });

  const liveRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (defaultProjectId && !projectId) setProjectId(defaultProjectId);
  }, [defaultProjectId, projectId, setProjectId]);

  useEffect(() => {
    if (liveRef.current && statusMessage) {
      liveRef.current.textContent = statusMessage;
    }
  }, [statusMessage]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isAnalysed) {
      if (collapsed) expandAnalysis();
      return;
    }
    // Soft hint only — Capture may address any project named in the text.
    await runAnalyse(content, "conversation", softHintProjectId);
  }

  const preReliability = useMemo(
    () => (!isAnalysed ? shouldWarnBeforeAnalysis(content) : null),
    [content, isAnalysed],
  );
  const showPreWarn =
    !isAnalysed &&
    !preWarnDismissed &&
    preReliability &&
    preReliability.state !== "normal";

  const reviewOpen = Boolean(result) && !collapsed;
  const isDev = process.env.NODE_ENV === "development";
  const showSessionActions = Boolean(result);

  const reviewModels = useMemo(
    () =>
      result
        ? buildReviewChangeViewModels(
            suggestions,
            result,
            content,
            reviewOverrides,
          )
        : [],
    [result, suggestions, content, reviewOverrides],
  );

  const reviewCardIdsByFinding = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of reviewModels) {
      if (m.finding?.id) map[m.finding.id] = m.id;
    }
    return map;
  }, [reviewModels]);

  const observations = useMemo(
    () =>
      result
        ? buildCaptureObservations(result, content, reviewCardIdsByFinding)
        : [],
    [result, content, reviewCardIdsByFinding],
  );
  const counts = useMemo(
    () =>
      computeReviewCounts({
        result,
        models: reviewModels,
        added,
        dismissed,
      }),
    [result, reviewModels, added, dismissed],
  );

  const targetOptions = useMemo((): TargetOption[] => {
    const pid = defaultProjectId || effectiveProjectId;
    if (!pid) return [];
    const options: TargetOption[] = [];
    for (const t of state.todos ?? []) {
      if (t.projectId !== pid || t.done) continue;
      options.push({
        id: t.id,
        title: t.title,
        entityLabel: KIND_LABEL.action,
        status: "Open",
      });
    }
    for (const m of state.meetings ?? []) {
      if (m.projectId !== pid) continue;
      options.push({
        id: m.id,
        title: m.title,
        entityLabel: KIND_LABEL.meeting,
      });
    }
    const knowledge = state.knowledge?.find((k) => k.projectId === pid);
    for (const [index, risk] of (knowledge?.sections.risks ?? []).entries()) {
      options.push({
        id: `know-risk-${pid}-${index}`,
        title: risk,
        entityLabel: KIND_LABEL.risk,
      });
    }
    for (const release of state.releases ?? []) {
      if (release.projectId !== pid) continue;
      for (const [index, risk] of release.risks.entries()) {
        options.push({
          id: `${release.id}-risk-${index}`,
          title: risk,
          entityLabel: KIND_LABEL.risk,
        });
      }
    }
    return options;
  }, [
    defaultProjectId,
    effectiveProjectId,
    state.todos,
    state.meetings,
    state.knowledge,
    state.releases,
  ]);

  function approveById(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    if (model.readiness === "unmatched") {
      dismissOne(id);
      return;
    }
    applyOne(model.suggestion, defaultProjectId);
  }

  function approveReady() {
    for (const model of pendingReadyModels(reviewModels, added, dismissed)) {
      applyOne(model.suggestion, defaultProjectId);
    }
  }

  function onUseThis(id: string) {
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
    });
  }

  function onChooseTarget(id: string, option: TargetOption) {
    const kind: SuggestionKind =
      option.entityLabel === KIND_LABEL.risk
        ? "risk"
        : option.entityLabel === KIND_LABEL.nudge
          ? "nudge"
          : option.entityLabel === KIND_LABEL.meeting
            ? "meeting"
            : "action";
    updateSuggestion(id, {
      content: option.title,
      targetTodoId: option.id,
      kind,
      op: "update",
    });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      content: option.title,
      targetTodoId: option.id,
      kind,
      op: "update",
      recordName: option.title,
    });
  }

  function onCreateNew(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    updateSuggestion(id, { op: "create", targetTodoId: undefined });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      op: "create",
      content: model.suggestion.content,
      recordName: model.recordName,
    });
  }

  function onResolve(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    updateSuggestion(id, { op: "complete" });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      op: "complete",
    });
    applyOne({ ...model.suggestion, op: "complete" }, defaultProjectId);
  }

  function onChooseProject(
    id: string,
    project: { id: string; name: string; code?: string },
  ) {
    updateSuggestion(id, {
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code ?? null,
      projectUncertain: false,
    });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      projectId: project.id,
      projectName: project.name,
    });
  }

  function onChangeEntityKind(id: string, kind: SuggestionKind) {
    updateSuggestion(id, { kind });
    setReviewOverride(id, {
      kind,
      accepted: true,
      readiness: "ready",
      reviewReason: null,
    });
  }

  function onSelectObservation(obs: CaptureObservation) {
    if (!obs.reviewCardId) return;
    const el = document.getElementById(`review-card-${obs.reviewCardId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedCardId(obs.reviewCardId);
    window.setTimeout(() => setHighlightedCardId(null), 1400);
  }

  const analysedLabel = formatAnalysedAt(analysedAt);
  const isOcean = variant === "ocean";
  const panelClass = [
    "capture-workspace",
    "capture-compact",
    isOcean ? "ocean-capture-workspace" : "",
    maximized ? "is-maximized" : "",
    collapsed ? "is-minimised" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={panelClass}
      aria-labelledby={titleId}
      data-testid={isOcean ? "ocean-capture-workspace" : "capture-workspace"}
      data-capture-variant={variant}
      data-capture-layout="classic"
      data-capture-stage={
        reviewOpen ? "review" : busy === "analysing" ? "analysing" : "input"
      }
    >
      <div className="capture-workspace-head">
        <div className="capture-head-copy">
          <h2 id={titleId} className="capture-title">
            {isOcean ? (
              <>
                <span className="ocean-ai-glyph" aria-hidden>
                  ✦
                </span>{" "}
                Capture
              </>
            ) : (
              "Capture anything"
            )}
          </h2>
          <CaptureLayoutToggle layout={layout} onChange={onLayoutChange} />
          {!showSessionActions ? (
            <p className="capture-support">
              {isOcean
                ? "Type an update or record your thoughts. Lume proposes changes — nothing is saved until you review and approve."
                : "Type an update or record your thoughts — Lume will organise what you share."}
            </p>
          ) : analysedLabel ? (
            <p className="capture-support meta">Last analysed {analysedLabel}</p>
          ) : null}
        </div>
        <div className="capture-header-actions">
          {showSessionActions ? (
            <CaptureContextInspector manifest={contextManifest} />
          ) : null}
          <button
            type="button"
            className={isOcean ? "ghost-btn capture-new-btn" : "capture-new-btn"}
            onClick={clearSession}
            title="New Capture"
            aria-label="New Capture"
          >
            New Capture
          </button>
          <div
            className="capture-window-controls"
            role="group"
            aria-label="Capture panel"
          >
            <button
              type="button"
              className="capture-window-btn"
              onClick={() => {
                if (collapsed) restoreCapture();
                else minimiseCapture();
              }}
              aria-label={collapsed ? "Restore Capture" : "Minimise Capture"}
              title={collapsed ? "Restore Capture" : "Minimise Capture"}
              data-testid="ocean-capture-minimise"
            >
              {collapsed ? "Expand" : "Minimise"}
            </button>
          </div>
        </div>
      </div>

      {collapsed ? (
        <p className="capture-minimise-restore">
          Capture minimised — click □ to restore your notes.
        </p>
      ) : null}

      {/* Transcript stays visible after analysis (read-only), including when collapsed. */}
      <section
        className="capture-transcript-panel"
        aria-labelledby={isAnalysed ? "capture-transcript-title" : undefined}
      >
        {isAnalysed ? (
          <h3 id="capture-transcript-title" className="capture-review-section-title">
            Capture Transcript
          </h3>
        ) : null}
        <form onSubmit={onSubmit} className="capture-form">
          <label className="sr-only" htmlFor="capture-input">
            Capture notes
          </label>
          <div className={!isAnalysed ? "capture-compose-row" : undefined}>
            <div className="capture-blocks" aria-label="Capture notes">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`capture-block is-${block.source}`}
                >
                  {index > 0 ? (
                    <div className="capture-block-break" role="separator">
                      <span className="capture-block-break-rule" aria-hidden />
                      <span className="capture-block-break-label">
                        {block.source === "recorded"
                          ? "Recording"
                          : "Continued"}
                      </span>
                      {!isAnalysed ? (
                        <button
                          type="button"
                          className="ghost-btn capture-block-delete"
                          onClick={() => deleteBlock(block.id)}
                          aria-label="Delete this section"
                          title="Delete this section"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ) : blocks.length > 1 && !isAnalysed ? (
                    <div className="capture-block-break is-leading">
                      <button
                        type="button"
                        className="ghost-btn capture-block-delete"
                        onClick={() => deleteBlock(block.id)}
                        aria-label="Delete this section"
                        title="Delete this section"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                  <CaptureAutoTextarea
                    id={index === blocks.length - 1 ? "capture-input" : undefined}
                    value={block.text}
                    readOnly={isAnalysed}
                    disabled={busy === "analysing"}
                    placeholder={
                      index === 0
                        ? "What happened? Type notes or press Record…"
                        : block.source === "recorded"
                          ? "Recording transcript…"
                          : "Continue typing…"
                    }
                    onChange={(text) => {
                      if (!isAnalysed) updateBlockText(block.id, text);
                    }}
                    testId={
                      index === blocks.length - 1
                        ? "ocean-capture-input"
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            {!isAnalysed ? <CaptureBestPractice /> : null}
          </div>

          <div className="capture-toolbar">
            <div className="capture-toolbar-left">
              {!defaultProjectId && !isAnalysed ? (
                <select
                  value={effectiveProjectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={busy !== "idle" || recording.active}
                  aria-label="Project"
                >
                  <option value="">All / unlinked</option>
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </select>
              ) : null}

              {!isAnalysed ? (
                <>
                  {!recording.active ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void recording.start()}
                      disabled={busy === "analysing" || busy === "transcribing"}
                      data-testid="ocean-capture-record"
                    >
                      Record
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={recording.stop}
                    >
                      Stop · {recording.seconds}s
                    </button>
                  )}
                </>
              ) : null}

              {recording.active || busy !== "idle" ? (
                <span className="capture-status" role="status">
                  {recording.active ? (
                    <>
                      <span className="live-dot" aria-hidden />
                      {recording.hint ?? `Recording… ${recording.seconds}s`}
                    </>
                  ) : busy === "transcribing" ? (
                    "Transcribing…"
                  ) : (
                    "Analysing your update…"
                  )}
                </span>
              ) : null}
            </div>

            <div className="capture-toolbar-right">
              {!isAnalysed ? (
                <span className="usage-meter" title="Analyses this month">
                  <span className="usage-label">
                    {usage.remaining} analyses remaining
                  </span>
                  <span className="usage-bar" aria-hidden>
                    <span
                      style={{
                        width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
              ) : null}

              {!isAnalysed && !showPreWarn ? (
                <>
                  {busy === "analysing" ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={cancelAnalyse}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="primary-btn analyse-btn ocean-analyse-btn"
                      data-testid="ocean-capture-analyse"
                      data-ai="true"
                      disabled={
                        busy !== "idle" ||
                        recording.active ||
                        !content.trim() ||
                        usage.remaining <= 0
                      }
                    >
                      <span className="ocean-ai-glyph" aria-hidden>
                        ✦
                      </span>{" "}
                      Analyse
                    </button>
                  )}
                  <span className="ai-use-hint">Uses AI</span>
                </>
              ) : null}
            </div>
          </div>
        </form>
      </section>

      {showPreWarn && preReliability ? (
        <CaptureReliabilityNotice
          assessment={preReliability}
          stage="pre"
          onAnalyseAnyway={() => {
            dismissPreReliabilityWarn();
            void runAnalyse(content, "conversation", defaultProjectId);
          }}
          showDevDetails={isDev}
        />
      ) : null}

      {reviewOpen && reliability && reliability.state !== "normal" ? (
        <CaptureReliabilityNotice
          assessment={reliability}
          stage="post"
          onEditCapture={editCapture}
          onAnalyseAgain={() => {
            void runAnalyse(content, "conversation", defaultProjectId, {
              force: true,
            });
          }}
          showDevDetails={isDev}
        />
      ) : null}

      {reviewOpen ? (
        <div
          className="capture-review capture-review-workspace"
          data-testid="ocean-capture-review"
        >
          <p className="ocean-capture-review-boundary" role="note">
            Review every finding below. Nothing enters maintained project truth
            until you approve it (Approve / Apply Ready / Remember).
          </p>
          <CaptureSummary
            observations={observations}
            changesDetected={counts.changesDetected}
            readyCount={counts.ready}
            needsAttentionCount={counts.needsAttention}
            onSelectObservation={onSelectObservation}
          />
          <SuggestedChangesList
            models={reviewModels}
            added={added}
            dismissed={dismissed}
            readyCount={counts.ready}
            needsReviewCount={counts.needsReview}
            unmatchedCount={counts.unmatched}
            reviewedCount={counts.reviewed}
            totalCount={counts.total}
            targetOptions={targetOptions}
            highlightedId={highlightedCardId}
            onApprove={approveById}
            onDismiss={dismissOne}
            onApproveReady={approveReady}
            onUseThis={onUseThis}
            onChooseTarget={onChooseTarget}
            onChooseProject={onChooseProject}
            onCreateNew={onCreateNew}
            onResolve={onResolve}
            onChangeEntityKind={onChangeEntityKind}
          />
        </div>
      ) : null}

      {error && !isAnalysed ? (
        <div className="error-banner capture-error" role="alert">
          <p>{error}</p>
          <div className="row-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                void runAnalyse(content, "conversation", defaultProjectId)
              }
            >
              Retry
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void navigator.clipboard.writeText(content)}
            >
              Copy text
            </button>
          </div>
        </div>
      ) : null}

      {process.env.NODE_ENV === "development" && openaiConfigured === false ? (
        <p className="dev-banner" role="note">
          Development: OpenAI key not configured — Capture runs in local mode.
        </p>
      ) : null}

      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </section>
  );
}
