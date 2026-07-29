"use client";

import { useMemo, useState } from "react";
import { buildNudgeItems, type NudgeItem } from "@/lib/workspace/frames-data";
import { useMission } from "@/lib/store";

export function NudgeFrame({
  projectId,
}: {
  projectId?: string | null;
  size?: string;
}) {
  const { state, dismissSuggestion, addTodo } = useMission();
  const [chased, setChased] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [draftFor, setDraftFor] = useState<NudgeItem | null>(null);

  const items = useMemo(
    () =>
      buildNudgeItems(state, projectId ?? undefined).filter(
        (i) => !resolved[i.id],
      ),
    [state, projectId, resolved],
  );

  return (
    <div className="frame-body frame-body-scroll">
      {items.length === 0 ? (
        <p className="empty-copy">
          Nothing is currently waiting on a response.
        </p>
      ) : (
        <ul className="frame-list">
          {items.map((item) => (
            <li key={item.id} className="nudge-row">
              <div className="nudge-row-main">
                <span className="nudge-avatar" aria-hidden>
                  {item.person.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="nudge-name">
                    {item.person}
                    {item.projectCode ? (
                      <span className="tag">{item.projectCode}</span>
                    ) : null}
                  </p>
                  <p className="meta truncate">{item.item}</p>
                </div>
                <span className={`urgency urgency-${item.urgency}`}>
                  {item.daysWaiting > 0 ? `${item.daysWaiting}d` : item.urgency}
                </span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setDraftFor(item)}
                >
                  Draft follow-up
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    setChased((prev) => ({
                      ...prev,
                      [item.id]: new Date().toISOString().slice(0, 10),
                    }))
                  }
                >
                  {chased[item.id] ? "Chased" : "Mark chased"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setResolved((prev) => ({ ...prev, [item.id]: true }));
                    if (item.source === "recommendation") {
                      dismissSuggestion(item.id.replace(/^rec-/, ""));
                    }
                  }}
                >
                  Resolved
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draftFor ? (
        <div className="nudge-draft-drawer" role="dialog" aria-modal="true">
          <div className="nudge-draft-panel">
            <header className="flex items-center justify-between gap-2">
              <h3>Draft follow-up</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setDraftFor(null)}
              >
                ×
              </button>
            </header>
            <p className="meta mb-2">
              {draftFor.person} · {draftFor.projectCode}
            </p>
            <textarea
              className="capture-textarea"
              rows={5}
              defaultValue={
                draftFor.suggestedMessage ??
                `Hi ${draftFor.person.split(" ")[0]}, following up on: ${draftFor.item}`
              }
              id="nudge-draft-text"
            />
            <div className="row-actions mt-2">
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const el = document.getElementById(
                    "nudge-draft-text",
                  ) as HTMLTextAreaElement | null;
                  void navigator.clipboard.writeText(el?.value ?? "");
                }}
              >
                Copy draft
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  addTodo({
                    title: `Follow up: ${draftFor.item}`,
                    projectId: draftFor.projectId ?? null,
                    detail: draftFor.suggestedMessage,
                  });
                  setDraftFor(null);
                }}
              >
                Add to To Do
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
