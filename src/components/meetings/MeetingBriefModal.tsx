"use client";

/**
 * Leftover Meeting Prep editor. Unmounted from production Knowledge Centre.
 * Historical `Meeting.prep` still hydrates. Writes are disabled — do not
 * remount this as a competing meeting-truth editor.
 */
import { useEffect, useId, useRef, useState } from "react";
import { isValidDateInput } from "@/lib/dates";
import { formatWhen, toDateInputValue } from "@/lib/selectors";
import { useMission } from "@/lib/store";

function linesToList(text: string) {
  return text
    .split("\n")
    .map((l) => l.replace(/^•\s*/, "").trim())
    .filter(Boolean);
}

function listToLines(items: string[]) {
  return items.join("\n");
}

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

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [opening, setOpening] = useState("");
  const [objectives, setObjectives] = useState("");
  const [talkingPoints, setTalkingPoints] = useState("");
  const [questions, setQuestions] = useState("");
  const [missing, setMissing] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!meeting) return;
    setTitle(meeting.title);
    setProjectId(meeting.projectId);
    const d = new Date(meeting.startsAt);
    setDate(toDateInputValue(meeting.startsAt));
    setTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
    setOpening(meeting.prep.openingScript);
    setObjectives(listToLines(meeting.prep.objectives));
    setTalkingPoints(listToLines(meeting.prep.talkingPoints));
    setQuestions(listToLines(meeting.prep.questionsToAsk));
    setMissing(listToLines(meeting.prep.risksToDiscuss));
    setSaved(false);
  }, [meeting]);

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
  const dateOk = !date || isValidDateInput(date);

  function save() {
    // Writes retired: leftover editor must not mutate session Meeting.prep.
    return;
  }

  const fullBrief = [
    opening,
    "",
    "Objectives:",
    ...linesToList(objectives).map((i) => `• ${i}`),
    "",
    "Talking points:",
    ...linesToList(talkingPoints).map((i) => `• ${i}`),
    "",
    "Questions:",
    ...linesToList(questions).map((i) => `• ${i}`),
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
            <h2 id={titleId}>Historical meeting prep</h2>
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
          <label className="field">
            <span>Meeting title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row-2">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!dateOk || undefined}
              />
            </label>
            <label className="field">
              <span>Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          {!dateOk ? (
            <p className="field-error" role="alert">
              Enter a valid date.
            </p>
          ) : null}
          <label className="field">
            <span>Opening</span>
            <textarea
              className="capture-textarea"
              rows={3}
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Objectives (one per line)</span>
            <textarea
              className="capture-textarea"
              rows={3}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Talking points (one per line)</span>
            <textarea
              className="capture-textarea"
              rows={3}
              value={talkingPoints}
              onChange={(e) => setTalkingPoints(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Questions (one per line)</span>
            <textarea
              className="capture-textarea"
              rows={3}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Missing information / risks (one per line)</span>
            <textarea
              className="capture-textarea"
              rows={3}
              value={missing}
              onChange={(e) => setMissing(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={save}
              disabled
            >
              Editing retired
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void navigator.clipboard.writeText(opening)}
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
            {saved ? <span className="meta">Saved</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
