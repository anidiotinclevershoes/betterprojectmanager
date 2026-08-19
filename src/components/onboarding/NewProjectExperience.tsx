"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LumeLogo } from "@/components/brand/LumeLogo";
import { ProjectSetupReview } from "@/components/onboarding/ProjectSetupReview";
import {
  assembleFromNarrative,
  suggestCode,
  TALK_EXAMPLE,
  TALK_GUIDANCE_TOPICS,
  type CreateProjectInput,
} from "@/lib/create-project";
import { useMission } from "@/lib/store";

type Path = "choose" | "talk" | "blank" | "review";

export function NewProjectExperience({
  variant = "page",
}: {
  /** first-run = zero projects; page = /projects/new */
  variant?: "first-run" | "page";
}) {
  const router = useRouter();
  const { createProject, openaiConfigured } = useMission();
  const [path, setPath] = useState<Path>("choose");
  const [draft, setDraft] = useState<CreateProjectInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const buildAbortRef = useRef<AbortController | null>(null);

  const createFromDraft = useCallback(
    async (input: CreateProjectInput) => {
      setBusy(true);
      setError(null);
      try {
        const id = await createProject(input);
        setSuccess(`${input.name.trim() || input.code} is ready.`);
        router.push(`/projects/${id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not create the project. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [createProject, router],
  );

  async function analyseNarrative(
    content: string,
    sourceMode: "talk" | "paste",
  ) {
    setBusy(true);
    setError(null);
    buildAbortRef.current?.abort();
    const controller = new AbortController();
    buildAbortRef.current = controller;
    try {
      const local = assembleFromNarrative(content, "delivery", sourceMode);
      const res = await fetch("/api/new-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ content, sourceMode, kind: "delivery" }),
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const fail = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        setDraft(local);
        setPath("review");
        setError(
          fail?.error ||
            "Could not use AI for this build. Showing a local draft instead — review carefully before creating.",
        );
        return;
      }
      const data = (await res.json()) as {
        draft?: CreateProjectInput;
        note?: string;
        provider?: string;
      };
      setDraft(data.draft ?? local);
      setPath("review");
      if (data.note) {
        setError(data.note);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError(null);
        return;
      }
      setDraft(assembleFromNarrative(content, "delivery", sourceMode));
      setPath("review");
      setError(
        "Build request failed. Showing a local draft instead — review carefully before creating.",
      );
    } finally {
      if (buildAbortRef.current === controller) {
        buildAbortRef.current = null;
      }
      setBusy(false);
    }
  }

  function cancelBuild() {
    buildAbortRef.current?.abort();
    buildAbortRef.current = null;
    setBusy(false);
  }

  return (
    <div
      className={`np-experience ${variant === "first-run" ? "is-first-run" : ""}`}
    >
      {path === "choose" ? (
        <ChoosePaths
          variant={variant}
          onTalk={() => setPath("talk")}
          onBlank={() => setPath("blank")}
        />
      ) : null}

      {path === "talk" ? (
        <TalkPath
          busy={busy}
          openaiConfigured={openaiConfigured}
          onBack={() => setPath("choose")}
          onBuild={(transcript) => void analyseNarrative(transcript, "talk")}
          onCancelBuild={cancelBuild}
        />
      ) : null}

      {path === "blank" ? (
        <BlankPath
          busy={busy}
          error={error}
          onBack={() => setPath("choose")}
          onCreate={(input) => {
            if (!input.name.trim()) {
              setError("Give the project a name.");
              return;
            }
            void createFromDraft({
              ...input,
              sourceMode: "blank",
            });
          }}
        />
      ) : null}

      {path === "review" && draft ? (
        <ProjectSetupReview
          draft={draft}
          onChange={setDraft}
          busy={busy}
          error={error}
          onBack={() => setPath("talk")}
          onConfirm={() => {
            void createFromDraft(draft);
          }}
        />
      ) : null}

      {success ? (
        <div className="np-success-block" role="status">
          <p className="np-success">
            {success} Lume has created your starting project from what you
            provided.
          </p>
          <p className="np-tell-me-nudge">
            Lume has started learning your project. Try asking Tell Me: “What
            are the biggest risks I mentioned?”
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ChoosePaths({
  variant,
  onTalk,
  onBlank,
}: {
  variant: "first-run" | "page";
  onTalk: () => void;
  onBlank: () => void;
}) {
  return (
    <div className="np-choose">
      <header className="np-hero">
        <LumeLogo size={variant === "first-run" ? 72 : 56} className="np-hero-logo" />
        <p className="np-brand">LUME</p>
        <h1 className="np-hero-title">Project Intelligence</h1>
        <p className="np-hero-lead">
          Give Lume what you know about your project.
          <br />
          We&apos;ll organise the work, risks, people, dates and knowledge —
          then let you review everything before anything is created.
        </p>
      </header>

      <div className="np-trust" role="note">
        <p>
          <strong>Nothing will be added until you review it.</strong>
        </p>
        <p className="meta">
          You&apos;ll be able to edit, remove or add anything before confirming
          your project.
        </p>
      </div>

      <div className="np-path-grid np-path-grid-two">
        <article className="np-path-card is-recommended">
          <span className="np-recommended-badge">Recommended</span>
          <h2>Talk It Through</h2>
          <p>
            Tell Lume about the project in your own words. Talk through what
            you&apos;re delivering, who&apos;s involved, what you&apos;re
            worried about and anything else you know.
          </p>
          <p className="meta">Lume will structure it for you.</p>
          <button type="button" className="primary-btn" onClick={onTalk}>
            Talk it through
          </button>
        </article>

        <article className="np-path-card is-quiet">
          <h2>Start Blank</h2>
          <p>
            Prefer to build it yourself? Create an empty project and add things
            as you go.
          </p>
          <button type="button" className="ghost-btn" onClick={onBlank}>
            Start blank
          </button>
        </article>
      </div>
    </div>
  );
}

function TalkPath({
  busy,
  openaiConfigured,
  onBack,
  onBuild,
  onCancelBuild,
}: {
  busy: boolean;
  openaiConfigured: boolean | null;
  onBack: () => void;
  onBuild: (transcript: string) => void;
  onCancelBuild: () => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [exampleOpen, setExampleOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);
  const tipId = useId();

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  function startTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(
      () => setSeconds((s) => s + 1),
      1000,
    );
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setPaused(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      startTimer();

      type SpeechRecResult = { isFinal: boolean; 0?: { transcript: string } };
      type SpeechRecEvent = {
        resultIndex: number;
        results: ArrayLike<SpeechRecResult>;
      };
      type SpeechRecInstance = {
        continuous: boolean;
        interimResults: boolean;
        onresult: ((event: SpeechRecEvent) => void) | null;
        start: () => void;
        stop: () => void;
      };
      const w = window as Window & {
        SpeechRecognition?: new () => SpeechRecInstance;
        webkitSpeechRecognition?: new () => SpeechRecInstance;
      };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let finalText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result?.[0] && result.isFinal) {
              finalText += `${result[0].transcript} `;
            }
          }
          if (finalText.trim()) {
            setTranscript((prev) =>
              `${prev} ${finalText}`.replace(/\s+/g, " ").trim(),
            );
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch {
      setRecording(false);
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    recognitionRef.current?.stop();
    stopTimer();
    setPaused(true);
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    recognitionRef.current?.start();
    startTimer();
    setPaused(false);
  }

  async function stopRecording() {
    stopTimer();
    setPaused(false);
    setRecording(false);
    recognitionRef.current?.stop();
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    if (transcript.trim()) return;

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    if (!blob.size) return;
    try {
      const form = new FormData();
      form.append("audio", blob, "onboarding.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text?.trim()) setTranscript(data.text.trim());
    } catch {
      /* keep empty — user can type */
    }
  }

  function formatTime(total: number) {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="np-talk">
      <button type="button" className="ghost-btn np-back" onClick={onBack}>
        ← Pathways
      </button>
      <header className="np-panel-head">
        <h2>Tell Lume about your project</h2>
        <p className="np-panel-lead">
          The more context you give, the better Lume can understand how your
          project works.
        </p>
      </header>

      <div className="np-trust is-inline" role="note">
        Nothing will be added until you review it.
      </div>

      <div className="np-talk-layout">
        <div className="np-talk-main">
          <div className="np-record-panel">
            <div className="np-record-status" aria-live="polite">
              {recording
                ? paused
                  ? `Paused · ${formatTime(seconds)}`
                  : `Recording · ${formatTime(seconds)}`
                : "Ready when you are"}
            </div>
            <div className="np-record-actions">
              {!recording ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void startRecording()}
                >
                  Start Recording
                </button>
              ) : (
                <>
                  {paused ? (
                    <button
                      type="button"
                      className="muted-btn"
                      onClick={resumeRecording}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="muted-btn"
                      onClick={pauseRecording}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void stopRecording()}
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
            <p className="np-reassure meta">
              Don&apos;t worry about making it perfect. You can ramble, change
              your mind or remember things out of order. You&apos;ll review
              everything Lume extracts before creating the project.
            </p>
          </div>

          <label className="field np-transcript-field">
            Transcript
            <textarea
              rows={10}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your conversation will appear here. You can also type or edit before building."
            />
          </label>

          <div className="np-talk-footer">
            <p className="meta">
              {openaiConfigured === false
                ? "Local extraction — OpenAI key not configured."
                : "Lume will organise what you shared into a reviewable project."}
            </p>
            {busy ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={onCancelBuild}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="primary-btn"
                disabled={!transcript.trim()}
                onClick={() => onBuild(transcript.trim())}
              >
                Build My Project
              </button>
            )}
            <span className="ai-use-hint">Uses AI when configured</span>
          </div>
        </div>

        <aside className="np-talk-side">
          <div className="np-guidance">
            <h3>What should I talk about?</h3>
            <p className="meta">
              Talk naturally — you don&apos;t need to cover everything. The more
              useful context you give Lume, the better it can build and remember
              your project.
            </p>
            <ul className="np-guidance-list">
              {TALK_GUIDANCE_TOPICS.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>

          <div className="np-knowledge-callout">
            <h3>What should Lume remember?</h3>
            <p>
              Knowledge is the useful project context that doesn&apos;t fit
              neatly into a task, risk or date.
            </p>
            <ul>
              <li>CAB needs the pack 48 hours before the meeting</li>
              <li>Sarah only signs releases off on Thursdays</li>
              <li>The platform team normally needs five days&apos; notice</li>
              <li>
                The customer wants residual risks included in every release
                brief
              </li>
            </ul>
            <p className="meta">
              The more of this context you share, the more useful Lume becomes
              later.
            </p>
          </div>

          <div className="np-example">
            <button
              type="button"
              className="np-example-toggle"
              aria-expanded={exampleOpen}
              aria-controls={tipId}
              onClick={() => setExampleOpen((v) => !v)}
            >
              Show me an example
            </button>
            {exampleOpen ? (
              <blockquote id={tipId} className="np-example-body">
                {TALK_EXAMPLE}
              </blockquote>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function BlankPath({
  busy,
  error,
  onBack,
  onCreate,
}: {
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: (input: CreateProjectInput) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  useEffect(() => {
    if (!codeTouched && name) setCode(suggestCode(name));
  }, [name, codeTouched]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onCreate({
      name,
      code: code || suggestCode(name),
      summary: "",
      currentFocus: "",
      sourceMode: "blank",
    });
  }

  return (
    <div className="np-blank">
      <button type="button" className="ghost-btn np-back" onClick={onBack}>
        ← Pathways
      </button>
      <header className="np-panel-head">
        <h2>Start blank</h2>
        <p className="np-panel-lead">
          Just a name — you can add everything else once you&apos;re in the
          workspace.
        </p>
      </header>
      <form className="np-blank-form" onSubmit={onSubmit}>
        <label className="field">
          Project name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Horizon Customer Portal"
            autoFocus
          />
        </label>
        <label className="field">
          Project code
          <input
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value.toUpperCase().slice(0, 12));
            }}
            placeholder="HORIZON"
          />
        </label>
        {error ? <p className="error-copy">{error}</p> : null}
        <div className="np-talk-footer">
          <button type="button" className="ghost-btn" onClick={onBack}>
            Back
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={busy || !name.trim()}
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

