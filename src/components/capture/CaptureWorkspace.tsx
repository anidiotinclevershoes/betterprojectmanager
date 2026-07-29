"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMission } from "@/lib/store";
import { analysesRemaining } from "@/lib/workspace/history";
import type {
  CaptureResult,
  KnowledgeSectionId,
  Recommendation,
  TimelineItemInput,
} from "@/lib/types";

type SuggestionKind =
  | "action"
  | "milestone"
  | "decision"
  | "risk"
  | "stakeholder"
  | "knowledge"
  | "nudge"
  | "meeting"
  | "memory";

type PendingSuggestion = {
  id: string;
  kind: SuggestionKind;
  content: string;
  projectId?: string | null;
  date?: string;
  destination: string;
  recommendation?: Recommendation;
  timelineItem?: TimelineItemInput;
  knowledgeSection?: KnowledgeSectionId;
  knowledgeBullet?: string;
};

function projectCode(
  projects: { id: string; code: string }[],
  projectId?: string | null,
) {
  if (!projectId) return "Unassigned";
  return projects.find((p) => p.id === projectId)?.code ?? "—";
}

function buildSuggestions(result: CaptureResult): PendingSuggestion[] {
  const items: PendingSuggestion[] = [];
  const projectId = result.knowledgeProjectId || result.memory.projectId;

  items.push({
    id: `memory-${result.memory.id}`,
    kind: "memory",
    content: result.memory.title,
    projectId: result.memory.projectId,
    destination: "Knowledge",
  });

  for (const rec of result.recommendations) {
    const kind: SuggestionKind =
      rec.kind === "risk"
        ? "risk"
        : rec.kind === "decision"
          ? "decision"
          : rec.kind === "meeting" || rec.kind === "meeting_prep"
            ? "meeting"
            : rec.kind === "stakeholder_update"
              ? "nudge"
              : "action";
    items.push({
      id: `rec-${rec.id}`,
      kind,
      content: rec.title,
      projectId: rec.projectId ?? projectId,
      destination:
        kind === "action"
          ? "To Do"
          : kind === "nudge"
            ? "Nudge"
            : kind === "meeting"
              ? "Meeting"
              : "Suggestions",
      recommendation: rec,
    });
  }

  for (const [index, item] of (result.timelinePatch ?? []).entries()) {
    items.push({
      id: `tl-${index}-${item.label}`,
      kind: "milestone",
      content: item.label,
      projectId,
      date: item.startAt?.slice(0, 10),
      destination: "Milestone",
      timelineItem: item,
    });
  }

  if (result.knowledgePatch) {
    for (const [section, bullets] of Object.entries(result.knowledgePatch) as [
      KnowledgeSectionId,
      string[] | undefined,
    ][]) {
      for (const [index, bullet] of (bullets ?? []).entries()) {
        items.push({
          id: `know-${section}-${index}`,
          kind:
            section === "risks"
              ? "risk"
              : section === "decisions"
                ? "decision"
                : section === "people"
                  ? "stakeholder"
                  : "knowledge",
          content: bullet,
          projectId,
          destination: `Knowledge · ${section}`,
          knowledgeSection: section,
          knowledgeBullet: bullet,
        });
      }
    }
  }

  return items
    .map((item, i) => ({ ...item, id: `${item.id}-${i}` }))
    .filter((item) => item.content.trim());
}

const KIND_LABEL: Record<SuggestionKind, string> = {
  action: "To Do",
  milestone: "Milestone",
  decision: "Decision",
  risk: "Risk",
  stakeholder: "Stakeholder",
  knowledge: "Knowledge",
  nudge: "Nudge",
  meeting: "Meeting",
  memory: "Knowledge",
};

