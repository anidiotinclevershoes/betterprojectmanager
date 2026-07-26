"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Panel } from "@/components/DashboardChrome";
import { RecommendationItem } from "@/components/RecommendationItem";
import { useMission } from "@/lib/store";
import type { CaptureResult } from "@/lib/types";

type CaptureBarProps = {
  defaultProjectId?: string;
  compact?: boolean;
};

export function CaptureBar({
  defaultProjectId,
  compact = false,
}: CaptureBarProps) {
  const {
    state,
    captureWithAI,
    setRecommendationStatus,
    openaiConfigured,
    openaiDiagnostics,
  } = useMission();

  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(
    () => defaultProjectId ?? "",
  );
  const effectiveProjectId = projectId || defaultProjectId || "";
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<"idle" | "transcribing" | "coaching">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
    };
  }, []);

  async function submitText(
    raw: string,
    sourceType: "conversation" | "voice_note",
  ) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy("coaching");
    setError(null);
    try {
      const next = await captureWithAI({
        content: trimmed,
        projectId: effectiveProjectId || undefined,
        sourceType,
      });
      setResult(next);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy("idle");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitText(content, "conversation");
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
    } catch {
      setError(
        "Microphone permission denied. Allow mic access or type your note instead.",
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function finishRecording(mimeType: string) {
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
      await submitText(data.text, "voice_note");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice capture failed");
      setBusy("idle");
    }
  }

  const statusLabel =
    busy === "transcribing"
      ? "Transcribing with Whisper…"
      : busy === "coaching"
        ? openaiConfigured
          ? "Tidying with ChatGPT and updating your brief…"
          : "Updating your brief…"
        : recording
          ? `Recording… ${seconds}s`
          : null;

  return (
    <Panel
      title="Quick capture"
      action={
        <span className="text-[11px] text-ink-soft">
          {openaiConfigured
            ? `OpenAI connected${openaiDiagnostics?.keyLength ? ` · key ${openaiDiagnostics.keyLength} chars` : ""}`
            : openaiConfigured === false
              ? "Local mode — add OPENAI_API_KEY"
              : "Checking AI…"}
        </span>
      }
      className={compact ? "mb-2" : "mb-4"}
    >
      <form onSubmit={onSubmit} className={compact ? "space-y-2" : "space-y-3"}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={compact ? 2 : 4}
          disabled={busy !== "idle" || recording}
          placeholder="Type or voice-capture — AI tidies and updates your widgets…"
          className={`w-full resize-y rounded-md border border-line bg-canvas/50 px-2.5 leading-relaxed outline-none ring-teal/30 placeholder:text-ink-soft/55 focus:ring-2 disabled:opacity-60 ${compact ? "py-1.5 text-xs" : "py-2.5 text-sm"}`}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={effectiveProjectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={busy !== "idle"}
            className={`rounded-md border border-line bg-paper outline-none focus:ring-2 focus:ring-teal/30 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
          >
            <option value="">All / unlinked</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={busy !== "idle" || recording || !content.trim()}
            className={`rounded-md bg-ink font-medium text-paper disabled:opacity-50 ${compact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`}
          >
            Capture
          </button>

          {!recording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={busy !== "idle"}
              className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-paper font-medium text-ink hover:bg-mist disabled:opacity-50 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
            >
              <MicIcon />
              Voice
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className={`inline-flex items-center gap-1.5 rounded-md bg-signal font-medium text-paper ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-paper" />
              Stop · {seconds}s
            </button>
          )}

          {statusLabel ? (
            <span className="text-xs text-teal">{statusLabel}</span>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="mt-3 rounded-lg bg-signal-soft px-3 py-2 text-sm text-signal">
          {error}
        </p>
      ) : null}

      {openaiConfigured === false ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          {openaiDiagnostics?.reason ? (
            <>
              {openaiDiagnostics.reason}.{" "}
            </>
          ) : null}
          Add your OpenAI API key to{" "}
          <code className="rounded bg-mist px-1">.env.local</code> as{" "}
          <code className="rounded bg-mist px-1">OPENAI_API_KEY=sk-...</code>{" "}
          (no quotes), then restart{" "}
          <code className="rounded bg-mist px-1">npm run dev</code>. Get a key
          at{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-teal underline-offset-2 hover:underline"
          >
            platform.openai.com/api-keys
          </a>
          .
        </p>
      ) : null}

      {error?.includes("401") || error?.toLowerCase().includes("incorrect api key") ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          OpenAI rejected the key. Recreate a fresh secret key, paste it with no
          quotes into <code className="rounded bg-mist px-1">.env.local</code>,
          fully stop the server (<code className="rounded bg-mist px-1">Ctrl+C</code>),
          then run <code className="rounded bg-mist px-1">npm run dev</code> again.
          A valid key is usually 50+ characters.
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
            <span className="rounded bg-teal-soft px-1.5 py-0.5 text-teal">
              {result.tidied ? "Tidied" : "Captured"}
            </span>
            <span>{result.provider === "openai" ? "OpenAI" : "Local"}</span>
          </div>
          <h3 className="brand-mark mt-2 text-lg font-bold">
            {result.memory.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {result.memory.content}
          </p>
          {result.rawContent &&
          result.rawContent.trim() !== result.memory.content.trim() ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-ink-soft">
                Show original ramble
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                {result.rawContent}
              </p>
            </details>
          ) : null}
          {result.insights.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {result.insights.slice(0, 3).map((insight) => (
                <li key={insight}>• {insight}</li>
              ))}
            </ul>
          ) : null}
          {result.recommendations.map((rec) => (
            <RecommendationItem
              key={rec.id}
              recommendation={rec}
              compact
              onDone={() => setRecommendationStatus(rec.id, "done")}
              onDismiss={() => setRecommendationStatus(rec.id, "dismissed")}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="text-ink"
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
