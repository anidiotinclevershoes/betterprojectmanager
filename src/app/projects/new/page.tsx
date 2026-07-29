"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  assembleFromInterview,
  PROJECT_INTERVIEW,
  suggestCode,
  type CreateProjectInput,
  type InterviewAnswers,
} from "@/lib/create-project";
import { useMission } from "@/lib/store";

type Mode = "choose" | "guided" | "interview" | "review";

export default function NewProjectPage() {
  const router = useRouter();
  const { createProject, openaiConfigured } = useMission();

  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CreateProjectInput | null>(null);

  // Guided form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<"delivery" | "release_ops">("delivery");
  const [currentFocus, setCurrentFocus] = useState("");
  const [nextMilestone, setNextMilestone] = useState("");
  const [nextMilestoneAt, setNextMilestoneAt] = useState("");
  const [peopleText, setPeopleText] = useState("");
  const [risksText, setRisksText] = useState("");

  // Interview state
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswers>({});
  const [answerDraft, setAnswerDraft] = useState("");
  const [recording, setRecording] = useState(false);
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

  useEffect(() => {
    if (!codeTouched && name) setCode(suggestCode(name));
  }, [name, codeTouched]);

  const createFromDraft = useCallback(
    (input: CreateProjectInput) => {
      const id = createProject(input);
      router.push(`/projects/${id}`);
    },
    [createProject, router],
  );

  function onGuidedSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give the project a name.");
      return;
    }
    const people = peopleText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [who, ...rest] = line.split("—").map((p) => p.trim());
        const [namePart, rolePart] = (who ?? "")
          .split(",")
          .map((p) => p.trim());
        return {
          name: namePart || who || line,
          role: rolePart || "Stakeholder",
          concerns: rest.length ? [rest.join(" — ")] : undefined,
        };
      });

    const risks = risksText
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    createFromDraft({
      name,
      code: code || suggestCode(name),
      summary,
      kind,
      currentFocus,
      nextMilestone: nextMilestone || undefined,
      nextMilestoneAt: nextMilestoneAt || undefined,
      stakeholders: people,
      knowledgeRisks: risks,
      knowledgeOpenLoops: risks.filter((r) =>
        /wait|confirm|unsigned|chase|unconfirmed/i.test(r),
      ),
    });
  }

  async function finishInterview() {
    const q = PROJECT_INTERVIEW[step];
    const merged = {
      ...answers,
      ...(q && answerDraft.trim() ? { [q.id]: answerDraft.trim() } : {}),
    };
    setAnswers(merged);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/new-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: merged, kind }),
      });
      const data = (await response.json()) as {
        draft?: CreateProjectInput;
        error?: string;
      };
      if (!response.ok || !data.draft) {
        throw new Error(data.error || "Could not build project draft");
      }
      setDraft(data.draft);
      setMode("review");
    } catch {
      // Local fallback never blocks project creation
      setDraft(assembleFromInterview(merged, kind));
      setMode("review");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
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
        "Microphone permission denied. Type the answer instead, or allow mic access.",
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
    setBusy(true);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const form = new FormData();
      form.append(
        "audio",
        blob,
        mimeType.includes("mp4") ? "answer.mp4" : "answer.webm",
      );
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (!response.ok || !data.text) {
        throw new Error(data.error || "Transcription failed");
      }
      setAnswerDraft((prev) =>
        prev.trim() ? `${prev.trim()} ${data.text!.trim()}` : data.text!.trim(),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="new-project">
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          New project
        </h1>
        <p className="text-xs text-[var(--text-secondary)] md:text-sm">
          Guided setup for experienced PMs, or talk it through — Lume proposes a
          draft and nothing is saved until you confirm.
        </p>
      </div>

      {error ? <p className="new-project-error">{error}</p> : null}

      {mode === "choose" ? (
        <div className="new-project-modes">
          <button
            type="button"
            className="new-project-mode"
            onClick={() => setMode("guided")}
          >
            <span className="eyebrow">Quick</span>
            <h2>Guided setup</h2>
            <p>
              A short form with tips on what to capture — name, focus, people,
              risks.
            </p>
          </button>
          <button
            type="button"
            className="new-project-mode featured"
            onClick={() => {
              setMode("interview");
              setStep(0);
              setAnswerDraft(answers[PROJECT_INTERVIEW[0]!.id] ?? "");
            }}
          >
            <span className="eyebrow">Best with voice</span>
            <h2>Interview wizard</h2>
            <p>
              Six high-value questions. Answer by typing or voice — then review
              and create.
            </p>
            <p className="meta">
              {openaiConfigured
                ? "OpenAI will tidy answers into a clean draft"
                : "Works offline with local parsing too"}
            </p>
          </button>
        </div>
      ) : null}

      {mode === "guided" ? (
        <form className="new-project-panel" onSubmit={onGuidedSubmit}>
          <Tip>
            Tip: You can leave fields blank and fill them later from Capture or
            Coach — but name + current focus unlock useful suggestions.
          </Tip>

          <label className="field">
            <span>Project name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Portal Rebrand"
              required
            />
          </label>

          <div className="new-project-row">
            <label className="field">
              <span>Tab code</span>
              <input
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value.toUpperCase());
                }}
                placeholder="PORTAL"
                maxLength={12}
              />
            </label>
            <label className="field">
              <span>Kind</span>
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "delivery" | "release_ops")
                }
              >
                <option value="delivery">Delivery / change</option>
                <option value="release_ops">Release ops (monthly train)</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>What is this trying to achieve?</span>
            <textarea
              className="todo-edit-area"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Outcome in plain language — not a task list"
            />
          </label>

          <label className="field">
            <span>Current focus (this week)</span>
            <input
              value={currentFocus}
              onChange={(e) => setCurrentFocus(e.target.value)}
              placeholder="e.g. Re-baseline scope after vendor delay"
            />
          </label>

          <div className="new-project-row">
            <label className="field">
              <span>Next visible milestone</span>
              <input
                value={nextMilestone}
                onChange={(e) => setNextMilestone(e.target.value)}
                placeholder="e.g. Roadmap Review with sponsors"
              />
            </label>
            <label className="field">
              <span>Milestone date</span>
              <input
                type="date"
                value={nextMilestoneAt}
                onChange={(e) => setNextMilestoneAt(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Key people (one per line)</span>
            <textarea
              className="todo-edit-area"
              rows={3}
              value={peopleText}
              onChange={(e) => setPeopleText(e.target.value)}
              placeholder={
                "Priya Shah, Finance Sponsor — wants written briefs\nElena Rostova, Dev Lead — respond with evidence"
              }
            />
          </label>

          <label className="field">
            <span>Risks / open loops (one per line)</span>
            <textarea
              className="todo-edit-area"
              rows={3}
              value={risksText}
              onChange={(e) => setRisksText(e.target.value)}
              placeholder={"Hypercare roster unconfirmed\nSSO vendor delay on critical path"}
            />
          </label>

          <RememberList />

          <div className="new-project-actions">
            <button
              type="button"
              className="muted-btn"
              onClick={() => setMode("choose")}
            >
              Back
            </button>
            <button type="submit" className="primary-btn">
              Create project
            </button>
          </div>
        </form>
      ) : null}

      {mode === "interview" ? (
        <div className="new-project-panel">
          <div className="new-project-progress">
            <span>
              Question {step + 1} of {PROJECT_INTERVIEW.length}
            </span>
            <div className="bar">
              <i
                style={{
                  width: `${((step + 1) / PROJECT_INTERVIEW.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <label className="field mb-2">
            <span>Project kind</span>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "delivery" | "release_ops")
              }
            >
              <option value="delivery">Delivery / change</option>
              <option value="release_ops">Release ops (monthly train)</option>
            </select>
          </label>

          {PROJECT_INTERVIEW[step] ? (
            <>
              <h2 className="new-project-question">
                {PROJECT_INTERVIEW[step]!.prompt}
              </h2>
              <p className="new-project-tip">{PROJECT_INTERVIEW[step]!.tip}</p>
              <p className="new-project-voice-hint">
                Voice tip: {PROJECT_INTERVIEW[step]!.voiceHint}
              </p>

              <textarea
                className="todo-edit-area"
                rows={5}
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder="Type here, or use voice…"
              />

              <div className="new-project-voice-row">
                {!recording ? (
                  <button
                    type="button"
                    className="muted-btn"
                    disabled={busy}
                    onClick={() => void startRecording()}
                  >
                    Record voice answer
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={stopRecording}
                  >
                    Stop · {seconds}s
                  </button>
                )}
                {busy ? (
                  <span className="meta">Working…</span>
                ) : (
                  <span className="meta">
                    Answers stay in this wizard until you create the project.
                  </span>
                )}
              </div>
            </>
          ) : null}

          <div className="new-project-actions">
            <button
              type="button"
              className="muted-btn"
              onClick={() => {
                if (step === 0) {
                  setMode("choose");
                  return;
                }
                const currentId = PROJECT_INTERVIEW[step]!.id;
                const prevStep = step - 1;
                const prevId = PROJECT_INTERVIEW[prevStep]!.id;
                setAnswers((prev) => ({
                  ...prev,
                  [currentId]: answerDraft.trim(),
                }));
                setStep(prevStep);
                setAnswerDraft(answers[prevId] ?? "");
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="muted-btn"
              disabled={busy}
              onClick={() => {
                const currentId = PROJECT_INTERVIEW[step]!.id;
                if (step >= PROJECT_INTERVIEW.length - 1) {
                  setAnswers((prev) => ({ ...prev, [currentId]: "" }));
                  setAnswerDraft("");
                  void finishInterview();
                  return;
                }
                const nextStep = step + 1;
                const nextId = PROJECT_INTERVIEW[nextStep]!.id;
                setAnswers((prev) => ({ ...prev, [currentId]: "" }));
                setStep(nextStep);
                setAnswerDraft(answers[nextId] ?? "");
              }}
            >
              Skip
            </button>
            {step < PROJECT_INTERVIEW.length - 1 ? (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const currentId = PROJECT_INTERVIEW[step]!.id;
                  const nextStep = step + 1;
                  const nextId = PROJECT_INTERVIEW[nextStep]!.id;
                  const saved = answerDraft.trim();
                  setAnswers((prev) => ({ ...prev, [currentId]: saved }));
                  setStep(nextStep);
                  setAnswerDraft(answers[nextId] ?? "");
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={() => void finishInterview()}
              >
                {busy ? "Building draft…" : "Build draft"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {mode === "review" && draft ? (
        <div className="new-project-panel">
          <Tip>
            Review the draft, tweak anything that’s off, then create. You can
            always enrich later with Capture.
          </Tip>

          <label className="field">
            <span>Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="new-project-row">
            <label className="field">
              <span>Code</span>
              <input
                value={draft.code}
                onChange={(e) =>
                  setDraft({ ...draft, code: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label className="field">
              <span>Kind</span>
              <select
                value={draft.kind ?? "delivery"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    kind: e.target.value as "delivery" | "release_ops",
                  })
                }
              >
                <option value="delivery">Delivery / change</option>
                <option value="release_ops">Release ops</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Summary</span>
            <textarea
              className="todo-edit-area"
              rows={2}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Current focus</span>
            <input
              value={draft.currentFocus}
              onChange={(e) =>
                setDraft({ ...draft, currentFocus: e.target.value })
              }
            />
          </label>
          <div className="new-project-row">
            <label className="field">
              <span>Next milestone</span>
              <input
                value={draft.nextMilestone ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, nextMilestone: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={(draft.nextMilestoneAt ?? "").slice(0, 10)}
                onChange={(e) =>
                  setDraft({ ...draft, nextMilestoneAt: e.target.value })
                }
              />
            </label>
          </div>

          {(draft.stakeholders?.length || draft.knowledgeRisks?.length) && (
            <div className="new-project-summary-cards">
              {draft.stakeholders?.length ? (
                <div>
                  <h3>People</h3>
                  <ul>
                    {draft.stakeholders.map((s) => (
                      <li key={s.name}>
                        {s.name}
                        {s.role ? ` · ${s.role}` : ""}
                        {s.concerns?.[0] ? ` — ${s.concerns[0]}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {draft.knowledgeRisks?.length ? (
                <div>
                  <h3>Risks / loops</h3>
                  <ul>
                    {draft.knowledgeRisks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <div className="new-project-actions">
            <button
              type="button"
              className="muted-btn"
              onClick={() => {
                setMode("interview");
                setStep(PROJECT_INTERVIEW.length - 1);
                setAnswerDraft(
                  answers[PROJECT_INTERVIEW[PROJECT_INTERVIEW.length - 1]!.id] ??
                    "",
                );
              }}
            >
              Back to interview
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => createFromDraft(draft)}
            >
              Create project
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="new-project-callout">{children}</p>;
}

function RememberList() {
  return (
    <aside className="new-project-remember">
      <h3>Worth remembering</h3>
      <ul>
        <li>Who can make or break this, and what they care about</li>
        <li>The next visible win — not just “keep going”</li>
        <li>Risks that would embarrass you if a sponsor asked tomorrow</li>
        <li>Open waits / unconfirmed assumptions</li>
      </ul>
    </aside>
  );
}
