"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useFrameExpand } from "@/components/workspace/FrameExpandContext";
import { FRAME_TRANSITION_MS, isValidDateInput } from "@/lib/dates";
import { buildNudgeItems, type NudgeItem } from "@/lib/workspace/frames-data";
import type { FrameSize } from "@/lib/workspace/layout";
import {
  isInteractiveTarget,
  itemLimitFor,
} from "@/lib/workspace/packing";
import { useMission } from "@/lib/store";

export function NudgeFrame({
  projectId,
  size = "compact",
  frameId = "nudge",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
  frameId?: string;
}) {
  const { state, addTodo, resolveNudge, dismissSuggestion } = useMission();
  const { isExpanded, expand, collapse } = useFrameExpand();
  const expanded = isExpanded(frameId);

  const [pendingDue, setPendingDue] = useState<Record<string, boolean>>({});
  const [dueDraft, setDueDraft] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [draftFor, setDraftFor] = useState<NudgeItem | null>(null);
  const [editItem, setEditItem] = useState<NudgeItem | null>(null);
  const limit = itemLimitFor(size);

  const allItems = useMemo(
    () =>
      buildNudgeItems(state, projectId ?? undefined).filter(
        (i) => !removed[i.id],
      ),
    [state, projectId, removed],
  );

  const items = expanded ? allItems : allItems.slice(0, limit);
  const overflow = !expanded && allItems.length > limit;

  function beginResolve(item: NudgeItem) {
    if (resolving[item.id] || removed[item.id]) return;
    // History before the item disappears from the active frame.
    resolveNudge({
      nudgeId: item.id,
      person: item.person,
      subject: item.item,
      projectId: item.projectId,
      daysWaiting: item.daysWaiting,
      source:
        item.source === "recommendation" || item.source === "stakeholder"
          ? item.source
          : "stakeholder",
      recommendationId:
        item.source === "recommendation"
          ? item.id.replace(/^rec-/, "")
          : undefined,
    });
    setResolving((prev) => ({ ...prev, [item.id]: true }));
    window.setTimeout(() => {
      if (item.source === "recommendation") {
        dismissSuggestion(item.id.replace(/^rec-/, ""));
      }
      setRemoved((prev) => ({ ...prev, [item.id]: true }));
      setResolving((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }, FRAME_TRANSITION_MS);
  }

  function scheduleFollowUp(item: NudgeItem, date: string) {
    if (!date || !isValidDateInput(date)) return;
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
                onOpenEdit={() => setEditItem(item)}
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
          {overflow || expanded ? (
            <div className="frame-footer">
              <span className="meta">
                {expanded
                  ? `${allItems.length} nudges`
                  : `Showing ${items.length} of ${allItems.length}`}
              </span>
              {overflow ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => expand(frameId)}
                >
                  View all
                </button>
              ) : null}
              {expanded ? (
                <button type="button" className="ghost-btn" onClick={collapse}>
                  Collapse
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <DetailModal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title="Nudge"
      >
        {editItem ? (
          <div className="space-y-3">
            <label className="field">
              <span>Person / team</span>
              <input value={editItem.person} readOnly />
            </label>
            <label className="field">
              <span>Subject</span>
              <input value={editItem.item} readOnly />
            </label>
            <label className="field">
              <span>Project</span>
              <input value={editItem.projectCode ?? "—"} readOnly />
            </label>
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={dueDraft[editItem.id] ?? ""}
                onChange={(e) =>
                  setDueDraft((prev) => ({
                    ...prev,
                    [editItem.id]: e.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="capture-textarea"
                rows={3}
                defaultValue={editItem.suggestedMessage ?? ""}
                id="nudge-edit-notes"
              />
            </label>
            <div className="row-actions">
              <button
                type="button"
                className="primary-btn"
                disabled={!dueDraft[editItem.id]}
                onClick={() => {
                  const date = dueDraft[editItem.id];
                  if (!date) return;
                  scheduleFollowUp(editItem, date);
                  setEditItem(null);
                }}
              >
                Schedule follow-up
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  beginResolve(editItem);
                  setEditItem(null);
                }}
              >
                Mark resolved
              </button>
            </div>
          </div>
        ) : null}
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
  onOpenEdit,
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
  onOpenEdit: () => void;
  onToggleDue: () => void;
  onSchedule: (date: string) => void;
  onResolve: () => void;
}) {
  return (
    <li
      className={`nudge-row is-card-clickable frame-item-transition ${resolving ? "is-resolving is-completing" : ""}`}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        onOpenEdit();
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
            disabled={!dueValue || !isValidDateInput(dueValue)}
            onClick={() => onSchedule(dueValue)}
          >
            Schedule
          </button>
        </div>
      ) : null}
    </li>
  );
}
