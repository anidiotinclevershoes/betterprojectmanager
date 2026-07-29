"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useCaptureSession } from "@/components/capture/CaptureSessionContext";
import { useMission } from "@/lib/store";
import { analysesRemaining } from "@/lib/workspace/history";
import {
  KIND_LABEL,
  OP_LABEL,
  SUGGESTION_KINDS,
  SUGGESTION_OPS,
  type SuggestionKind,
  type SuggestionOp,
} from "@/lib/capture/suggestions";

function projectCode(
  projects: { id: string; code: string }[],
  projectId?: string | null,
) {
  if (!projectId) return "Unassigned";
  return projects.find((p) => p.id === projectId)?.code ?? "—";
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
    editing,
    setEditingContent,
    updateSuggestion,
    collapsed,
    setCollapsed,
    busy,
    setBusy,
    error,
    setError,
    statusMessage,
    announce,
    analyse,
    applyOne,
    dismissOne,
    clearSession,
    pendingCount,
    hasTranscript,
  } = session;

  const effectiveProjectId = projectId || defaultProjectId || "";
  const recording = useRecordingBridge({
    content,
    setContent,
    setBusy,
    setError,
    announce,
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
    await analyse(content, "conversation", defaultProjectId);
  }

  const reviewOpen = Boolean(result);
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed[s.id] && !added[s.id],
  );

  if (reviewOpen && collapsed) {
    return (
      <section className="capture-workspace capture-collapsed" aria-labelledby={titleId}>
        <div className="capture-collapsed-row">
          <div>
            <h2 id={titleId} className="capture-title">
              Capture
            </h2>
            <p className="meta">
              {hasTranscript ? "Transcript available" : "Analysis ready"}
              {fileNames.length ? ` · ${fileNames.length} file(s)` : ""}
              {pendingCount > 0
                ? ` · ${pendingCount} suggested action${pendingCount === 1 ? "" : "s"}`
                : " · All suggestions reviewed"}
            </p>
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => setCollapsed(false)}
            >
              Expand
            </button>
            <button type="button" className="ghost-btn" onClick={clearSession}>
              New capture
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="capture-workspace capture-compact" aria-labelledby={titleId}>
      <div className="capture-workspace-head">
        <div>
          <h2 id={titleId} className="capture-title">
            Capture anything
          </h2>
          <p className="capture-support">
            Paste notes, type an update, upload a file or record your thoughts.
          </p>
        </div>
        {reviewOpen ? (
          <div className="row-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setCollapsed(true)}
            >
              Collapse
            </button>
            <button type="button" className="ghost-btn" onClick={clearSession}>
              New capture
            </button>
          </div>
        ) : null}
      </div>

      {!reviewOpen ? (
        <form onSubmit={onSubmit} className="capture-form">
          <label className="sr-only" htmlFor="capture-input">
            Capture notes
          </label>
          <textarea
            id="capture-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            disabled={busy === "analysing"}
            placeholder="What happened? Add notes, paste text or drop files here…"
            className="capture-textarea capture-textarea-idle"
          />
          {fileNames.length ? (
            <p className="meta mt-1">Files: {fileNames.join(", ")}</p>
          ) : null}

          <div className="capture-toolbar">
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
                      if (text) setContent(content ? `${content}\n${text}` : text);
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
                    if (!file) return;
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
            </div>
          </div>
        </form>
      ) : (
        <div className="capture-review">
          <div className="capture-review-feedback">
            <h3>Interpretation</h3>
            <h4>Summary</h4>
            <p className="capture-summary">{result?.memory.content}</p>
            {result?.insights?.length ? (
              <>
                <h4>Observations</h4>
                <ul>
                  {result.insights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {result?.assumptions?.length ? (
              <>
                <h4>Missing information</h4>
                <ul>
                  {result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="capture-review-suggestions">
            <div className="capture-review-suggestions-head">
              <h3>Suggested actions</h3>
              <p className="meta">Review each item individually</p>
            </div>

            {visibleSuggestions.length === 0 ? (
              <p className="empty-copy">No pending suggestions.</p>
            ) : (
              <ul className="suggestion-list">
                {visibleSuggestions.map((item) => (
                  <li key={item.id} className="suggestion-card">
                    <div className="suggestion-top suggestion-controls">
                      <label className="field mb-0">
                        <span className="sr-only">Type</span>
                        <select
                          value={item.kind}
                          onChange={(e) =>
                            updateSuggestion(item.id, {
                              kind: e.target.value as SuggestionKind,
                            })
                          }
                          aria-label="Suggestion type"
                        >
                          {SUGGESTION_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {KIND_LABEL[kind]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field mb-0">
                        <span className="sr-only">Operation</span>
                        <select
                          value={item.op}
                          onChange={(e) =>
                            updateSuggestion(item.id, {
                              op: e.target.value as SuggestionOp,
                            })
                          }
                          aria-label="Suggestion operation"
                        >
                          {SUGGESTION_OPS.map((op) => (
                            <option key={op} value={op}>
                              {OP_LABEL[op]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="meta">
                        {projectCode(state.projects, item.projectId)}
                        {item.date ? ` · ${item.date}` : ""}
                      </span>
                    </div>
                    {editing[item.id] !== undefined ? (
                      <textarea
                        value={editing[item.id]}
                        onChange={(e) =>
                          setEditingContent(item.id, e.target.value)
                        }
                        rows={2}
                        className="capture-textarea compact"
                      />
                    ) : (
                      <p className="suggestion-content">{item.content}</p>
                    )}
                    <p className="meta">
                      {OP_LABEL[item.op]} → {KIND_LABEL[item.kind]} ·{" "}
                      {item.destination}
                    </p>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() =>
                          setEditingContent(
                            item.id,
                            editing[item.id] !== undefined
                              ? null
                              : item.content,
                          )
                        }
                      >
                        {editing[item.id] !== undefined ? "Done" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => applyOne(item, defaultProjectId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => dismissOne(item.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {suggestions.some((s) => added[s.id]) ? (
              <p className="meta mt-2">
                {suggestions.filter((s) => added[s.id]).length} accepted ·{" "}
                {pendingCount} remaining
              </p>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <div className="error-banner capture-error" role="alert">
          <p>{error}</p>
          <div className="row-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void analyse(content, "conversation", defaultProjectId)}
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
}: {
  content: string;
  setContent: (v: string) => void;
  setBusy: (v: "idle" | "transcribing" | "analysing") => void;
  setError: (v: string | null) => void;
  announce: (v: string) => void;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const liveBaseRef = useRef("");
  const contentRef = useRef(content);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  async function start() {
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
      setContent(data.text);
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
