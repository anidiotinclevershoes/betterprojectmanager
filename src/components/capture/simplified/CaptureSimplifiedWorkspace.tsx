"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { CaptureAutoTextarea } from "@/components/capture/CaptureAutoTextarea";
import { CaptureContextInspector } from "@/components/capture/CaptureContextInspector";
import { CaptureLayoutToggle } from "@/components/capture/CaptureLayoutToggle";
import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { useRecordingBridge } from "@/components/capture/useRecordingBridge";
import { CaptureSimplifiedReview } from "@/components/capture/simplified/CaptureSimplifiedReview";
import { useMission } from "@/lib/store";
import { shouldWarnBeforeAnalysis } from "@/lib/capture/reliability";
import {
  buildReviewChangeViewModels,
  computeReviewCounts,
  pendingReadyModels,
} from "@/lib/capture/review/viewModel";
import type { TargetOption } from "@/components/capture/review/TargetPicker";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { KIND_LABEL } from "@/lib/capture/suggestions";
import type { CaptureLayoutExperiment } from "@/lib/capture/layout-experiment";

export function CaptureSimplifiedWorkspace({
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
  const session = useCaptureSession();
  const {
    content,
    setContent,
    projectId,
    setProjectId,
    result,
    suggestions,
    dismissed,
    added,
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
    contextManifest,
    reliability,
    preWarnDismissed,
    reviewOverrides,
    setReviewOverride,
    updateSuggestion,
    maximized,
    minimiseCapture,
    restoreCapture,
    collapsed,
  } = session;

  const effectiveProjectId = projectId || defaultProjectId || "";
  const softHintProjectId = defaultProjectId || undefined;
  const composeBaseRef = useRef("");
  const liveRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [noteOpen, setNoteOpen] = useState(false);

  const recording = useRecordingBridge({
    setRecordingText: (text) => {
      const base = composeBaseRef.current.trim();
      setContent(base ? `${base}\n\n${text}` : text);
    },
    prepareRecordingBlock: () => {
      composeBaseRef.current = content;
      return "single";
    },
    finalizeRecordingBlock: () => {
      composeBaseRef.current = "";
    },
    setBusy,
    setError,
    announce,
    locked: isAnalysed,
    onRecorded: () => setSource("recorded"),
  });

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

  const isOcean = variant === "ocean";
  const panelClass = [
    "capture-workspace",
    "capture-compact",
    "capture-v2-workspace",
    isOcean ? "ocean-capture-workspace" : "",
    maximized ? "is-maximized" : "",
    collapsed ? "is-minimised" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stage = reviewOpen
    ? "review"
    : recording.active
      ? "recording"
      : busy === "analysing"
        ? "analysing"
        : content.trim()
          ? "transcript-complete"
          : "input";

  return (
    <section
      className={panelClass}
      aria-labelledby={titleId}
      data-testid={isOcean ? "ocean-capture-workspace" : "capture-workspace"}
      data-capture-variant={variant}
      data-capture-layout="simplified"
      data-capture-experiment="v2"
      data-capture-stage={stage}
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
              "Capture"
            )}
          </h2>
          <CaptureLayoutToggle layout={layout} onChange={onLayoutChange} />
          {!isAnalysed ? (
            <p className="capture-support">
              Tell Lume what happened. Nothing is saved until you review it.
            </p>
          ) : (
            <p className="capture-support meta">Review the proposed changes.</p>
          )}
        </div>
        <div className="capture-header-actions">
          {isAnalysed && isDev ? (
            <CaptureContextInspector manifest={contextManifest} />
          ) : null}
          <button
            type="button"
            className={isOcean ? "ghost-btn capture-new-btn" : "capture-new-btn"}
            onClick={clearSession}
            title="New Capture"
            aria-label="New Capture"
            data-testid="capture-v2-new"
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
          Capture minimised — Expand to continue.
        </p>
      ) : null}

      {!collapsed ? (
        <section className="capture-transcript-panel capture-v2-compose">
          {isAnalysed ? (
            <details
              className="capture-v2-note"
              open={noteOpen}
              onToggle={(e) =>
                setNoteOpen((e.target as HTMLDetailsElement).open)
              }
            >
              <summary className="capture-v2-note-summary">Your note</summary>
              <CaptureAutoTextarea
                id="capture-input"
                value={content}
                onChange={() => undefined}
                readOnly
                disabled={busy === "analysing"}
                placeholder="What happened?"
                testId="ocean-capture-input"
              />
              <button
                type="button"
                className="ghost-btn capture-v2-edit-note"
                onClick={editCapture}
              >
                Edit note
              </button>
            </details>
          ) : (
            <form onSubmit={onSubmit} className="capture-form capture-v2-form">
              <label className="sr-only" htmlFor="capture-input">
                Capture notes
              </label>
              <CaptureAutoTextarea
                id="capture-input"
                value={content}
                onChange={setContent}
                readOnly={false}
                disabled={busy === "analysing"}
                placeholder="What happened? Type an update or press Record…"
                testId="ocean-capture-input"
                className="capture-v2-textarea"
              />

              <div className="capture-toolbar capture-v2-toolbar">
                <div className="capture-toolbar-left">
                  {!defaultProjectId ? (
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
                        "Analysing…"
                      )}
                    </span>
                  ) : null}
                </div>

                <div className="capture-toolbar-right">
                  {!showPreWarn ? (
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
                            !content.trim()
                          }
                        >
                          <span className="ocean-ai-glyph" aria-hidden>
                            ✦
                          </span>{" "}
                          Analyse
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </form>
          )}
        </section>
      ) : null}

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
        <CaptureSimplifiedReview
          models={reviewModels}
          added={added}
          dismissed={dismissed}
          readyCount={counts.ready}
          needsReviewCount={counts.needsReview}
          unmatchedCount={counts.unmatched}
          targetOptions={targetOptions}
          highlightedId={null}
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
