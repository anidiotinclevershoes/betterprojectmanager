"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import "@/components/capture/capture-experience.css";
import { CaptureContextInspector } from "@/components/capture/CaptureContextInspector";
import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { FirstCaptureCue } from "@/components/onboarding/FirstRunCue";
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
import { applyPendingReadyQueue } from "@/lib/capture/review/applyReadyQueue";
import {
  CaptureSummary,
  SuggestedChangesList,
  AnnotatedTranscript,
} from "@/components/capture/review";
import { annotationSourcesFromResult } from "@/lib/capture/review/annotateTranscript";
import type { TargetOption } from "@/components/capture/review/TargetPicker";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { KIND_LABEL } from "@/lib/capture/suggestions";
import { captureApplyWorldFromState } from "@/lib/capture/apply";
import { ConfirmOwnerDialog } from "@/components/intelligence/ConfirmOwnerDialog";
import type { OwnershipIntent } from "@/lib/people/confirm-owner-choice";
import { findConfirmedOwners } from "@/lib/people/identity";
import type { ReviewOwnerHit } from "@/lib/capture/review/reviewReason";

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
    markOneApplied,
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
  const [confirmOwner, setConfirmOwner] = useState<{
    suggestionId: string;
    projectId: string;
    scope: string;
    personName: string;
    personId?: string | null;
    intent?: OwnershipIntent | null;
    replacePersonId?: string | null;
  } | null>(null);
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

  const applyWorld = useMemo(
    () => captureApplyWorldFromState(state),
    [state],
  );

  const reviewModels = useMemo(
    () =>
      result
        ? buildReviewChangeViewModels(
            suggestions,
            result,
            content,
            reviewOverrides,
            {
              world: applyWorld,
              captureEntryProjectId: defaultProjectId || effectiveProjectId,
            },
          )
        : [],
    [
      result,
      suggestions,
      content,
      reviewOverrides,
      applyWorld,
      defaultProjectId,
      effectiveProjectId,
    ],
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
  const annotationSources = useMemo(
    () => annotationSourcesFromResult(result, reviewCardIdsByFinding),
    [result, reviewCardIdsByFinding],
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
    for (const risk of state.risks ?? []) {
      if (risk.projectId !== pid) continue;
      options.push({
        id: risk.id,
        title: risk.title,
        entityLabel: KIND_LABEL.risk,
        status: risk.status,
      });
    }
    const project = state.projects.find((p) => p.id === pid);
    for (const person of project?.stakeholders ?? []) {
      options.push({
        id: person.id,
        title: person.name,
        entityLabel: KIND_LABEL.stakeholder,
        status: person.role,
      });
    }
    for (const mile of state.timeline ?? []) {
      if (mile.projectId !== pid) continue;
      options.push({
        id: mile.id,
        title: mile.label,
        entityLabel: KIND_LABEL.milestone,
        status: mile.startAt?.slice(0, 10),
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
    return options;
  }, [
    defaultProjectId,
    effectiveProjectId,
    state.todos,
    state.meetings,
    state.risks,
    state.projects,
    state.timeline,
  ]);

  const ownersByCardId = useMemo(() => {
    const map: Record<string, ReviewOwnerHit[]> = {};
    for (const m of reviewModels) {
      const scope = m.suggestion.responsibilityScope?.trim();
      if (!scope) continue;
      const pid = m.projectId || defaultProjectId;
      if (!pid) continue;
      const knowledge = state.knowledge.find((k) => k.projectId === pid);
      map[m.id] = findConfirmedOwners(knowledge, scope).map((o) => ({
        personId: o.personId,
        personName: o.personName,
        scope: o.scope,
      }));
    }
    return map;
  }, [reviewModels, state.knowledge, defaultProjectId]);

  function approveById(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    if (model.readiness === "unmatched") {
      dismissOne(id);
      return;
    }
    void applyOne(model.suggestion, defaultProjectId).then((decision) => {
      if (decision.kind === "needs_you" && decision.confirmOwner) {
        setConfirmOwner({
          suggestionId: id,
          ...decision.confirmOwner,
        });
      }
    });
  }

  async function approveReady() {
    const { confirmOwner } = await applyPendingReadyQueue({
      models: pendingReadyModels(reviewModels, added, dismissed),
      applyOne: (item) => applyOne(item, defaultProjectId),
    });
    if (confirmOwner) {
      setConfirmOwner(confirmOwner);
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
            : option.entityLabel === KIND_LABEL.stakeholder
              ? "stakeholder"
              : option.entityLabel === KIND_LABEL.milestone
                ? "milestone"
                : option.entityLabel === KIND_LABEL.availability
                  ? "availability"
                  : "action";
    const isTodo = kind === "action" || kind === "nudge";
    updateSuggestion(id, {
      content: option.title,
      targetTodoId: isTodo ? option.id : undefined,
      targetEntityId: option.id,
      kind,
      op: "update",
    });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      content: option.title,
      targetTodoId: isTodo ? option.id : undefined,
      kind,
      op: "update",
      recordName: option.title,
    });
  }

  function onCreateNew(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    updateSuggestion(id, {
      op: "create",
      targetTodoId: undefined,
      targetEntityId: undefined,
    });
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
    void applyOne({ ...model.suggestion, op: "complete" }, defaultProjectId);
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

  function onChooseOwnership(
    id: string,
    choice: "share" | "replace" | "keep",
    replacePersonId?: string | null,
  ) {
    if (choice === "keep") {
      dismissOne(id);
      return;
    }
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    const personName = model.suggestion.personName?.trim() || "";
    const scope = model.suggestion.responsibilityScope?.trim() || "";
    const projectId =
      model.projectId || defaultProjectId || effectiveProjectId;
    const next = {
      ...model.suggestion,
      ownershipSemantics: choice,
      replacePersonId:
        choice === "replace" ? replacePersonId ?? undefined : undefined,
      proposedValues: {
        ...(model.suggestion.proposedValues ?? {}),
        ownershipSemantics: choice,
        ...(choice === "replace" && replacePersonId
          ? { replacePersonId }
          : {}),
      },
    };
    updateSuggestion(id, {
      ownershipSemantics: choice,
      replacePersonId:
        choice === "replace" ? replacePersonId ?? undefined : undefined,
    });
    if (!personName || !scope || !projectId) {
      if (projectId && scope) {
        setConfirmOwner({
          suggestionId: id,
          projectId,
          scope,
          personName,
          personId: model.suggestion.personId ?? null,
          intent: choice,
          replacePersonId: replacePersonId ?? null,
        });
      }
      return;
    }
    void applyOne(next, defaultProjectId).then((decision) => {
      if (decision.kind === "needs_you" && decision.confirmOwner) {
        setConfirmOwner({
          suggestionId: id,
          ...decision.confirmOwner,
          intent: choice,
          replacePersonId: replacePersonId ?? null,
        });
      }
    });
  }

  function onProvideDate(id: string, isoDate: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model || !isoDate.trim()) return;
    updateSuggestion(id, { date: isoDate });
    setReviewOverride(id, {
      accepted: true,
      readiness: "ready",
      reviewReason: null,
      date: isoDate,
    });
    void applyOne({ ...model.suggestion, date: isoDate }, defaultProjectId);
  }

  function onSelectObservation(obs: CaptureObservation) {
    if (!obs.reviewCardId) return;
    onFocusReviewCard(obs.reviewCardId);
  }

  /** Isolated presentation helper — no CaptureSessionContext change required. */
  function onFocusReviewCard(reviewCardId: string) {
    const el = document.getElementById(`review-card-${reviewCardId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedCardId(reviewCardId);
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
          {!showSessionActions ? (
            <p className="capture-support">Tell Lume what changed.</p>
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

      {isOcean && !collapsed ? (
        <FirstCaptureCue
          composeEmpty={!content.trim()}
          analysing={busy === "analysing"}
          reviewOpen={Boolean(reviewOpen)}
        />
      ) : null}

      {/* Transcript stays visible after analysis (read-only), including when collapsed. */}
      <section
        className="capture-transcript-panel"
        aria-labelledby={isAnalysed ? "capture-transcript-title" : undefined}
      >
        {isAnalysed ? (
          <h3 id="capture-transcript-title" className="capture-review-section-title">
            Your notes
          </h3>
        ) : null}
        <form onSubmit={onSubmit} className="capture-form">
        {isAnalysed ? null : (
          <label className="sr-only" htmlFor="capture-input">
            Capture notes
          </label>
        )}
          <div className={!isAnalysed ? "capture-compose" : undefined}>
            {isAnalysed ? (
              <AnnotatedTranscript
                transcript={content}
                sources={annotationSources}
                onFocusReviewCard={onFocusReviewCard}
              />
            ) : (
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
                        ? "Tell Lume what changed…"
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
            )}
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

      {confirmOwner ? (
        <ConfirmOwnerDialog
          projectId={confirmOwner.projectId}
          scope={confirmOwner.scope}
          defaultPersonName={confirmOwner.personName}
          defaultReplacePersonId={confirmOwner.replacePersonId}
          defaultIntent={confirmOwner.intent}
          onDone={() => {
            const id = confirmOwner.suggestionId;
            setConfirmOwner(null);
            markOneApplied(id);
          }}
          onCancel={() => setConfirmOwner(null)}
        />
      ) : null}

      {reviewOpen ? (
        <div
          className="capture-review capture-review-workspace"
          data-testid="ocean-capture-review"
        >
          <p className="ocean-capture-review-boundary" role="note">
            Check anything I need you on. Nothing is saved until you approve.
          </p>
          <CaptureSummary
            observations={observations}
            changesDetected={counts.changesDetected}
            readyCount={counts.ready}
            needsAttentionCount={counts.needsAttention}
            onSelectObservation={onSelectObservation}
          />
          {result?.capturePipeline === "v2" && result.observationAccount ? (
            <p
              className="capture-summary-line capture-v2-account"
              data-testid="capture-v2-account"
              role="status"
            >
              <span>
                {result.observationAccount.total} understood
              </span>
              <span aria-hidden>·</span>
              <span>
                {result.observationAccount.proposedChanges} to change
              </span>
              {result.observationAccount.alreadyKnown > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {result.observationAccount.alreadyKnown} already known
                  </span>
                </>
              ) : null}
              {result.observationAccount.needsYou > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {result.observationAccount.needsYou} need you
                  </span>
                </>
              ) : null}
              {result.observationAccount.commentary > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {result.observationAccount.commentary} noted
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
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
            onChooseOwnership={onChooseOwnership}
            onProvideDate={onProvideDate}
            ownersByCardId={ownersByCardId}
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

function CaptureAutoTextarea({
  id,
  value,
  onChange,
  readOnly,
  disabled,
  placeholder,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      data-ai="false"
      className={`capture-textarea capture-textarea-idle capture-textarea-auto ${readOnly ? "is-readonly" : ""}`}
      aria-readonly={readOnly || undefined}
    />
  );
}

function useRecordingBridge({
  setRecordingText,
  prepareRecordingBlock,
  finalizeRecordingBlock,
  setBusy,
  setError,
  announce,
  locked,
  onRecorded,
}: {
  setRecordingText: (text: string) => void;
  prepareRecordingBlock: () => string;
  finalizeRecordingBlock: () => void;
  setBusy: (v: "idle" | "transcribing" | "analysing") => void;
  setError: (v: string | null) => void;
  announce: (v: string) => void;
  locked: boolean;
  onRecorded: () => void;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const liveBaseRef = useRef("");
  const recordingTextRef = useRef("");
  const lockedRef = useRef(locked);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  async function start() {
    if (lockedRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void finish(recorder.mimeType || mimeType);
      };
      mediaRecorderRef.current = recorder;
      prepareRecordingBlock();
      liveBaseRef.current = "";
      recordingTextRef.current = "";
      recorder.start();
      setActive(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      onRecorded();

      const w = window as Window & {
        SpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          onresult: ((e: unknown) => void) | null;
          onerror: ((e: unknown) => void) | null;
          start: () => void;
          stop: () => void;
        };
        webkitSpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          onresult: ((e: unknown) => void) | null;
          onerror: ((e: unknown) => void) | null;
          start: () => void;
          stop: () => void;
        };
      };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SR) {
        setHint("Recording… live transcription unavailable in this browser");
        return;
      }
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (rawEvent: unknown) => {
        if (lockedRef.current) return;
        const event = rawEvent as {
          resultIndex: number;
          results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
        };
        let interim = "";
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) finalChunk += transcript;
          else interim += transcript;
        }
        if (finalChunk) {
          liveBaseRef.current = `${liveBaseRef.current} ${finalChunk}`.trim();
        }
        const next = `${liveBaseRef.current}${interim ? ` ${interim}` : ""}`.trim();
        recordingTextRef.current = next;
        setRecordingText(next);
        setHint("Live transcription");
      };
      recognition.onerror = () => setHint("Recording…");
      recognitionRef.current = recognition;
      recognition.start();
      setHint("Live transcription");
    } catch {
      setError(
        "Microphone permission denied. Allow mic access or type your note instead.",
      );
      finalizeRecordingBlock();
    }
  }

  function stop() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    setActive(false);
    setHint(null);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function finish(mimeType: string) {
    if (lockedRef.current) {
      setBusy("idle");
      finalizeRecordingBlock();
      return;
    }
    if (recordingTextRef.current.trim()) {
      setBusy("idle");
      finalizeRecordingBlock();
      announce("Recording saved. Edit the transcript, then press Analyse.");
      return;
    }
    setBusy("transcribing");
    setError(null);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("audio", blob, `capture.${extension}`);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.error || "Transcription failed");
      }
      if (!lockedRef.current) {
        recordingTextRef.current = data.text;
        setRecordingText(data.text);
      }
      announce("Transcript ready. Edit if needed, then press Analyse.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice capture failed");
    } finally {
      finalizeRecordingBlock();
      setBusy("idle");
    }
  }

  return {
    active,
    seconds,
    hint,
    start,
    stop,
  };
}
