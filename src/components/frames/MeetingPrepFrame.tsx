"use client";

/**
 * Leftover Meeting Prep widget. Unmounted from production Knowledge Centre.
 * Historical `Meeting.prep` still hydrates. Do not remount this as an editor
 * for meeting-scoped Catch Me Up.
 */
import { useState } from "react";
import { MeetingBriefModal } from "@/components/meetings/MeetingBriefModal";
import { useFrameExpand } from "@/components/workspace/FrameExpandContext";
import { buildMeetingPrepItems } from "@/lib/workspace/frames-data";
import type { FrameSize } from "@/lib/workspace/layout";
import {
  isInteractiveTarget,
  itemLimitFor,
} from "@/lib/workspace/packing";
import { useMission } from "@/lib/store";

const CONFIDENCE_LABEL = {
  ready: "Ready",
  nearly: "Nearly ready",
  needs_prep: "Needs preparation",
} as const;

export function MeetingPrepFrame({
  projectId,
  size = "standard",
  frameId = "meetingPrep",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
  frameId?: string;
}) {
  const { state } = useMission();
  const { isExpanded, expand, collapse } = useFrameExpand();
  const expanded = isExpanded(frameId);
  const items = buildMeetingPrepItems(state, projectId ?? undefined);
  const [briefId, setBriefId] = useState<string | null>(null);
  const limit = itemLimitFor(size);
  const visible = expanded ? items : items.slice(0, limit);
  const featured = visible[0];
  const rest = visible.slice(1);
  const overflow = !expanded && items.length > limit;

  return (
    <div className="frame-body">
      {items.length === 0 ? (
        <p className="empty-copy">No meeting briefs need preparation.</p>
      ) : (
        <>
          <ul className="frame-list">
            {featured ? (
              <li
                className="prep-card prep-card-featured is-card-clickable"
                onClick={(e) => {
                  if (isInteractiveTarget(e.target)) return;
                  setBriefId(featured.meeting.id);
                }}
              >
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
                  Opening{" "}
                  {featured.meeting.prep.openingScript ? "ready" : "missing"} ·{" "}
                  {featured.talkingPoints} talking points ·{" "}
                  {featured.questions} likely questions
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
              <li
                key={item.meeting.id}
                className="frame-row prep-compact is-card-clickable"
                onClick={(e) => {
                  if (isInteractiveTarget(e.target)) return;
                  setBriefId(item.meeting.id);
                }}
              >
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
          {overflow || expanded ? (
            <div className="frame-footer">
              <span className="meta">
                {expanded
                  ? `${items.length} meetings`
                  : `Showing ${visible.length} of ${items.length}`}
              </span>
              {overflow ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => expand(frameId)}
                >
                  View all
                </button>
              ) : null}
              {expanded ? (
                <button type="button" className="ghost-btn" onClick={collapse}>
                  Collapse
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <MeetingBriefModal
        meetingId={briefId}
        onClose={() => setBriefId(null)}
      />
    </div>
  );
}
