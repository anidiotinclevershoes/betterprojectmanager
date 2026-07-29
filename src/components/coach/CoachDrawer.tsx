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

export function CoachDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { state, addTodo, addSuggestion, addKnowledgeBullet } = useMission();
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1] ?? null;
  const projectId = routeId && routeId !== "new" ? routeId : null;
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;

  const [scope, setScope] = useState<"overview" | "project">(
    projectId ? "project" : "overview",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);
  const [accepted, setAccepted] = useState<AcceptedMap>({});
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerReturnFocus = useRef<Element | null>(null);

  useEffect(() => {
    setScope(projectId ? "project" : "overview");
  }, [projectId]);

  useEffect(() => {
    if (open) {
      triggerReturnFocus.current = document.activeElement;
      window.setTimeout(() => closeRef.current?.focus(), 50);
    } else if (triggerReturnFocus.current instanceof HTMLElement) {
      triggerReturnFocus.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

    const effectiveScope =
      scope === "project" && projectId
        ? { mode: "project" as const, projectId }
        : { mode: "overview" as const };

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scope: effectiveScope,
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
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, scope, state]);

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
      scope === "project" ? projectId : null,
      action.projectCode,
    );
    if (mode === "todo") {
      addTodo({
        title: action.title,
        detail: action.text !== action.title ? action.text : undefined,
        projectId: resolvedProjectId,
      });
      setAccepted((prev) => ({ ...prev, [action.id]: "Added to To Do" }));
      return;
    }
    if (mode === "suggestion") {
      if (!resolvedProjectId) {
        setError("Pick a project scope, or include a project code.");
        return;
      }
      addSuggestion({
        projectId: resolvedProjectId,
        title: action.title,
        action: action.text,
        why: "Accepted from Coach.",
        kind: action.section === "risk" ? "risk" : "leadership",
      });
      setAccepted((prev) => ({ ...prev, [action.id]: "Added to Suggestions" }));
      return;
    }
    if (!resolvedProjectId) {
      setError("Pick a project scope to add into Knowledge.");
      return;
    }
    addKnowledgeBullet(
      resolvedProjectId,
      action.section === "risk" ? "risks" : "openLoops",
      action.title,
    );
    setAccepted((prev) => ({ ...prev, [action.id]: "Added to Knowledge" }));
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          className="coach-drawer-backdrop"
          aria-label="Close coach"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`coach-drawer ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        aria-label="Coach"
        role="dialog"
        aria-modal={open}
      >
        <header className="coach-drawer-header">
          <div>
            <p className="eyebrow">Coach</p>
            <h2>{busy && !markdown ? "Reviewing…" : title || "Ready when you are"}</h2>
            <p className="meta">
              {provider
                ? provider === "openai"
                  ? "OpenAI"
                  : "Local"
                : "Does not run until you ask"}
              {lastRunAt
                ? ` · last run ${new Date(lastRunAt).toISOString().slice(0, 16).replace("T", " ")}`
                : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close coach"
          >
            ×
          </button>
        </header>

        <div className="coach-drawer-controls">
          <label className="field mb-0">
            <span>Scope</span>
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "overview" | "project")
              }
            >
              <option value="overview">All projects</option>
              <option value="project" disabled={!projectId}>
                {project ? `Current · ${project.code}` : "Current project"}
              </option>
            </select>
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void runCoach()}
          >
            {busy ? "Coaching…" : hasResponse ? "Run again" : "Run coaching"}
          </button>
        </div>

        <div className="coach-drawer-body" ref={bodyRef}>
          {error ? <p className="error-banner">{error}</p> : null}
          {!hasResponse && !busy ? (
            <p className="empty-copy">
              Coach reads what is already in Lume and answers: what
              would an exceptional PM do now? Nothing runs until you click Run
              coaching.
            </p>
          ) : null}
          {busy && !markdown ? (
            <p className="empty-copy">
              Reviewing your projects, tasks, meetings and knowledge…
            </p>
          ) : null}
          {markdown ? <CoachMarkdown markdown={markdown} streaming={busy} /> : null}
        </div>

        {actions.length > 0 ? (
          <div className="coach-drawer-actions">
            <h3>Accept into workspace</h3>
            <ul>
              {actions.slice(0, 8).map((action) => (
                <li key={action.id}>
                  <p>{action.title}</p>
                  {accepted[action.id] ? (
                    <span className="accepted">{accepted[action.id]}</span>
                  ) : (
                    <div className="row-actions">
                      <button type="button" onClick={() => acceptAction(action, "todo")}>
                        To Do
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptAction(action, "suggestion")}
                      >
                        Suggestion
                      </button>
                      <button
                        type="button"
                        className="muted"
                        onClick={() => acceptAction(action, "knowledge")}
                      >
                        Knowledge
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </>
  );
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
      {blocks.map((block, i) => {
        const lines = block.trim().split("\n");
        const heading = lines[0]?.startsWith("##")
          ? lines[0].replace(/^##\s+/, "")
          : null;
        const body = heading ? lines.slice(1).join("\n").trim() : block.trim();
        return (
          <section key={`${i}-${heading ?? "body"}`} className="coach-section">
            {heading ? <h3>{heading}</h3> : null}
            <div className="coach-section-body">
              {body.split("\n").map((line, idx) => {
                const key = `${idx}-${line.slice(0, 20)}`;
                if (!line.trim()) return <br key={key} />;
                if (line.startsWith("> ")) {
                  return (
                    <blockquote key={key}>{line.replace(/^>\s?/, "")}</blockquote>
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
