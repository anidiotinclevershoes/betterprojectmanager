"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { CaptureContextInspector } from "@/components/capture/CaptureContextInspector";
import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import { CaptureTips } from "@/components/capture/CaptureTips";
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
}: {
  defaultProjectId?: string;
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
    addFileName,
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
    expandCapture,
    restoreCapture,
  } = session;

  const effectiveProjectId = projectId || defaultProjectId || "";
  const scopedProject = defaultProjectId
    ? state.projects.find((p) => p.id === defaultProjectId)
    : null;
  const scopeLabel = scopedProject
    ? scopedProject.name
    : effectiveProjectId
      ? state.projects.find((p) => p.id === effectiveProjectId)?.name
      : null;
  const isProjectScoped = Boolean(defaultProjectId);

  const recording = useRecordingBridge({
    content,
    setContent,
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
    // Project-scoped Capture must stay within that project.
    await runAnalyse(content, "conversation", defaultProjectId);
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
  const panelClass = [
    "capture-workspace",
    "capture-compact",
    maximized ? "is-maximized" : "",
    collapsed ? "is-minimised" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={panelClass} aria-labelledby={titleId}>
      <div className="capture-workspace-head">
        <div>
          <h2 id={titleId} className="capture-title">
            Capture anything
          </h2>
          {!showSessionActions ? (
            <p className="capture-support">
              Paste notes, type an update, upload a file or record your thoughts.
            </p>
          ) : analysedLabel ? (
            <p className="capture-support meta">Last analysed {analysedLabel}</p>
          ) : null}
          <p
            className="capture-scope-indicator"
            title={
              isProjectScoped
                ? "Lume will consider and update this project only. For updates spanning multiple projects, use Capture from Overview."
                : "Overview Capture can update across projects when the Capture names them."
            }
          >
            <span className="capture-scope-dot" aria-hidden>
              ◎
            </span>
            {isProjectScoped && scopeLabel
              ? `${scopeLabel} only`
              : "All Projects"}
          </p>
        </div>
        <div className="capture-header-actions">
          {showSessionActions ? (
            <CaptureContextInspector manifest={contextManifest} />
          ) : null}
          <div className="capture-window-controls" role="group" aria-label="Capture window">
            <button
              type="button"
              className="capture-window-btn"
              onClick={minimiseCapture}
              aria-label="Minimise Capture"
              title="Minimise Capture"
            >
              ─
            </button>
            <button
              type="button"
              className="capture-window-btn"
              onClick={() => {
                if (collapsed) restoreCapture();
                else if (maximized) restoreCapture();
                else expandCapture();
              }}
              aria-label={
                collapsed
                  ? "Restore Capture"
                  : maximized
                    ? "Restore Capture"
                    : "Expand Capture"
              }
              title={
                collapsed
                  ? "Restore Capture"
                  : maximized
                    ? "Restore Capture"
                    : "Expand Capture"
              }
            >
              {maximized && !collapsed ? "❐" : "□"}
            </button>
          </div>
          {showSessionActions ? (
            <button
              type="button"
              className="ghost-btn capture-new-btn"
              onClick={clearSession}
            >
              New capture
            </button>
          ) : null}
        </div>
      </div>

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
          <textarea
            id="capture-input"
            value={content}
            onChange={(e) => {
              if (!isAnalysed) setContent(e.target.value);
            }}
            rows={3}
            readOnly={isAnalysed}
            disabled={busy === "analysing"}
            placeholder="What happened? Add notes, paste text or drop files here…"
            className={`capture-textarea capture-textarea-idle ${isAnalysed ? "is-readonly" : ""}`}
            aria-readonly={isAnalysed || undefined}
          />
          {!isAnalysed ? <CaptureTips /> : null}
          {fileNames.length && !isAnalysed ? (
            <p className="meta mt-1">Files: {fileNames.join(", ")}</p>
          ) : null}

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

                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      void navigator.clipboard
                        .readText()
                        .then((text) => {
                          if (text)
                            setContent(content ? `${content}\n${text}` : text);
                        })
                        .catch(() =>
                          setError(
                            "Clipboard access blocked — paste with Ctrl/Cmd+V instead.",
                          ),
                        );
                    }}
                    disabled={busy === "analysing"}
                  >
                    Paste text
                  </button>

                  <label className="ghost-btn file-btn">
                    Upload file
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || isAnalysed) return;
                        addFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => {
                          const text = String(reader.result ?? "");
                          setContent(content ? `${content}\n${text}` : text);
                        };
                        reader.readAsText(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
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
                <button
                  type="submit"
                  className="primary-btn analyse-btn"
                  disabled={
                    busy !== "idle" ||
                    recording.active ||
                    !content.trim() ||
                    usage.remaining <= 0
                  }
                >
                  Analyse
                </button>
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
        <div className="capture-review capture-review-workspace">
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

function useRecordingBridge({
  content,
  setContent,
  setBusy,
  setError,
  announce,
  locked,
  onRecorded,
}: {
  content: string;
  setContent: (v: string) => void;
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
  const contentRef = useRef(content);
  const lockedRef = useRef(locked);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
      liveBaseRef.current = contentRef.current;
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
        setContent(
          `${liveBaseRef.current}${interim ? ` ${interim}` : ""}`.trim(),
        );
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
      return;
    }
    if (contentRef.current.trim()) {
      setBusy("idle");
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
      if (!lockedRef.current) setContent(data.text);
      announce("Transcript ready. Edit if needed, then press Analyse.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice capture failed");
    } finally {
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
