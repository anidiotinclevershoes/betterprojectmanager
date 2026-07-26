"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  projectTimeline,
  timelineBounds,
} from "@/lib/timeline";
import { useMission } from "@/lib/store";
import type { TimelineItem, TimelineItemType } from "@/lib/types";

const TYPE_CLASS: Record<TimelineItemType, string> = {
  phase: "tl-phase",
  milestone: "tl-milestone",
  meeting: "tl-meeting",
  deadline: "tl-deadline",
  submission: "tl-submission",
};

export function ProjectTimelineGantt({ projectId }: { projectId: string }) {
  const { state, addTimelineItem } = useMission();
  const items = projectTimeline(state.timeline ?? [], projectId);
  const { start, end } = useMemo(() => timelineBounds(items), [items]);
  const span = Math.max(end - start, 1);

  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<TimelineItemType>("milestone");

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date) return;
    const startAt = new Date(`${date}T09:00:00`).toISOString();
    addTimelineItem(projectId, {
      label: label.trim(),
      type,
      startAt,
      source: "manual",
    });
    setLabel("");
    setDate("");
  }

  const ticks = buildTicks(start, end);

  return (
    <section className="timeline-panel">
      <header className="timeline-header">
        <div>
          <h3>Timeline</h3>
          <p>
            Simple Gantt — add dates yourself; captures can append milestones
            without rebuilding the calendar.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="empty">No timeline items yet. Add a date below.</p>
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

      <form className="timeline-add" onSubmit={onAdd}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TimelineItemType)}
        >
          <option value="milestone">Milestone</option>
          <option value="phase">Phase</option>
          <option value="meeting">Meeting</option>
          <option value="deadline">Deadline</option>
          <option value="submission">Submission</option>
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. CAB pack due)"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="submit" disabled={!label.trim() || !date}>
          Add
        </button>
      </form>
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
        <span className="gantt-date">
          {new Date(item.startAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
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
      label: new Date(cursor).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
    cursor += step;
  }
  return ticks;
}
