"use client";

import { useEffect, useState } from "react";
import {
  SPARSE_TIMELINE_HINT,
  axisTicks,
  compactPreviewEvents,
  composeTimelineProjection,
  eventKindLabel,
  eventWhenLabel,
  packLaneEvents,
  shortEventLabel,
  todayLeftPercent,
  type PackedEvent,
  type TlEvent,
  type TlLane,
} from "@/lib/knowledge-centre/timeline-projection";
import { formatDayMonth } from "@/lib/selectors";
import { useMission } from "@/lib/store";

function Track({
  events,
  startMs,
  spanMs,
  todayLeft,
  selectedId,
  onSelect,
}: {
  events: TlEvent[];
  startMs: number;
  spanMs: number;
  todayLeft: number | null;
  selectedId: string | null;
  onSelect: (event: TlEvent) => void;
}) {
  const packed = packLaneEvents(events, startMs, spanMs);
  const stacks = packed.reduce((max, row) => Math.max(max, row.stack + 1), 1);

  return (
    <div
      className="kc-tl-track"
      style={{ ["--kc-tl-stacks" as string]: String(stacks) }}
    >
      {todayLeft != null ? (
        <span className="kc-tl-now" style={{ left: `${todayLeft}%` }} aria-hidden />
      ) : null}
      {packed.map((row) => (
        <EventChip
          key={row.event.id}
          row={row}
          selected={selectedId === row.event.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function EventChip({
  row,
  selected,
  onSelect,
}: {
  row: PackedEvent;
  selected: boolean;
  onSelect: (event: TlEvent) => void;
}) {
  const { event, left, width, stack, when, label } = row;
  const full = event.kind === "unavailability" && width > 14
    ? `${label} · ${eventWhenLabel(event)}`
    : label;
  return (
    <button
      type="button"
      className={`kc-tl-mark is-${event.kind} is-${when}${selected ? " is-open" : ""}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `calc(0.2rem + ${stack} * 1.28rem)`,
      }}
      title={event.title}
      aria-expanded={selected}
      data-testid={`kc-tl-mark-${event.id}`}
      onClick={() => onSelect(event)}
    >
      <span className="kc-tl-mark-label">{full}</span>
    </button>
  );
}

function EventDetail({
  event,
  onClose,
  onMeeting,
}: {
  event: TlEvent;
  onClose: () => void;
  onMeeting?: (meetingId: string) => void;
}) {
  const attendees = event.attendees?.filter(Boolean) ?? [];
  return (
    <aside className="kc-tl-detail" data-testid="kc-tl-detail">
      <div className="kc-tl-detail-copy">
        <p className="kc-tl-detail-title">{event.title}</p>
        <p className="kc-tl-detail-meta">
          {eventWhenLabel(event)} · {eventKindLabel(event.kind)}
        </p>
        {attendees.length ? (
          <p className="kc-tl-detail-people">{attendees.join(", ")}</p>
        ) : null}
      </div>
      <div className="kc-tl-detail-actions">
        {event.meetingId && onMeeting ? (
          <button
            type="button"
            className="kc-catchup-btn"
            data-testid="kc-tl-catch-me-up"
            onClick={() => onMeeting(event.meetingId!)}
          >
            Catch me up
          </button>
        ) : null}
        <button
          type="button"
          className="kc-tl-detail-close"
          onClick={onClose}
          aria-label="Close timeline detail"
        >
          Close
        </button>
      </div>
    </aside>
  );
}

function PersonLabel({ lane }: { lane: TlLane }) {
  return (
    <h4 className="kc-tl-label is-person">
      <span>{lane.label}</span>
      {lane.availabilityNote ? (
        <span
          className={`kc-tl-quiet ${lane.hasExplicitUnavailability ? "is-known" : "is-unknown"}`}
          data-testid={`kc-tl-avail-${lane.personId}`}
        >
          {lane.availabilityNote}
        </span>
      ) : null}
    </h4>
  );
}

export function KcTimelinePreview({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const view = composeTimelineProjection(state, projectId);
  if (view.empty || view.sparse) return null;
  const preview = compactPreviewEvents(view, 3);
  if (!preview.length) return null;
  return (
    <div className="kc-tl-preview" data-testid="kc-timeline-preview">
      {preview.map((event) => (
        <span
          key={event.id}
          className={`kc-tl-preview-chip is-${event.kind}`}
          title={event.title}
        >
          <span>{shortEventLabel(event)}</span>
          <span className="kc-tl-preview-when">{formatDayMonth(event.startAt)}</span>
        </span>
      ))}
    </div>
  );
}

export function KcTimeline({
  projectId,
  onMeetingPrep,
}: {
  projectId: string;
  onMeetingPrep?: (meetingId: string) => void;
}) {
  const { state } = useMission();
  const view = composeTimelineProjection(state, projectId);
  const [selected, setSelected] = useState<TlEvent | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (view.empty) return null;

  const spanMs = Math.max(view.endMs - view.startMs, 1);
  const ticks = axisTicks(view.startMs, view.endMs);
  const todayLeft = todayLeftPercent(view.startMs, spanMs);
  const milestones = view.projectLane.events.filter(
    (e) =>
      e.kind === "milestone" ||
      e.kind === "deadline" ||
      e.kind === "date" ||
      e.kind === "todo",
  );
  const meetings = view.projectLane.events.filter((e) => e.kind === "meeting");

  const select = (event: TlEvent) => {
    setSelected((prev) => (prev?.id === event.id ? null : event));
  };

  return (
    <div className="kc-tl" data-testid="kc-timeline-body">
      <div
        className="kc-tl-scroll"
        data-testid="kc-tl-scroll"
        role="region"
        aria-label="Project timeline"
      >
        <div className="kc-tl-canvas">
          <div className="kc-tl-axis" aria-hidden>
            <span className="kc-tl-gutter" />
            <div className="kc-tl-axis-scale">
              {todayLeft != null ? (
                <span className="kc-tl-today" style={{ left: `${todayLeft}%` }}>
                  Today
                </span>
              ) : null}
              {ticks.map((tick) =>
                todayLeft != null && Math.abs(tick.left - todayLeft) < 6 ? null : (
                  <span
                    key={tick.ms}
                    className="kc-tl-tick"
                    style={{ left: `${tick.left}%` }}
                  >
                    {tick.label}
                  </span>
                ),
              )}
            </div>
          </div>

          <section className="kc-tl-group" data-testid="kc-tl-lane-project">
            <div className="kc-tl-row is-heading">
              <h3 className="kc-tl-label is-group">Project</h3>
              <div className="kc-tl-heading-track" aria-hidden />
            </div>
            {milestones.length ? (
              <div className="kc-tl-row">
                <p className="kc-tl-label">Milestones &amp; deadlines</p>
                <Track
                  events={milestones}
                  startMs={view.startMs}
                  spanMs={spanMs}
                  todayLeft={todayLeft}
                  selectedId={selected?.id ?? null}
                  onSelect={select}
                />
              </div>
            ) : null}
            {meetings.length ? (
              <div className="kc-tl-row">
                <p className="kc-tl-label">Meetings</p>
                <Track
                  events={meetings}
                  startMs={view.startMs}
                  spanMs={spanMs}
                  todayLeft={todayLeft}
                  selectedId={selected?.id ?? null}
                  onSelect={select}
                />
              </div>
            ) : null}
          </section>

          {view.personLanes.map((lane) => (
            <section
              key={lane.id}
              className="kc-tl-group is-person"
              data-testid={`kc-tl-lane-person-${lane.personId}`}
            >
              <div className="kc-tl-row">
                <PersonLabel lane={lane} />
                <Track
                  events={lane.events}
                  startMs={view.startMs}
                  spanMs={spanMs}
                  todayLeft={todayLeft}
                  selectedId={selected?.id ?? null}
                  onSelect={select}
                />
              </div>
            </section>
          ))}
        </div>
      </div>

      {selected ? (
        <EventDetail
          event={selected}
          onClose={() => setSelected(null)}
          onMeeting={onMeetingPrep}
        />
      ) : null}

      {view.sparse ? <p className="kc-tl-hint">{SPARSE_TIMELINE_HINT}</p> : null}
    </div>
  );
}
