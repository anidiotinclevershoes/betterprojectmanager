"use client";

import { formatDayMonth } from "@/lib/selectors";
import {
  SPARSE_TIMELINE_HINT,
  composeTimelineProjection,
  eventLeftPercent,
  eventWidthPercent,
  type TlEvent,
  type TlLane,
} from "@/lib/knowledge-centre/timeline-projection";
import { useMission } from "@/lib/store";

function LaneEvents({
  lane,
  startMs,
  spanMs,
  onMeeting,
}: {
  lane: TlLane;
  startMs: number;
  spanMs: number;
  onMeeting?: (meetingId: string) => void;
}) {
  const milestones = lane.events.filter(
    (e) => e.kind === "milestone" || e.kind === "deadline" || e.kind === "date" || e.kind === "todo",
  );
  const meetings = lane.events.filter((e) => e.kind === "meeting");
  const away = lane.events.filter((e) => e.kind === "unavailability");

  const render = (event: TlEvent) => {
    const left = eventLeftPercent(event, startMs, spanMs);
    const width = eventWidthPercent(event, startMs, spanMs);
    const meeting = event.kind === "meeting" && event.meetingId;
    return (
      <div
        key={event.id}
        className={`kc-tl-mark is-${event.kind}`}
        style={{ left: `${left}%`, width: `${width}%` }}
        title={event.title}
      >
        {meeting ? (
          <button
            type="button"
            className="kc-tl-mark-hit"
            onClick={() => onMeeting?.(event.meetingId!)}
          >
            {event.title}
          </button>
        ) : (
          <span>{event.title}</span>
        )}
      </div>
    );
  };

  if (lane.kind === "project") {
    return (
      <>
        {milestones.length ? (
          <div className="kc-tl-sublane">
            <p className="kc-tl-sublane-label">Milestones &amp; deadlines</p>
            <div className="kc-tl-track">{milestones.map(render)}</div>
          </div>
        ) : null}
        {meetings.length ? (
          <div className="kc-tl-sublane">
            <p className="kc-tl-sublane-label">Meetings</p>
            <div className="kc-tl-track">{meetings.map(render)}</div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="kc-tl-sublane">
        <div className="kc-tl-track">
          {away.map(render)}
          {lane.events.filter((e) => e.kind !== "unavailability").map(render)}
        </div>
      </div>
      {lane.availabilityNote ? (
        <p
          className={`kc-tl-avail ${lane.hasExplicitUnavailability ? "is-known" : "is-unknown"}`}
          data-testid={`kc-tl-avail-${lane.personId}`}
        >
          {lane.availabilityNote}
        </p>
      ) : null}
    </>
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
  if (view.empty) return null;

  const spanMs = Math.max(view.endMs - view.startMs, 1);
  const ticks = [0, 0.33, 0.66, 1].map((p) => {
    const ms = view.startMs + spanMs * p;
    return { ms, label: formatDayMonth(ms), left: p * 100 };
  });

  return (
    <div className="kc-tl" data-testid="kc-timeline-body">
      <div className="kc-tl-axis" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick.ms} className="kc-tl-tick" style={{ left: `${tick.left}%` }}>
            {tick.label}
          </span>
        ))}
      </div>

      <section className="kc-tl-lane" data-testid="kc-tl-lane-project">
        <h4 className="kc-tl-lane-title">Project</h4>
        <LaneEvents
          lane={view.projectLane}
          startMs={view.startMs}
          spanMs={spanMs}
          onMeeting={onMeetingPrep}
        />
      </section>

      {view.personLanes.map((lane) => (
        <section
          key={lane.id}
          className="kc-tl-lane is-person"
          data-testid={`kc-tl-lane-person-${lane.personId}`}
        >
          <h4 className="kc-tl-lane-title">{lane.label}</h4>
          <LaneEvents
            lane={lane}
            startMs={view.startMs}
            spanMs={spanMs}
            onMeeting={onMeetingPrep}
          />
        </section>
      ))}

      {view.sparse ? (
        <p className="kc-tl-hint">{SPARSE_TIMELINE_HINT}</p>
      ) : null}
    </div>
  );
}
