"use client";

import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { MeetingBriefModal } from "@/components/meetings/MeetingBriefModal";
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
}: {
  projectId?: string | null;
  size?: FrameSize | string;
}) {
  const { state } = useMission();
  const items = buildMeetingPrepItems(state, projectId ?? undefined);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const limit = itemLimitFor(size);
  const visible = items.slice(0, limit);
  const featured = visible[0];
  const rest = visible.slice(1);
  const overflow = items.length > limit;

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
          {overflow ? (
            <div className="frame-footer">
              <span className="meta">
                Showing {visible.length} of {items.length}
              </span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setViewAll(true)}
              >
                View all
              </button>
            </div>
          ) : null}
        </>
      )}

      <DetailModal
        open={viewAll}
        onClose={() => setViewAll(false)}
        title="Meeting prep"
      >
        <ul className="frame-list">
          {items.map((item) => (
            <li
              key={item.meeting.id}
              className="frame-row prep-compact is-card-clickable"
              onClick={(e) => {
                if (isInteractiveTarget(e.target)) return;
                setViewAll(false);
                setBriefId(item.meeting.id);
              }}
            >
              <button
                type="button"
                className="frame-row-title"
                onClick={() => {
                  setViewAll(false);
                  setBriefId(item.meeting.id);
                }}
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
      </DetailModal>

      <MeetingBriefModal
        meetingId={briefId}
        onClose={() => setBriefId(null)}
      />
    </div>
  );
}
