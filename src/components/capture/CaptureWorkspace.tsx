"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { CaptureContextInspector } from "@/components/capture/CaptureContextInspector";
import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import { useMission } from "@/lib/store";
import { analysesRemaining } from "@/lib/workspace/history";
import { shouldWarnBeforeAnalysis } from "@/lib/capture/reliability";
import { buildCaptureObservations } from "@/lib/capture/review/observations";
import {
  buildReviewChangeViewModels,
  computeReviewCounts,
  pendingReadyModels,
} from "@/lib/capture/review/viewModel";
import {
  CaptureSummary,
  SuggestedChangesList,
} from "@/components/capture/review";

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
    setCollapsed,
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
  } = session;

  const effectiveProjectId = projectId || defaultProjectId || "";
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

  const observations = useMemo(
    () =>
      result ? buildCaptureObservations(result, content) : [],
    [result, content],
  );
  const reviewModels = useMemo(
    () =>
      result ? buildReviewChangeViewModels(suggestions, result, content) : [],
    [result, suggestions, content],
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

  function approveById(id: string) {
    const model = reviewModels.find((m) => m.id === id);
    if (!model) return;
    // Unmatched coverage gaps have no safe operation — dismiss only.
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
  const analysedLabel = formatAnalysedAt(analysedAt);

  return (
    <section className="capture-workspace capture-compact" aria-labelledby={titleId}>
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
        </div>
        {showSessionActions ? (
          <div className="capture-header-actions">
            <CaptureContextInspector manifest={contextManifest} />
            {!collapsed ? (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse capture review"
                title="Collapse"
              >
                ▴
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-btn capture-new-btn"
              onClick={clearSession}
            >
              New capture
            </button>
          </div>
        ) : null}
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
              ) : collapsed ? (
                <button
                  type="button"
                  className="primary-btn analyse-btn"
                  onClick={expandAnalysis}
                >
                  Expand Analysis
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
            onApprove={approveById}
            onDismiss={dismissOne}
            onApproveReady={approveReady}
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
