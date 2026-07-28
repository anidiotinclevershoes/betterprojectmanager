"use client";

import Link from "next/link";
import { buildMeetingPrepItems } from "@/lib/workspace/frames-data";
import { useMission } from "@/lib/store";

const CONFIDENCE_LABEL = {
  ready: "Ready",
  nearly: "Nearly ready",
  needs_prep: "Needs preparation",
} as const;

export function MeetingPrepFrame({
  projectId,
}: {
  projectId?: string | null;
  size?: string;
}) {
  const { state } = useMission();
  const items = buildMeetingPrepItems(state, projectId ?? undefined);

  return (
    <div className="frame-body">
      {items.length === 0 ? (
        <p className="empty-copy">No meeting briefs need preparation.</p>
      ) : (
        <ul className="frame-list">
          {items.map((item) => (
            <li key={item.meeting.id} className="prep-card">
              <div className="prep-card-top">
                <Link href={`/meetings/${item.meeting.id}`} className="frame-row-title">
                  {item.meeting.title}
                </Link>
                <span className={`prep-badge prep-${item.confidence}`}>
                  {CONFIDENCE_LABEL[item.confidence]}
                </span>
              </div>
              <p className="meta">
                {item.projectCode} · {item.whenLabel}
              </p>
              <p className="prep-stats">
                Opening {item.meeting.prep.openingScript ? "ready" : "missing"} ·{" "}
                {item.talkingPoints} talking points · {item.questions} questions
              </p>
              {item.missing.length ? (
                <p className="prep-missing">
                  Missing: {item.missing.join(", ")}
                </p>
              ) : null}
              <div className="row-actions">
                <Link href={`/meetings/${item.meeting.id}`} className="ghost-btn">
                  Open brief
                </Link>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      item.meeting.prep.openingScript,
                    )
                  }
                >
                  Copy opening
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
