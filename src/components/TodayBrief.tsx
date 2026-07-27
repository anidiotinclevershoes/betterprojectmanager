"use client";

import { useState } from "react";
import type { AttentionNudge } from "@/lib/focus";
import { useMission } from "@/lib/store";

/**
 * Manual "What do I need to know today" brief.
 * Does not auto-run — user spends credits / triggers analysis.
 */
export function TodayBrief({
  nudges,
  projectId,
}: {
  nudges: AttentionNudge[];
  projectId?: string;
}) {
  const { state } = useMission();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const scope = projectId
        ? { mode: "project" as const, projectId }
        : { mode: "overview" as const };

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          state: {
            projects: state.projects,
            memories: state.memories.slice(0, 40),
            recommendations: state.recommendations
              .filter((r) => r.status === "active")
              .slice(0, 30),
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
        throw new Error(data?.error || "Analysis failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let markdown = "";

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
              text?: string;
              markdown?: string;
              error?: string;
            };
            if (event.type === "delta" && event.text) markdown += event.text;
            if (event.type === "done" && event.markdown) markdown = event.markdown;
            if (event.type === "error") throw new Error(event.error || "Failed");
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }

      // Pull situational assessment + first actions as brief + waiting suggestions
      const assessment =
        markdown.match(/##\s*1\.[^\n]*\n([\s\S]*?)(?=\n##\s*2\.|$)/)?.[1]?.trim() ??
        markdown.slice(0, 400);
      const actions = (
        markdown.match(/##\s*2\.[^\n]*\n([\s\S]*?)(?=\n##\s*3\.|$)/)?.[1] ?? ""
      )
        .split("\n")
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter((l) => l.length > 8)
        .slice(0, 5);

      setBrief(assessment);
      setSuggestions(actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="today-brief">
      <div className="today-brief-main">
        <header className="today-brief-header">
          <h2>What do I need to know today?</h2>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void runAnalysis()}
          >
            {busy ? "Analysing…" : brief ? "Refresh analysis" : "Run analysis"}
          </button>
        </header>

        {!brief && !busy ? (
          <p className="today-brief-empty">
            Not automatic — run when you want a calm read of what changed and
            what matters. Uses your OpenAI credits when configured.
          </p>
        ) : null}

        {busy && !brief ? (
          <p className="today-brief-empty">Reading the board…</p>
        ) : null}

        {error ? <p className="today-brief-error">{error}</p> : null}

        {brief ? (
          <div className="today-brief-body coach-voice">{brief}</div>
        ) : null}

        {nudges.length > 0 ? (
          <ul className="nudge-list">
            {nudges.slice(0, 3).map((n) => (
              <li key={n.id} className={`nudge-item accent-${n.accent}`}>
                <span className="nudge-dot" aria-hidden />
                <span className="nudge-text">
                  {n.projectCode ? (
                    <span className="nudge-code">{n.projectCode}</span>
                  ) : null}
                  {n.text}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <aside className="today-brief-waiting">
        <h3>Waiting for analysis</h3>
        <p className="hint">
          Suggested actions and updates to add into the rest of the board.
        </p>
        {suggestions.length === 0 ? (
          <p className="today-brief-empty">
            {busy
              ? "Suggestions will land here as analysis finishes…"
              : "Run analysis to populate suggested moves."}
          </p>
        ) : (
          <ul className="waiting-list">
            {suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </aside>
    </section>
  );
}
