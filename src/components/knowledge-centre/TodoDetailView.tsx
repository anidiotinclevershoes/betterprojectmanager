"use client";

import type { Ref } from "react";
import { ReviewPersonAvatar } from "@/components/capture/review/DomainMark";
import { DomainBadge } from "@/components/domain/DomainIcon";
import {
  formatDueLabel,
  formatShortDayMonth,
} from "@/lib/knowledge-centre/format-date-label";
import type { HistoryEvent } from "@/lib/types";
import "@/components/capture/review/review-cards.css";

/**
 * Page 09 To Do — detail · working (798:9301).
 * Domain badge is the signed To Do mark (824:9624).
 * Presentation over one TodoItem. This screen does not edit.
 */
export function TodoDetailView({
  title,
  done,
  dueAt,
  createdAt,
  detail,
  waitingOn,
  waitingPersonName,
  tags,
  history,
  historyNotice,
  onBack,
  onClose,
  onToggle,
  onRemove,
  backRef,
}: {
  title: string;
  done: boolean;
  dueAt?: string | null;
  createdAt?: string | null;
  detail?: string | null;
  waitingOn?: string | null;
  waitingPersonName?: string | null;
  tags: string[];
  history: HistoryEvent[];
  historyNotice: string;
  onBack: () => void;
  onClose: () => void;
  onToggle: () => void;
  onRemove: () => void;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const due = dueAt ? formatDueLabel(dueAt) : null;
  const dueValue = due ? formatShortDayMonth(dueAt ?? "") : null;
  const added = createdAt ? formatShortDayMonth(createdAt) : null;
  const detailText = detail?.trim() ?? "";
  const waiting = waitingOn?.trim() ?? "";

  return (
    <>
      <div className="issue-detail-top">
        <button
          ref={backRef}
          type="button"
          className="issue-detail-back"
          onClick={onBack}
          data-testid="ocean-item-detail-back"
        >
          ← Back
        </button>
        <button
          type="button"
          className="issue-detail-close"
          aria-label="Close"
          onClick={onClose}
          data-testid="todo-detail-dismiss"
        >
          ×
        </button>
      </div>

      <div className="issue-detail-scroll" data-testid="todo-detail">
        <DomainBadge domain="todo" label="To Do" />
        <h2 className="issue-detail-title" data-testid="todo-detail-title">
          {title}
        </h2>
        <p
          className={`todo-detail-status${done ? " is-completed" : ""}`}
          data-testid="todo-detail-status"
        >
          {done ? "Completed" : "Open"}
        </p>

        <section className="issue-detail-section" data-testid="todo-detail-details">
          <h3>Details</h3>
          <dl>
            {due && dueValue ? (
              <div className="issue-detail-row">
                <dt>Due</dt>
                <dd data-testid="todo-detail-due">{dueValue}</dd>
              </div>
            ) : null}
            {added ? (
              <div className="issue-detail-row">
                <dt>Added</dt>
                <dd data-testid="todo-detail-added">{added}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="issue-detail-section" data-testid="todo-detail-tags">
          <h3>Tags</h3>
          {tags.length ? (
            <ul className="issue-detail-tags">
              {tags.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="issue-detail-quiet">No tags yet.</p>
          )}
        </section>

        {waiting ? (
          <section className="issue-detail-section" data-testid="todo-detail-waiting">
            <h3>Waiting on</h3>
            <div className="todo-detail-waiting-row">
              {waitingPersonName ? (
                <ReviewPersonAvatar name={waitingPersonName} />
              ) : null}
              <p data-testid="todo-detail-waiting-value">{waiting}</p>
            </div>
          </section>
        ) : null}

        {detailText ? (
          <section className="issue-detail-section" data-testid="todo-detail-body">
            <h3>Detail</h3>
            <div className="issue-detail-notes">
              <span className="issue-detail-accent" aria-hidden />
              <p data-testid="todo-detail-body-text">{detailText}</p>
            </div>
          </section>
        ) : null}

        <p className="issue-detail-quiet" data-testid="todo-detail-provenance">
          To-dos do not carry Capture provenance in V1; only the durable todo
          record is shown.
        </p>

        <section className="issue-detail-section" data-testid="todo-detail-history">
          <h3>History</h3>
          {history.length ? (
            <ol className="issue-detail-history">
              {history.map((event) => (
                <li key={event.id}>
                  <p className="issue-detail-history-line">
                    {[event.title, event.detail].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="issue-detail-quiet" data-testid="ocean-item-history-limited">
            {historyNotice}
          </p>
        </section>
      </div>

      <footer className="issue-detail-footer" data-testid="todo-detail-actions">
        {done ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="todo-detail-reopen"
            onClick={onToggle}
          >
            Reopen To Do
          </button>
        ) : (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="todo-detail-close"
            onClick={onToggle}
          >
            Close
          </button>
        )}
        <button
          type="button"
          className="todo-detail-remove"
          data-testid="todo-detail-remove"
          onClick={onRemove}
        >
          Remove
        </button>
        <p className="issue-detail-hint">
          Close completes this To Do and keeps the record. Remove deletes it
          from the project.
        </p>
      </footer>
    </>
  );
}
