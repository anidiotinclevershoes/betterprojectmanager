"use client";

import { useEffect, useMemo, useState } from "react";
import { useMission } from "@/lib/store";
import {
  KIND_LABEL,
  OP_LABEL,
} from "@/lib/capture/suggestions";
import {
  getCaptureSession,
  listCaptureSessions,
  statusLabel,
  type CaptureSessionRecord,
  type CaptureSource,
} from "@/lib/sessions/history";

const SOURCE_LABEL: Record<CaptureSource, string> = {
  typed: "Typed",
  recorded: "Recorded",
  uploaded: "Uploaded",
};

function excerpt(text: string, max = 120) {
  const cleaned = text.replace(/\s+/g, " ").trim();
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

export default function CapturesPage() {
  const { state } = useMission();
  const [sessions, setSessions] = useState<CaptureSessionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSessions(listCaptureSessions());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const selected = useMemo(
    () => (selectedId ? getCaptureSession(selectedId) : null),
    [selectedId, sessions],
  );

  const projectLabel = (id?: string | null) => {
    if (!id) return "All / unlinked";
    return state.projects.find((p) => p.id === id)?.code ?? "—";
  };

  return (
    <div className="history-page session-history-page">
      <p className="meta mb-3">
        Previous Capture sessions, including dismissed and completed reviews.
      </p>

      {sessions.length === 0 ? (
        <p className="empty-copy">No Capture sessions yet.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => {
            const accepted = session.suggestions.filter(
              (s) => session.added[s.id],
            ).length;
            const dismissed = session.suggestions.filter(
              (s) => session.dismissed[s.id],
            ).length;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  className="session-list-item"
                  onClick={() => setSelectedId(session.id)}
                >
                  <div className="session-list-top">
                    <span className="session-when">
                      {formatWhen(session.analysedAt)}
                    </span>
                    <span className="tag">{statusLabel(session.status)}</span>
                  </div>
                  <p className="session-excerpt">
                    {excerpt(session.transcript)}
                  </p>
                  <p className="meta">
                    {projectLabel(session.projectId)} ·{" "}
                    {SOURCE_LABEL[session.source]} ·{" "}
                    {session.suggestions.length} suggestion
                    {session.suggestions.length === 1 ? "" : "s"} · {accepted}{" "}
                    accepted · {dismissed} dismissed
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <CaptureSessionDetail
          session={selected}
          projectLabel={projectLabel(selected.projectId)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function CaptureSessionDetail({
  session,
  projectLabel,
  onClose,
}: {
  session: CaptureSessionRecord;
  projectLabel: string;
  onClose: () => void;
}) {
  const accepted = session.suggestions.filter((s) => session.added[s.id]);
  const dismissed = session.suggestions.filter((s) => session.dismissed[s.id]);
  const pending = session.suggestions.filter(
    (s) => !session.added[s.id] && !session.dismissed[s.id],
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
            <p className="eyebrow">Capture session</p>
            <h2>{formatWhen(session.analysedAt)}</h2>
            <p className="meta">
              {projectLabel} · {SOURCE_LABEL[session.source]} ·{" "}
              {statusLabel(session.status)}
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="session-detail-block">
          <h3>Captured text</h3>
          <pre className="session-transcript">{session.transcript}</pre>
        </section>

        <section className="session-detail-block">
          <h3>Interpretation</h3>
          <p>{session.result.memory.content}</p>
          {session.result.insights?.length ? (
            <>
              <h4>Observations</h4>
              <ul>
                {session.result.insights.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <SuggestionGroup title="Accepted" items={accepted} />
        <SuggestionGroup title="Dismissed" items={dismissed} />
        <SuggestionGroup title="Pending" items={pending} />

        {accepted.length ? (
          <section className="session-detail-block">
            <h3>Linked records</h3>
            <ul>
              {accepted.map((item) => (
                <li key={item.id}>
                  {OP_LABEL[item.op]} · {KIND_LABEL[item.kind]} — {item.content}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SuggestionGroup({
  title,
  items,
}: {
  title: string;
  items: CaptureSessionRecord["suggestions"];
}) {
  if (!items.length) return null;
  return (
    <section className="session-detail-block">
      <h3>
        {title} ({items.length})
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span className="tag">{OP_LABEL[item.op]}</span>{" "}
            <span className="tag">{KIND_LABEL[item.kind]}</span> — {item.content}
          </li>
        ))}
      </ul>
    </section>
  );
}
