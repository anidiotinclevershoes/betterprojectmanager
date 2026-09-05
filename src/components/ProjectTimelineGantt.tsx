"use client";

import { useMemo } from "react";
import { formatDayMonth } from "@/lib/selectors";
import {
  projectTimeline,
  timelineBounds,
} from "@/lib/timeline";
import { useMission } from "@/lib/store";
import type { TimelineItem, TimelineItemType } from "@/lib/types";

/**
 * Leftover writable-Gantt visual. Unmounted from production Timeline.
 * Reads stored `timeline` rows only. Must not add or persist new items.
 * Do not remount this as a competing schedule editor.
 */

const TYPE_CLASS: Record<TimelineItemType, string> = {
  phase: "tl-phase",
  milestone: "tl-milestone",
  meeting: "tl-meeting",
  deadline: "tl-deadline",
  submission: "tl-submission",
};

export function ProjectTimelineGantt({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const items = projectTimeline(state.timeline ?? [], projectId);
  const { start, end } = useMemo(() => timelineBounds(items), [items]);
  const span = Math.max(end - start, 1);
  const ticks = buildTicks(start, end);

  return (
    <section className="timeline-panel">
      <header className="timeline-header">
        <div>
          <h3>Timeline</h3>
          <p>
            Historical Gantt view of stored timeline rows. New dates are captured
            through Review → Apply, not here.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="empty">No timeline items yet.</p>
      ) : (
        <div className="gantt">
          <div className="gantt-axis">
            {ticks.map((tick) => (
              <span
                key={tick.ms}
                className="gantt-tick"
                style={{ left: `${((tick.ms - start) / span) * 100}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <ul className="gantt-rows">
            {items.map((item) => (
              <GanttRow
                key={item.id}
                item={item}
                start={start}
                span={span}
              />
            ))}
          </ul>
        </div>
      )}

    </section>
  );
}

function GanttRow({
  item,
  start,
  span,
}: {
  item: TimelineItem;
  start: number;
  span: number;
}) {
  const s = new Date(item.startAt).getTime();
  const e = new Date(item.endAt ?? item.startAt).getTime();
  const left = ((s - start) / span) * 100;
  const width = Math.max(((e - s) / span) * 100, item.endAt ? 4 : 1.2);

  return (
    <li className="gantt-row">
      <div className="gantt-label">
        <span className={`tl-dot ${TYPE_CLASS[item.type]}`} />
        <span className="gantt-label-text">{item.label}</span>
        <span className="gantt-date">{formatDayMonth(item.startAt)}</span>
      </div>
      <div className="gantt-track">
        <div
          className={`gantt-bar ${TYPE_CLASS[item.type]} ${item.endAt ? "" : "gantt-bar-point"}`}
          style={{ left: `${left}%`, width: `${width}%` }}
          title={item.notes ?? item.label}
        />
      </div>
    </li>
  );
}

function buildTicks(start: number, end: number) {
  const span = end - start;
  const step =
    span > 40 * 86400000
      ? 7 * 86400000
      : span > 14 * 86400000
        ? 3 * 86400000
        : 2 * 86400000;
  const ticks: Array<{ ms: number; label: string }> = [];
  let cursor = start;
  while (cursor <= end && ticks.length < 10) {
    ticks.push({
      ms: cursor,
      label: formatDayMonth(cursor),
    });
    cursor += step;
  }
  return ticks;
}