export function CaptureWorkspace({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const {
    state,
    analyzeCaptureWithAI,
    applyCaptureResult,
    addTodo,
    addSuggestion,
    addKnowledgeBullet,
    addTimelineItem,
    openaiConfigured,
  } = useMission();

  const usage = analysesRemaining(state);
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(() => defaultProjectId ?? "");
  const effectiveProjectId = projectId || defaultProjectId || "";
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<"idle" | "transcribing" | "analysing">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [liveHint, setLiveHint] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const liveBaseRef = useRef("");
  const liveRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  function announce(message: string) {
    setStatusMessage(message);
    if (liveRef.current) liveRef.current.textContent = message;
  }

  async function analyse(raw: string, sourceType: "conversation" | "voice_note") {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy("analysing");
    setError(null);
    setResult(null);
    setSuggestions([]);
    setDismissed({});
    setAdded({});
    setEditing({});
    try {
      const next = await analyzeCaptureWithAI({
        content: trimmed,
        projectId: effectiveProjectId || undefined,
        sourceType,
      });
      setResult(next);
      setSuggestions(buildSuggestions(next));
      announce("Capture analysis complete. Review suggested additions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy("idle");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await analyse(content, "conversation");
  }

  function startLiveSpeech() {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setLiveHint("Recording… live transcription unavailable in this browser");
      return;
    }
    liveBaseRef.current = content;
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
      setContent(`${liveBaseRef.current}${interim ? ` ${interim}` : ""}`.trim());
      setLiveHint("Live transcription");
    };
    recognition.onerror = () => {
      setLiveHint("Recording…");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setLiveHint("Live transcription");
  }

  async function startRecording() {
    setError(null);
    setResult(null);
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
        void finishRecording(recorder.mimeType || mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
      startLiveSpeech();
    } catch {
      setError(
        "Microphone permission denied. Allow mic access or type your note instead.",
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    setRecording(false);
    setLiveHint(null);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function finishRecording(mimeType: string) {
    // If live speech already produced text, keep it editable — do not auto-analyse.
    if (content.trim()) {
      setBusy("idle");
      announce("Recording saved. Edit the transcript, then press Analyse.");
      return;
    }

    // Fallback: Whisper transcription only fills the textarea.
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

  function pasteFromClipboard() {
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (text) setContent((prev) => (prev ? `${prev}\n${text}` : text));
      })
      .catch(() => {
        setError("Clipboard access blocked — paste with Ctrl/Cmd+V instead.");
      });
  }

  function applyOne(item: PendingSuggestion) {
    const text = (editing[item.id] ?? item.content).trim();
    if (!text) return;
    const pid = item.projectId ?? (effectiveProjectId || null);

    if (item.kind === "memory" && result) {
      applyCaptureResult({
        ...result,
        recommendations: [],
        knowledgePatch: undefined,
        timelinePatch: undefined,
        memory: { ...result.memory, title: text },
      });
    } else if (item.recommendation) {
      if (item.kind === "action" || item.kind === "nudge") {
        addTodo({
          title: text,
          detail: item.recommendation.action,
          projectId: pid,
        });
      } else if (pid) {
        addSuggestion({
          projectId: pid,
          title: text,
          action: item.recommendation.action,
          why: item.recommendation.why,
          kind: item.recommendation.kind,
          urgency: item.recommendation.urgency,
        });
      } else {
        addTodo({ title: text, projectId: null });
      }
    } else if (item.timelineItem && pid) {
      addTimelineItem(pid, {
        ...item.timelineItem,
        label: text,
        source: "capture",
      });
    } else if (item.knowledgeSection && item.knowledgeBullet && pid) {
      addKnowledgeBullet(pid, item.knowledgeSection, text);
    }

    setAdded((prev) => ({ ...prev, [item.id]: true }));
    announce("Item added");
  }

  function dismissOne(id: string) {
    setDismissed((prev) => ({ ...prev, [id]: true }));
    announce("Item dismissed");
  }

  function acceptAll() {
    const remaining = suggestions.filter(
      (s) => !dismissed[s.id] && !added[s.id],
    );
    for (const item of remaining) applyOne(item);
    announce("Accepted reviewed items");
  }

  function dismissAll() {
    const map: Record<string, boolean> = {};
    for (const s of suggestions) map[s.id] = true;
    setDismissed(map);
    announce("All suggestions dismissed");
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed[s.id]);
  const reviewOpen = Boolean(result);

  const statusLabel =
    busy === "transcribing"
      ? "Transcribing…"
      : busy === "analysing"
        ? "Analysing your update…"
        : recording
          ? liveHint
            ? `${liveHint} · ${seconds}s`
            : `Recording… ${seconds}s`
          : null;

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

          <div className="capture-toolbar">
            <div className="capture-toolbar-left">
              {!defaultProjectId ? (
                <select
                  value={effectiveProjectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={busy !== "idle" || recording}
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

              {!recording ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void startRecording()}
                  disabled={busy === "analysing" || busy === "transcribing"}
                >
                  Record
                </button>
              ) : (
                <button type="button" className="danger-btn" onClick={stopRecording}>
                  Stop · {seconds}s
                </button>
              )}

              <button
                type="button"
                className="ghost-btn"
                onClick={pasteFromClipboard}
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
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = String(reader.result ?? "");
                      setContent((prev) => (prev ? `${prev}\n${text}` : text));
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
              </label>

              {statusLabel ? (
                <span className="capture-status" role="status">
                  {recording ? (
                    <span className="live-dot" aria-hidden />
                  ) : null}
                  {statusLabel}
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
                <span className="meta">
                  {usage.used} / {usage.limit}
                </span>
              </span>
              <button
                type="submit"
                className="primary-btn analyse-btn"
                disabled={
                  busy !== "idle" ||
                  recording ||
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
            <button
              type="button"
              className="ghost-btn mt-3"
              onClick={() => {
                setResult(null);
                setSuggestions([]);
              }}
            >
              New capture
            </button>
          </div>

          <div className="capture-review-suggestions">
            <div className="capture-review-suggestions-head">
              <h3>Suggested additions</h3>
              <div className="row-actions">
                <button type="button" className="primary-btn" onClick={acceptAll}>
                  Accept All
                </button>
                <button type="button" className="ghost-btn" onClick={dismissAll}>
                  Dismiss All
                </button>
              </div>
            </div>

            {visibleSuggestions.length === 0 ? (
              <p className="empty-copy">No pending suggestions.</p>
            ) : (
              <ul className="suggestion-list">
                {visibleSuggestions.map((item) => (
                  <li
                    key={item.id}
                    className={`suggestion-card ${added[item.id] ? "is-added" : ""}`}
                  >
                    <div className="suggestion-top">
                      <span className="tag">{KIND_LABEL[item.kind]}</span>
                      <span className="meta">
                        {projectCode(state.projects, item.projectId)}
                        {item.date ? ` · ${item.date}` : ""}
                      </span>
                    </div>
                    {editing[item.id] !== undefined ? (
                      <textarea
                        value={editing[item.id]}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        className="capture-textarea compact"
                      />
                    ) : (
                      <p className="suggestion-content">{item.content}</p>
                    )}
                    <p className="meta">→ {item.destination}</p>
                    <div className="row-actions">
                      {added[item.id] ? (
                        <span className="accepted">Accepted</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() =>
                              setEditing((prev) =>
                                prev[item.id] !== undefined
                                  ? (() => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    })()
                                  : { ...prev, [item.id]: item.content },
                              )
                            }
                          >
                            {editing[item.id] !== undefined ? "Done" : "Edit"}
                          </button>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => applyOne(item)}
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
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
              onClick={() => void analyse(content, "conversation")}
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

      <div ref={liveRef} className="sr-only" aria-live="polite">
        {statusMessage}
      </div>
    </section>
  );
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};
