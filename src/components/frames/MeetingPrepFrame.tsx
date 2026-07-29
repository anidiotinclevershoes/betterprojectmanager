"use client";

import { useState } from "react";
import { MeetingBriefModal } from "@/components/meetings/MeetingBriefModal";
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
  const [briefId, setBriefId] = useState<string | null>(null);
  const featured = items[0];
  const rest = items.slice(1);

  return (
    <div className="frame-body frame-body-scroll">
      {items.length === 0 ? (
        <p className="empty-copy">No meeting briefs need preparation.</p>
      ) : (
        <ul className="frame-list">
          {featured ? (
            <li className="prep-card prep-card-featured">
              <p className="eyebrow">Next important meeting</p>
              <div className="prep-card-top">
                <button
                  type="button"
                  className="frame-row-title"
                  onClick={() => setBriefId(featured.meeting.id)}
                >
                  {featured.meeting.title}
                </button>
                <span className={`prep-badge prep-${featured.confidence}`}>
                  {CONFIDENCE_LABEL[featured.confidence]}
                </span>
              </div>
              <p className="meta">
                {featured.projectCode} · {featured.whenLabel}
              </p>
              <p className="prep-stats">
                Opening {featured.meeting.prep.openingScript ? "ready" : "missing"} ·{" "}
                {featured.talkingPoints} talking points · {featured.questions}{" "}
                likely questions
              </p>
              {featured.missing.length ? (
                <p className="prep-missing">
                  Missing: {featured.missing.join(", ")}
                </p>
              ) : null}
              <div className="row-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setBriefId(featured.meeting.id)}
                >
                  Open brief
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      featured.meeting.prep.openingScript,
                    )
                  }
                >
                  Copy opening
                </button>
              </div>
            </li>
          ) : null}

          {rest.map((item) => (
            <li key={item.meeting.id} className="frame-row prep-compact">
              <button
                type="button"
                className="frame-row-title"
                onClick={() => setBriefId(item.meeting.id)}
              >
                {item.meeting.title}
              </button>
              <span className="meta">{item.whenLabel}</span>
              <span className={`prep-badge prep-${item.confidence}`}>
                {CONFIDENCE_LABEL[item.confidence]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <MeetingBriefModal
        meetingId={briefId}
        onClose={() => setBriefId(null)}
      />
    </div>
  );
}
