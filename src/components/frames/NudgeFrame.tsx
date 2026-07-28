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
  const items = useMemo(
    () => buildNudgeItems(state, projectId ?? undefined),
    [state, projectId],
  );

  const markChased = (item: NudgeItem) => {
    setChased((prev) => ({
      ...prev,
      [item.id]: new Date().toISOString().slice(0, 10),
    }));
  };

  return (
    <div className="frame-body">
      {items.length === 0 ? (
        <p className="empty-copy">
          Nothing is currently waiting on a response.
        </p>
      ) : (
        <ul className="frame-list">
          {items.map((item) => (
            <li key={item.id} className="nudge-card">
              <div className="prep-card-top">
                <p className="frame-row-title">
                  {item.person}
                  {item.projectCode ? (
                    <span className="tag">{item.projectCode}</span>
                  ) : null}
                </p>
                <span className={`urgency urgency-${item.urgency}`}>
                  {item.urgency}
                </span>
              </div>
              <p className="meta">{item.item}</p>
              <p className="meta">
                {item.daysWaiting > 0
                  ? `Waiting ${item.daysWaiting}d`
                  : "Follow-up"}
                {chased[item.id] ? ` · chased ${chased[item.id]}` : ""}
              </p>
              <div className="row-actions">
                <button type="button" className="ghost-btn" onClick={() => markChased(item)}>
                  Mark chased
                </button>
                {item.suggestedMessage ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      void navigator.clipboard.writeText(item.suggestedMessage!)
                    }
                  >
                    Copy follow-up
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    addTodo({
                      title: `Follow up: ${item.item}`,
                      projectId: item.projectId ?? null,
                      detail: item.suggestedMessage,
                    })
                  }
                >
                  To Do
                </button>
                {item.source === "recommendation" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      dismissSuggestion(item.id.replace(/^rec-/, ""))
                    }
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
