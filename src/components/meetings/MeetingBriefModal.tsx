"use client";

import { useEffect, useId, useRef } from "react";
import { formatWhen } from "@/lib/selectors";
import { useMission } from "@/lib/store";

export function MeetingBriefModal({
  meetingId,
  onClose,
}: {
  meetingId: string | null;
  onClose: () => void;
}) {
  const { state } = useMission();
  const meeting = meetingId
    ? state.meetings.find((m) => m.id === meetingId)
    : null;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!meetingId) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [meetingId, onClose]);

  if (!meeting) return null;

  const project = state.projects.find((p) => p.id === meeting.projectId);
  const prep = meeting.prep;
  const fullBrief = [
    prep.openingScript,
    "",
    "Objectives:",
    ...prep.objectives.map((i) => `• ${i}`),
    "",
    "Talking points:",
    ...prep.talkingPoints.map((i) => `• ${i}`),
    "",
    "Questions:",
    ...prep.questionsToAsk.map((i) => `• ${i}`),
  ].join("\n");

  return (
    <div className="detail-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal detail-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detail-modal-header">
          <div>
            <p className="eyebrow">
              {project?.code ?? "Project"} · {formatWhen(meeting.startsAt)}
            </p>
            <h2 id={titleId}>{meeting.title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="detail-modal-body meeting-brief-body">
          <section>
            <h3>Strong opening</h3>
            <p className="opening-script">{prep.openingScript}</p>
            <div className="row-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  void navigator.clipboard.writeText(prep.openingScript)
                }
              >
                Copy opening
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void navigator.clipboard.writeText(fullBrief)}
              >
                Copy full brief
              </button>
            </div>
          </section>
          <BriefList title="Objectives" items={prep.objectives} />
          <BriefList title="Talking points" items={prep.talkingPoints} />
          <BriefList title="Questions to ask" items={prep.questionsToAsk} />
          <BriefList
            title="Likely stakeholder concerns"
            items={prep.stakeholderConcerns}
          />
          <BriefList title="Decisions required" items={prep.decisionsToObtain} />
          <BriefList title="Risks to call out" items={prep.risksToDiscuss} />
          <BriefList title="People to engage" items={prep.peopleToEngage} />
        </div>
      </div>
    </div>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
