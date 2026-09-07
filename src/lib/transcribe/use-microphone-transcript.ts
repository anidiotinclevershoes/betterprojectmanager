"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared microphone adapter: audio → /api/transcribe → text.
 * Same production transcribe route Capture uses. Not a second pipeline.
 */
export function useMicrophoneTranscript(opts: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabledRef = useRef(Boolean(opts.disabled));

  useEffect(() => {
    disabledRef.current = Boolean(opts.disabled);
  }, [opts.disabled]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    if (disabledRef.current || busy) return;
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
    } catch {
      setError("Microphone permission denied. Type or paste instead.");
    }
  }

  function stop() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    setActive(false);
  }

  async function finish(mimeType: string) {
    if (disabledRef.current) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("audio", blob, `overview.${extension}`);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text?.trim()) {
        throw new Error(data.error || "Transcription failed");
      }
      if (!disabledRef.current) {
        opts.onTranscript(data.text.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice capture failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (active) stop();
    else void start();
  }

  return { active, busy, error, toggle };
}
