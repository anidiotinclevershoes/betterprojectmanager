"use client";

import { useEffect, useId, useState, type Ref } from "react";
import { ReviewPersonAvatar } from "@/components/capture/review/DomainMark";
import { DomainBadge } from "@/components/domain/DomainIcon";
import {
  formatDueLabel,
  formatShortDayMonth,
} from "@/lib/knowledge-centre/format-date-label";
import { dueAtForEdit } from "@/lib/todos/todo-edit";
import type { HistoryEvent } from "@/lib/types";
import "@/components/capture/review/review-cards.css";

/**
 * Page 09 To Do — detail · working (798:9301).
 * Domain badge is the signed To Do mark (824:9624).
 * Presentation over one TodoItem. Edit saves through the parent.
 */
export function TodoDetailView({
  title,
  done,
  dueAt,
  createdAt,
  detail,
  waitingOn,
  waitingPersonName,
  waitingOnPersonIds,
  people,
  tags,
  history,
  historyNotice,
  onBack,
  onClose,
  onToggle,
  onRemove,
  onSave,
  backRef,
}: {
  title: string;
  done: boolean;
  dueAt?: string | null;
  createdAt?: string | null;
  detail?: string | null;
  waitingOn?: string | null;
  waitingPersonName?: string | null;
  waitingOnPersonIds: string[];
  people: Array<{ id: string; name: string; role: string }>;
  tags: string[];
  history: HistoryEvent[];
  historyNotice: string;
  onBack: () => void;
  onClose: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onSave: (input: {
    title: string;
    detail: string | null;
    dueAt: string | null;
    waitingOn: string | null;
    waitingOnPersonIds: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDetail, setDraftDetail] = useState(detail ?? "");
  const [draftDue, setDraftDue] = useState(dueAt?.slice(0, 10) ?? "");
  const [draftWaiting, setDraftWaiting] = useState(waitingOn ?? "");
  const [draftPeople, setDraftPeople] = useState(waitingOnPersonIds);

  useEffect(() => {
    if (editing) return;
    setDraftTitle(title);
    setDraftDetail(detail ?? "");
    setDraftDue(dueAt?.slice(0, 10) ?? "");
    setDraftWaiting(waitingOn ?? "");
    setDraftPeople(waitingOnPersonIds);
  }, [editing, title, detail, dueAt, waitingOn, waitingOnPersonIds]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setEditing(false);
      setError(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing, saving]);

  const due = dueAt ? formatDueLabel(dueAt) : null;
  const dueValue = due ? formatShortDayMonth(dueAt ?? "") : null;
  const added = createdAt ? formatShortDayMonth(createdAt) : null;
  const detailText = detail?.trim() ?? "";
  const waiting = waitingOn?.trim() ?? "";
  const linkedPeople = people.filter((person) =>
    waitingOnPersonIds.includes(person.id),
  );

  function togglePerson(personId: string) {
    setDraftPeople((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const saved = await onSave({
      title: draftTitle,
      detail: draftDetail.trim() ? draftDetail : null,
      dueAt: dueAtForEdit(dueAt ?? undefined, draftDue),
      waitingOn: draftWaiting,
      waitingOnPersonIds: draftPeople,
    });
    setSaving(false);
    if (!saved.ok) {
      setError(saved.error ?? "Could not save the To Do");
      return;
    }
    setEditing(false);
  }

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

      <div
        className={`issue-detail-scroll${editing ? " issue-edit-scroll" : ""}`}
        data-testid="todo-detail"
      >
        <DomainBadge domain="todo" label="To Do" />
        {editing ? (
          <form
            data-testid="todo-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2 className="issue-edit-heading">Edit To Do</h2>
            <p className="issue-edit-helper">Changes must be saved to take effect</p>
            <label className="issue-edit-label" htmlFor={titleId}>
              Title
            </label>
            <input
              id={titleId}
              className="issue-edit-input"
              data-testid="todo-edit-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
            />
            <label className="issue-edit-label" htmlFor={`${titleId}-detail`}>
              Detail
            </label>
            <textarea
              id={`${titleId}-detail`}
              className="issue-edit-notes"
              data-testid="todo-edit-detail"
              value={draftDetail}
              onChange={(event) => setDraftDetail(event.target.value)}
            />
            <label className="issue-edit-label" htmlFor={`${titleId}-due`}>
              Due
            </label>
            <input
              id={`${titleId}-due`}
              className="issue-edit-input"
              type="date"
              data-testid="todo-edit-due"
              value={draftDue}
              onChange={(event) => setDraftDue(event.target.value)}
            />
            <label className="issue-edit-label" htmlFor={`${titleId}-waiting`}>
              Saved waiting note
            </label>
            <input
              id={`${titleId}-waiting`}
              className="issue-edit-input"
              data-testid="todo-edit-waiting-note"
              value={draftWaiting}
              onChange={(event) => setDraftWaiting(event.target.value)}
            />
            <p className="issue-edit-helper">
              Kept as written. Choosing people does not rewrite this note.
            </p>
            <fieldset className="issue-detail-section" data-testid="todo-edit-people">
              <legend className="issue-edit-label">Waiting on</legend>
              {people.length ? (
                people.map((person) => (
                  <label key={person.id} className="issue-edit-helper">
                    <input
                      type="checkbox"
                      data-testid={`todo-edit-person-${person.id}`}
                      checked={draftPeople.includes(person.id)}
                      onChange={() => togglePerson(person.id)}
                    />{" "}
                    {person.name}
                    {person.role ? ` · ${person.role}` : ""}
                  </label>
                ))
              ) : (
                <p className="issue-detail-quiet">No people in this project yet.</p>
              )}
            </fieldset>
            {error ? (
              <p className="issue-edit-error" data-testid="todo-edit-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <h2 className="issue-detail-title" data-testid="todo-detail-title">
            {title}
          </h2>
        )}
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

        {linkedPeople.length && !editing ? (
          <section className="issue-detail-section" data-testid="todo-detail-waiting-people">
            <h3>Waiting on</h3>
            <ul className="person-detail-list">
              {linkedPeople.map((person) => (
                <li key={person.id}>{person.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {waiting && !editing ? (
          <section className="issue-detail-section" data-testid="todo-detail-waiting">
            <h3>{linkedPeople.length ? "Saved waiting note" : "Waiting on"}</h3>
            <div className="todo-detail-waiting-row">
              {waitingPersonName ? (
                <ReviewPersonAvatar name={waitingPersonName} />
              ) : null}
              <p data-testid="todo-detail-waiting-value">{waiting}</p>
            </div>
          </section>
        ) : null}

        {detailText && !editing ? (
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
        {editing ? (
          <div className="issue-edit-actions">
            <button
              type="button"
              className="issue-edit-discard"
              data-testid="todo-edit-discard"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="issue-edit-save"
              data-testid="todo-edit-save"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : null}
        {!editing ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="todo-detail-edit"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
          >
            Edit To Do
          </button>
        ) : null}
        {!editing && done ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="todo-detail-reopen"
            onClick={onToggle}
          >
            Reopen To Do
          </button>
        ) : null}
        {!editing && !done ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="todo-detail-close"
            onClick={onToggle}
          >
            Close
          </button>
        ) : null}
        {!editing ? (
          <button
            type="button"
            className="todo-detail-remove"
            data-testid="todo-detail-remove"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
        <p className="issue-detail-hint">
          Close completes this To Do and keeps the record. Remove deletes it
          from the project.
        </p>
      </footer>
    </>
  );
}
