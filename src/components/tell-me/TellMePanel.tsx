"use client";

import { useEffect, useRef } from "react";
import {
  handoffToCoach,
  useTellMeSession,
} from "@/components/tell-me/TellMeSessionContext";

const CONFIDENCE_LABEL: Record<string, string> = {
  direct_confirmation: "I found direct confirmation",
  related_context: "I found related context, but no explicit confirmation",
  not_found: "I couldn’t find this in Lume",
  inference: "Inferred from related project evidence",
};

export function TellMePanel() {
  const {
    open,
    closeTellMe,
    question,
    setQuestion,
    busy,
    refreshing,
    error,
    answer,
    suggestions,
    personalHint,
    ask,
    refresh,
    clearThread,
    projectId,
    snapshot,
  } = useTellMeSession();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTellMe();
    };
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeTellMe]);

  if (!open) return null;

  return (
    <div className="tell-me-backdrop" onClick={closeTellMe} role="presentation">
      <aside
        className="tell-me-panel"
        role="dialog"
        aria-label="Tell Me"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tell-me-header">
          <div>
            <p className="tell-me-kicker">Tell Me</p>
            <h2>Ask Lume anything about this project.</h2>
            {answer?.scope.projectName || snapshot ? (
              <p className="tell-me-scope">
                {answer?.scope.projectCode ||
                  (projectId ? "Selected project" : "Across your projects")}
                {answer?.scope.projectName
                  ? ` · ${answer.scope.projectName}`
                  : ""}
              </p>
            ) : (
              <p className="tell-me-scope">
                {projectId
                  ? "Answering for the selected project"
                  : "Ask across projects you can access"}
              </p>
            )}
          </div>
          <div className="tell-me-header-actions">
            <button type="button" className="ghost-btn" onClick={clearThread}>
              New
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close Tell Me"
              onClick={closeTellMe}
            >
              ×
            </button>
          </div>
        </header>

        {personalHint ? (
          <p className="tell-me-personal-hint">{personalHint}</p>
        ) : null}

        <form
          className="tell-me-ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="tell-me-question">
            What do you want to know?
          </label>
          <textarea
            id="tell-me-question"
            ref={inputRef}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to know?"
            disabled={busy}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || !question.trim()}
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>

        {error ? <p className="tell-me-error">{error}</p> : null}

        {answer ? (
          <div className="tell-me-answer">
            <p className="tell-me-confidence">
              {CONFIDENCE_LABEL[answer.confidence] ?? answer.confidence}
            </p>
            <div className="tell-me-answer-body">
              {answer.answer.split("\n").map((line, i) => (
                <p key={`${i}-${line.slice(0, 12)}`}>{line || "\u00a0"}</p>
              ))}
            </div>

            {answer.sources.length ? (
              <div className="tell-me-sources">
                <p className="tell-me-sources-label">Based on</p>
                <ul>
                  {answer.sources.map((s) => (
                    <li key={`${s.kind}-${s.id}`}>
                      <span className="tell-me-source-kind">{labelKind(s.kind)}</span>
                      <span>{s.label}</span>
                      {s.projectCode ? (
                        <span className="tell-me-source-project">
                          {s.projectCode}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {answer.refreshRecommended ? (
              <div className="tell-me-freshness is-stale">
                <p>
                  {answer.refreshReason ||
                    "Project information has changed since Lume last refreshed its understanding."}
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={refreshing || !projectId}
                  onClick={() => void refresh()}
                >
                  {refreshing ? "Refreshing…" : "Refresh Lume"}
                </button>
              </div>
            ) : answer.freshness.message ? (
              <p className="tell-me-freshness-note">{answer.freshness.message}</p>
            ) : null}

            <div className="tell-me-follow">
              <button
                type="button"
                className="muted"
                onClick={() => {
                  setQuestion("");
                  inputRef.current?.focus();
                }}
              >
                Ask follow-up
              </button>
              {answer.coachHandoff ? (
                <button
                  type="button"
                  className="muted"
                  onClick={() => {
                    closeTellMe();
                    handoffToCoach();
                  }}
                >
                  Ask Coach
                </button>
              ) : null}
              {answer.capturePrefill ? (
                <button
                  type="button"
                  className="muted"
                  onClick={() => {
                    closeTellMe();
                    window.dispatchEvent(
                      new CustomEvent("lume:prefill-capture", {
                        detail: { content: answer.capturePrefill },
                      }),
                    );
                  }}
                >
                  Capture correction
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="tell-me-suggestions">
            <p className="tell-me-suggestions-label">Suggested for you</p>
            {suggestions.length ? (
              <ul>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestion(s.question);
                        void ask(s.question);
                      }}
                    >
                      {s.question}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tell-me-empty-suggest">
                Lume doesn’t know much about this project yet. Use Capture first —
                then Ask Tell Me.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function labelKind(kind: string) {
  switch (kind) {
    case "knowledge":
      return "Knowledge";
    case "todo":
      return "To Do";
    case "risk":
      return "Risk";
    case "timeline":
      return "Timeline";
    case "history":
      return "History";
    case "meeting":
      return "Meeting";
    case "capture":
      return "Capture";
    case "snapshot":
      return "Snapshot";
    default:
      return kind;
  }
}
