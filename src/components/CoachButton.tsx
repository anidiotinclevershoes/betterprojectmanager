"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  parseCoachActions,
  resolveProjectId,
  type CoachAction,
} from "@/lib/coach-actions";
import { useMission } from "@/lib/store";

type AcceptedMap = Record<string, string>;

export function CoachButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const { state } = useMission();
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;

  return (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
        open
          ? "bg-ink text-paper"
          : "bg-teal text-paper hover:bg-teal/90"
      }`}
      title={
        open
          ? "Collapse coach panel"
          : "Open coach panel (does not run coaching yet)"
      }
      aria-expanded={open}
    >
      Coach{project ? ` · ${project.code}` : ""}
      <span className="ml-1 opacity-80" aria-hidden>
        {open ? "▴" : "▾"}
      </span>
    </button>
  );
}

export function CoachBanner({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { state, addTodo, addSuggestion, addKnowledgeBullet } = useMission();

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);
  const [accepted, setAccepted] = useState<AcceptedMap>({});
  const [lastScopeLabel, setLastScopeLabel] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const actions = useMemo(() => parseCoachActions(markdown), [markdown]);
  const hasResponse = Boolean(markdown.trim());

  const runCoach = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError(null);
    setMarkdown("");
    setTitle("");
    setProvider(null);
    setAccepted({});

    const scope = projectId
      ? { mode: "project" as const, projectId }
      : { mode: "overview" as const };
    setLastScopeLabel(project ? project.code : "All projects");

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scope,
          state: {
            projects: state.projects,
            memories: state.memories.slice(0, 60),
            recommendations: state.recommendations
              .filter((r) => r.status === "active")
              .slice(0, 40),
            meetings: state.meetings,
            releases: state.releases,
            todos: state.todos ?? [],
            knowledge: state.knowledge ?? [],
            timeline: state.timeline ?? [],
          },
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Coach request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as {
              type: string;
              title?: string;
              provider?: "openai" | "local";
              text?: string;
              markdown?: string;
              error?: string;
            };
            if (event.type === "meta") {
              setTitle(event.title || "Coaching");
              setProvider(event.provider ?? null);
            } else if (event.type === "delta" && event.text) {
              setMarkdown((prev) => prev + event.text);
            } else if (event.type === "done" && event.markdown) {
              setMarkdown(event.markdown);
            } else if (event.type === "error") {
              throw new Error(event.error || "Coach failed");
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setBusy(false);
    }
  }, [project, projectId, state]);

  useEffect(() => {
    if (!open || !bodyRef.current || !busy) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [markdown, open, busy]);

  const acceptAction = (
    action: CoachAction,
    mode: "todo" | "suggestion" | "knowledge",
  ) => {
    const resolvedProjectId = resolveProjectId(
      state.projects,
      projectId,
      action.projectCode,
    );

    if (mode === "todo") {
      addTodo({
        title: action.title,
        detail: action.text !== action.title ? action.text : undefined,
        projectId: resolvedProjectId,
      });
      setAccepted((prev) => ({ ...prev, [action.id]: "Added to To do" }));
      return;
    }

    if (mode === "suggestion") {
      if (!resolvedProjectId) {
        setError(
          "Pick a project tab first, or include a project code in the action.",
        );
        return;
      }
      addSuggestion({
        projectId: resolvedProjectId,
        title: action.title,
        action: action.text,
        why: "Accepted from Assistant PM Coach.",
        kind: action.section === "risk" ? "risk" : "leadership",
        urgency: action.section === "do_now" ? "now" : "today",
      });
      setAccepted((prev) => ({ ...prev, [action.id]: "Added to Suggestions" }));
      return;
    }

    if (!resolvedProjectId) {
      setError("Pick a project tab first to add into Knowledge.");
      return;
    }
    const section = action.section === "risk" ? "risks" : "openLoops";
    addKnowledgeBullet(resolvedProjectId, section, action.title);
    setAccepted((prev) => ({
      ...prev,
      [action.id]:
        section === "risks"
          ? "Added to Knowledge · Risks"
          : "Added to Knowledge · Open loops",
    }));
  };

  // Stay mounted when collapsed so the last response is preserved.
  return (
    <section
      className={`coach-banner ${open ? "is-open" : "is-collapsed"}`}
      aria-hidden={!open}
      aria-live="polite"
    >
      <div className="coach-banner-inner">
        <header className="coach-banner-header">
          <div className="min-w-0">
            <p className="eyebrow">Assistant PM Coach</p>
            <h2>
              {busy && !markdown
                ? "Writing…"
                : title || (hasResponse ? "Last coaching" : "Ready when you are")}
            </h2>
            <p className="meta">
              {provider
                ? provider === "openai"
                  ? "OpenAI"
                  : "Local fallback"
                : hasResponse
                  ? "Saved in this session"
                  : "Panel open — coaching not started"}
              {lastScopeLabel
                ? ` · last run: ${lastScopeLabel}`
                : project
                  ? ` · will use ${project.code}`
                  : " · will use Overview"}
              {busy ? " · streaming" : ""}
            </p>
          </div>
          <div className="coach-panel-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void runCoach()}
            >
              {busy
                ? "Coaching…"
                : hasResponse
                  ? "Run again"
                  : "Run coaching"}
            </button>
            <button
              type="button"
              className="muted"
              onClick={() => onOpenChange(false)}
            >
              Collapse
            </button>
          </div>
        </header>

        <div className="coach-banner-grid">
          <div className="coach-banner-stream" ref={bodyRef}>
            {error ? <p className="error">{error}</p> : null}
            {!hasResponse && !busy ? (
              <div className="coach-empty-state">
                <p>
                  Open this panel anytime. Collapse and reopen to keep reading
                  the last coaching — nothing re-runs until you ask.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void runCoach()}
                >
                  Run coaching
                  {project ? ` for ${project.code}` : " for all projects"}
                </button>
              </div>
            ) : null}
            {busy && !markdown ? (
              <p className="empty">
                Evaluating situation, gaps, risks, and what Tom should do next…
              </p>
            ) : null}
            {markdown ? (
              <CoachMarkdown markdown={markdown} streaming={busy} />
            ) : null}
          </div>

          <aside className="coach-banner-actions">
            <header>
              <h3>Accept into Mission Control</h3>
              <p>Add coaching lines into To do, Suggestions, or Knowledge.</p>
            </header>
            {actions.length === 0 ? (
              <p className="empty">
                {busy
                  ? "Actions appear as the coach writes…"
                  : hasResponse
                    ? "No actionable lines parsed from this response."
                    : "Run coaching to generate actions you can accept."}
              </p>
            ) : (
              <ul className="coach-action-list">
                {actions.map((action) => (
                  <li key={action.id} className="coach-action-row">
                    <div className="min-w-0">
                      <p className="kind">{labelForSection(action.section)}</p>
                      <p className="text">{action.title}</p>
                      {accepted[action.id] ? (
                        <p className="accepted">{accepted[action.id]}</p>
                      ) : null}
                    </div>
                    {!accepted[action.id] ? (
                      <div className="btns">
                        {(action.section === "do_now" ||
                          action.section === "checklist") && (
                          <button
                            type="button"
                            onClick={() => acceptAction(action, "todo")}
                          >
                            To do
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => acceptAction(action, "suggestion")}
                        >
                          Suggestions
                        </button>
                        {(action.section === "risk" ||
                          action.section === "do_now") && (
                          <button
                            type="button"
                            className="muted"
                            onClick={() => acceptAction(action, "knowledge")}
                          >
                            Knowledge
                          </button>
                        )}
                        {action.section === "script" ? (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(action.text);
                              setAccepted((prev) => ({
                                ...prev,
                                [action.id]: "Copied script",
                              }));
                            }}
                          >
                            Copy
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function labelForSection(section: CoachAction["section"]) {
  switch (section) {
    case "do_now":
      return "Do now";
    case "risk":
      return "Risk / gap";
    case "script":
      return "Script";
    case "checklist":
      return "Checklist";
  }
}

function CoachMarkdown({
  markdown,
  streaming,
}: {
  markdown: string;
  streaming?: boolean;
}) {
  const blocks = markdown.split(/\n(?=##\s+)/);

  return (
    <div className={`coach-markdown ${streaming ? "is-streaming" : ""}`}>
      {blocks.map((block, blockIdx) => {
        const lines = block.trim().split("\n");
        const heading = lines[0]?.startsWith("##")
          ? lines[0].replace(/^##\s+/, "")
          : null;
        const body = heading ? lines.slice(1).join("\n").trim() : block.trim();
        return (
          <section
            key={`${blockIdx}-${heading ?? "body"}`}
            className="coach-section"
          >
            {heading ? <h3>{heading}</h3> : null}
            <div className="coach-section-body">
              {body.split("\n").map((line, idx) => {
                const key = `${idx}-${line.slice(0, 24)}`;
                if (!line.trim()) return <br key={key} />;
                if (line.startsWith("> ")) {
                  return (
                    <blockquote key={key}>
                      {line.replace(/^>\s?/, "")}
                    </blockquote>
                  );
                }
                if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
                  return (
                    <p key={key} className="list-line">
                      {line}
                    </p>
                  );
                }
                return <p key={key}>{line}</p>;
              })}
            </div>
          </section>
        );
      })}
      {streaming ? <span className="coach-cursor" aria-hidden /> : null}
    </div>
  );
}
