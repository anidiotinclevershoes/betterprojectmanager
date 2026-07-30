"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { buildNudgeItems, type NudgeItem } from "@/lib/workspace/frames-data";
import type { FrameSize } from "@/lib/workspace/layout";
import {
  isInteractiveTarget,
  itemLimitFor,
} from "@/lib/workspace/packing";
import { useMission } from "@/lib/store";

const RESOLVE_FADE_MS = 700;

export function NudgeFrame({
  projectId,
  size = "compact",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
}) {
  const { state, dismissSuggestion, addTodo } = useMission();
  const [pendingDue, setPendingDue] = useState<Record<string, boolean>>({});
  const [dueDraft, setDueDraft] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [draftFor, setDraftFor] = useState<NudgeItem | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const limit = itemLimitFor(size);

  const allItems = useMemo(
    () =>
      buildNudgeItems(state, projectId ?? undefined).filter(
        (i) => !removed[i.id],
      ),
    [state, projectId, removed],
  );

  const items = allItems.slice(0, limit);
  const overflow = allItems.length > limit;

  function beginResolve(item: NudgeItem) {
    setResolving((prev) => ({ ...prev, [item.id]: true }));
    window.setTimeout(() => {
      setRemoved((prev) => ({ ...prev, [item.id]: true }));
      setResolving((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (item.source === "recommendation") {
        dismissSuggestion(item.id.replace(/^rec-/, ""));
      }
    }, RESOLVE_FADE_MS);
  }

  function scheduleFollowUp(item: NudgeItem, date: string) {
    if (!date) return;
    addTodo({
      title: `Follow up: ${item.item}`,
      projectId: item.projectId ?? null,
      dueAt: date,
      detail: item.suggestedMessage,
    });
    setPendingDue((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    beginResolve(item);
  }

  return (
    <div className="frame-body">
      {allItems.length === 0 ? (
        <p className="empty-copy">
          Nothing is currently waiting on a response.
        </p>
      ) : (
        <>
          <ul className="frame-list">
            {items.map((item) => (
              <NudgeRow
                key={item.id}
                item={item}
                resolving={Boolean(resolving[item.id])}
                showDue={Boolean(pendingDue[item.id])}
                dueValue={dueDraft[item.id] ?? ""}
                onDueValue={(v) =>
                  setDueDraft((prev) => ({ ...prev, [item.id]: v }))
                }
                onOpenDraft={() => setDraftFor(item)}
                onToggleDue={() =>
                  setPendingDue((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }))
                }
                onSchedule={(date) => scheduleFollowUp(item, date)}
                onResolve={() => beginResolve(item)}
              />
            ))}
          </ul>
          {overflow ? (
            <div className="frame-footer">
              <span className="meta">
                Showing {items.length} of {allItems.length}
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
        title="All nudges"
      >
        <ul className="frame-list">
          {allItems.map((item) => (
            <NudgeRow
              key={item.id}
              item={item}
              resolving={Boolean(resolving[item.id])}
              showDue={Boolean(pendingDue[item.id])}
              dueValue={dueDraft[item.id] ?? ""}
              onDueValue={(v) =>
                setDueDraft((prev) => ({ ...prev, [item.id]: v }))
              }
              onOpenDraft={() => {
                setViewAll(false);
                setDraftFor(item);
              }}
              onToggleDue={() =>
                setPendingDue((prev) => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
              onSchedule={(date) => scheduleFollowUp(item, date)}
              onResolve={() => beginResolve(item)}
            />
          ))}
        </ul>
      </DetailModal>

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

function NudgeRow({
  item,
  resolving,
  showDue,
  dueValue,
  onDueValue,
  onOpenDraft,
  onToggleDue,
  onSchedule,
  onResolve,
}: {
  item: NudgeItem;
  resolving: boolean;
  showDue: boolean;
  dueValue: string;
  onDueValue: (v: string) => void;
  onOpenDraft: () => void;
  onToggleDue: () => void;
  onSchedule: (date: string) => void;
  onResolve: () => void;
}) {
  return (
    <li
      className={`nudge-row is-card-clickable ${resolving ? "is-resolving" : ""}`}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        onOpenDraft();
      }}
    >
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
        <button type="button" className="ghost-btn" onClick={onOpenDraft}>
          Draft follow-up
        </button>
        <button type="button" className="ghost-btn" onClick={onToggleDue}>
          Change Due Date
        </button>
        <button type="button" className="ghost-btn" onClick={onResolve}>
          Resolved
        </button>
      </div>
      {showDue ? (
        <div className="nudge-due-row" data-no-card-click>
          <input
            type="date"
            value={dueValue}
            onChange={(e) => onDueValue(e.target.value)}
            aria-label="Next follow-up date"
          />
          <button
            type="button"
            className="primary-btn"
            disabled={!dueValue}
            onClick={() => onSchedule(dueValue)}
          >
            Schedule
          </button>
        </div>
      ) : null}
    </li>
  );
}
