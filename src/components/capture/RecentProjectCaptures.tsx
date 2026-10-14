"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listCaptureSessions,
  statusLabel,
  type CaptureSessionRecord,
} from "@/lib/sessions/history";

function excerpt(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 88) return cleaned;
  return `${cleaned.slice(0, 88).trim()}…`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Read-only list of this project's stored Capture sessions. */
export function RecentProjectCaptures({ projectId }: { projectId: string }) {
  const [sessions, setSessions] = useState<CaptureSessionRecord[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSessions(
        listCaptureSessions()
          .filter((session) => session.projectId === projectId)
          .slice(0, 4),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [projectId]);

  return (
    <section
      className="p09-recent-captures"
      aria-label="Recent captures"
      data-testid="recent-project-captures"
    >
      <div className="p09-recent-captures-head">
        <h3>Recent captures</h3>
        <Link href="/captures">All captures</Link>
      </div>
      {sessions.length ? (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <span>{excerpt(session.transcript)}</span>
              <small>
                {formatWhen(session.analysedAt)} · {statusLabel(session.status)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No captures for this project yet.</p>
      )}
    </section>
  );
}
