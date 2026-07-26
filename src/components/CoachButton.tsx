"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useMission } from "@/lib/store";

export function CoachButton() {
  const pathname = usePathname();
  const { state, openaiConfigured } = useMission();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const project = projectId
    ? state.projects.find((p) => p.id === projectId)
    : null;

  const label = project
    ? `Coach me · ${project.code}`
    : "Coach me · all projects";

  const runCoach = useCallback(async () => {
    setOpen(true);
    setBusy(true);
    setError(null);
    const scope = projectId
      ? { mode: "project" as const, projectId }
      : { mode: "overview" as const };

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const data = (await response.json()) as {
        title?: string;
        markdown?: string;
        provider?: "openai" | "local";
        error?: string;
      };
      if (!response.ok || !data.markdown) {
        throw new Error(data.error || "Coach request failed");
      }
      setTitle(data.title || "Coaching");
      setMarkdown(data.markdown);
      setProvider(data.provider ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, state]);

  return (
    <>
      <button
        type="button"
        onClick={() => void runCoach()}
        className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-paper transition hover:bg-teal/90"
        title={
          openaiConfigured === false
            ? "Works in local mode without OpenAI; fuller coaching with API key"
            : "Ask your Assistant PM Coach"
        }
      >
        {label}
      </button>

      {open ? (
        <div className="coach-overlay" role="dialog" aria-modal="true">
          <div className="coach-panel">
            <header className="coach-panel-header">
              <div>
                <p className="eyebrow">Assistant PM Coach</p>
                <h2>{busy ? "Thinking…" : title || "Coaching"}</h2>
                {provider ? (
                  <p className="meta">
                    {provider === "openai" ? "OpenAI" : "Local fallback"}
                    {project ? ` · ${project.code}` : " · Overview"}
                  </p>
                ) : null}
              </div>
              <div className="coach-panel-actions">
                <button
                  type="button"
                  className="muted"
                  disabled={busy}
                  onClick={() => void runCoach()}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="muted"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </header>

            <div className="coach-panel-body">
              {busy ? (
                <p className="empty">
                  Evaluating situation, gaps, risks, and what Tom should do
                  next…
                </p>
              ) : null}
              {error ? <p className="error">{error}</p> : null}
              {!busy && markdown ? (
                <CoachMarkdown markdown={markdown} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CoachMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n(?=##\s+)/);

  return (
    <div className="coach-markdown">
      {blocks.map((block, blockIdx) => {
        const lines = block.trim().split("\n");
        const heading = lines[0]?.startsWith("##")
          ? lines[0].replace(/^##\s+/, "")
          : null;
        const body = heading ? lines.slice(1).join("\n").trim() : block.trim();
        return (
          <section key={`${blockIdx}-${heading ?? "body"}`} className="coach-section">
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
    </div>
  );
}
