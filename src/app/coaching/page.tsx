"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCoachActions } from "@/lib/coach-actions";
import { useMission } from "@/lib/store";
import {
  getCoachingSession,
  listCoachingSessions,
  type CoachingSessionRecord,
} from "@/lib/sessions/history";

const SECTION_ORDER = [
  "Leadership",
  "Risks",
  "Strategic Actions",
  "Disruptive Opportunity",
  "Recommended Actions",
] as const;

function stripMarkdownNoise(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

function parseSections(markdown: string) {
  const blocks = markdown.split(/\n(?=##\s+)/);
  const mapped = new Map<string, string>();
  let intro = "";

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const headingLine = lines[0]?.startsWith("##") ? lines[0] : null;
    if (!headingLine) {
      intro = stripMarkdownNoise(block.trim());
      continue;
    }
    const heading = headingLine
      .replace(/^##\s+/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();
    const body = stripMarkdownNoise(lines.slice(1).join("\n").trim());
    const key =
      SECTION_ORDER.find((name) =>
        heading.toLowerCase().includes(name.toLowerCase()),
      ) ?? heading;
    mapped.set(key, body);
  }

  return { intro, mapped };
}

function excerpt(text: string, max = 140) {
  const cleaned = stripMarkdownNoise(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(status: CoachingSessionRecord["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "dismissed":
      return "Dismissed";
    case "completed":
      return "Completed";
  }
}

export default function CoachingPage() {
  const { state } = useMission();
  const [sessions, setSessions] = useState<CoachingSessionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSessions(listCoachingSessions());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const selected = useMemo(
    () => (selectedId ? getCoachingSession(selectedId) : null),
    [selectedId, sessions],
  );

  const projectLabel = (session: CoachingSessionRecord) => {
    if (session.scope === "all_projects") return "All projects";
    if (!session.projectId) return "Project";
    return (
      state.projects.find((p) => p.id === session.projectId)?.code ?? "Project"
    );
  };

  return (
    <div className="history-page session-history-page">
      <p className="meta mb-3">
        Previous Coach runs, including dismissed sessions and recommendation
        outcomes.
      </p>

      {sessions.length === 0 ? (
        <p className="empty-copy">No Coaching sessions yet.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => {
            const actions = parseCoachActions(session.markdown);
            const accepted = Object.values(session.recommendationStates).filter(
              (s) => s === "accepted",
            ).length;
            const dismissed = Object.values(
              session.recommendationStates,
            ).filter((s) => s === "dismissed").length;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  className="session-list-item"
                  onClick={() => setSelectedId(session.id)}
                >
                  <div className="session-list-top">
                    <span className="session-when">
                      {formatWhen(session.createdAt)}
                    </span>
                    <span className="tag">{statusLabel(session.status)}</span>
                  </div>
                  <p className="session-excerpt">
                    {session.title} — {excerpt(session.markdown)}
                  </p>
                  <p className="meta">
                    {projectLabel(session)} · {actions.length} recommended
                    action{actions.length === 1 ? "" : "s"} · {accepted}{" "}
                    accepted · {dismissed} dismissed
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <CoachingSessionDetail
          session={selected}
          scopeLabel={projectLabel(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function CoachingSessionDetail({
  session,
  scopeLabel,
  onClose,
}: {
  session: CoachingSessionRecord;
  scopeLabel: string;
  onClose: () => void;
}) {
  const { intro, mapped } = parseSections(session.markdown);
  const ordered = [
    ...SECTION_ORDER.filter((name) => mapped.has(name)),
    ...[...mapped.keys()].filter(
      (k) => !(SECTION_ORDER as readonly string[]).includes(k),
    ),
  ];
  const actions = parseCoachActions(session.markdown);
  const accepted = actions.filter(
    (a) => session.recommendationStates[a.id] === "accepted",
  );
  const dismissed = actions.filter(
    (a) => session.recommendationStates[a.id] === "dismissed",
  );

  return (
    <div className="session-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="session-overlay-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="session-overlay-panel">
        <header className="session-overlay-head">
          <div>
            <p className="eyebrow">Coaching session</p>
            <h2>{session.title || "Coaching"}</h2>
            <p className="meta">
              {formatWhen(session.createdAt)} · {scopeLabel} ·{" "}
              {statusLabel(session.status)}
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>

        {intro ? (
          <section className="session-detail-block">
            <div className="coach-section-body">{renderLines(intro)}</div>
          </section>
        ) : null}

        <div className="coach-results-grid session-coach-grid">
          {ordered.map((name) => {
            const body = mapped.get(name) ?? "";
            const isDisruptive = name.toLowerCase().includes("disruptive");
            return (
              <section
                key={name}
                className={`coach-results-section ${isDisruptive ? "is-disruptive" : ""}`}
              >
                <h3>{name}</h3>
                <div className="coach-section-body">{renderLines(body)}</div>
              </section>
            );
          })}
        </div>

        {accepted.length ? (
          <section className="session-detail-block">
            <h3>Accepted recommendations</h3>
            <ul>
              {accepted.map((a) => (
                <li key={a.id}>{stripMarkdownNoise(a.title)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {dismissed.length ? (
          <section className="session-detail-block">
            <h3>Dismissed recommendations</h3>
            <ul>
              {dismissed.map((a) => (
                <li key={a.id}>{stripMarkdownNoise(a.title)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {accepted.length ? (
          <section className="session-detail-block">
            <h3>Linked records</h3>
            <ul>
              {accepted.map((a) => (
                <li key={`link-${a.id}`}>
                  {stripMarkdownNoise(a.title)} — from Coach
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function renderLines(body: string) {
  return body.split("\n").map((line, idx) => {
    const key = `${idx}-${line.slice(0, 20)}`;
    if (!line.trim()) return null;
    if (line.startsWith("> ")) {
      return (
        <blockquote key={key}>{line.replace(/^>\s?/, "")}</blockquote>
      );
    }
    return <p key={key}>{line}</p>;
  });
}
