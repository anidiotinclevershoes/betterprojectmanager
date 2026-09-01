"use client";

import { useMemo } from "react";
import {
  buildMeetingCatchUpBrief,
  formatMeetingWhen,
  nextKnownMeeting,
} from "@/lib/knowledge-centre/meeting-catch-up";
import { useMission } from "@/lib/store";
import { useTellMeSession } from "@/components/tell-me/TellMeSessionContext";

function Section({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ id: string; text: string; source: string }>;
}) {
  if (!lines.length) return null;
  return (
    <section className="kc-catchup-section">
      <h4>{title}</h4>
      <ul>
        {lines.map((line) => (
          <li key={line.id}>
            <span className="kc-catchup-source">{sourceLabel(line.source)}</span>
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function sourceLabel(source: string): string {
  if (source === "needs_you") return "Needs You";
  if (source === "todo") return "To Do";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function NextMeetingCue({
  projectId,
  onOpen,
}: {
  projectId: string;
  onOpen: (meetingId: string) => void;
}) {
  const { state } = useMission();
  const meeting = nextKnownMeeting(state, projectId);
  if (!meeting) return null;
  return (
    <div className="kc-next-meeting" data-testid="kc-next-meeting">
      <div>
        <p className="kc-next-meeting-label">Next meeting</p>
        <p className="kc-next-meeting-title">
          {meeting.title} · {formatMeetingWhen(meeting.startsAt)}
        </p>
      </div>
      <button
        type="button"
        className="kc-catchup-btn"
        data-testid="kc-catch-me-up"
        onClick={() => onOpen(meeting.id)}
      >
        Catch me up
      </button>
    </div>
  );
}

export function MeetingCatchUpPanel({
  projectId,
  meetingId,
  onClose,
}: {
  projectId: string;
  meetingId: string;
  onClose: () => void;
}) {
  const { state } = useMission();
  const { setQuestion } = useTellMeSession();
  const meeting = state.meetings.find(
    (m) => m.id === meetingId && m.projectId === projectId,
  );
  const brief = useMemo(
    () => (meeting ? buildMeetingCatchUpBrief(state, meeting) : null),
    [state, meeting],
  );

  if (!meeting || !brief) return null;

  return (
    <aside
      className="kc-catchup"
      data-testid="kc-meeting-catch-up"
      aria-label={`Catch me up for ${brief.title}`}
    >
      <header className="kc-catchup-head">
        <div>
          <p className="kc-next-meeting-label">Catch me up</p>
          <h3>
            {brief.title} — {brief.whenLabel}
          </h3>
        </div>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Close
        </button>
      </header>

      {brief.thin ? (
        <p className="kc-catchup-thin" data-testid="kc-catchup-thin">
          Lume only knows the meeting time so far. Capture what happens and this
          brief will fill in.
        </p>
      ) : null}

      <Section title="What this meeting is about" lines={brief.about} />
      <Section title="What has changed / matters now" lines={brief.mattersNow} />
      <Section title="You may need to address" lines={brief.address} />
      <Section title="Useful context" lines={brief.context} />

      <button
        type="button"
        className="kc-more-link"
        onClick={() =>
          setQuestion(`Catch me up for ${brief.title} on ${brief.whenLabel}`)
        }
      >
        Ask Lume more
      </button>
    </aside>
  );
}
