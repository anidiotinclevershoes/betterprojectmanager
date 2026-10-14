"use client";

import { useEffect, useId, useRef } from "react";
import type { Ref } from "react";
import { DomainBadge } from "@/components/domain/DomainIcon";
import { ItemTagsEditor } from "@/components/knowledge-centre/ItemTagsEditor";
import {
  issueHistoryLine,
} from "@/lib/knowledge-centre/issue-detail-presentation";
import { ISSUE_EDIT_LOCK } from "@/lib/knowledge-centre/issue-editor-state";
import type { HistoryEvent } from "@/lib/types";
import type { ProjectTag } from "@/lib/tags";

/**
 * Page 09 Issue edit. Draft presentation only.
 * Persistence stays in the drawer parent. This view does not write.
 */
export function IssueEditView({
  title,
  notes,
  tagNames,
  projectTags,
  history,
  historyNotice,
  saving,
  error,
  lockAnnounced,
  announceTick,
  onTitle,
  onNotes,
  onTags,
  onSave,
  onDiscard,
  onBlockedExit,
  backRef,
}: {
  title: string;
  notes: string;
  tagNames: string[];
  projectTags: ProjectTag[];
  history: HistoryEvent[];
  historyNotice: string;
  saving: boolean;
  error: string | null;
  lockAnnounced: boolean;
  announceTick: number;
  onTitle: (value: string) => void;
  onNotes: (value: string) => void;
  onTags: (names: string[]) => void;
  onSave: () => void;
  onDiscard: () => void;
  onBlockedExit: () => void;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const titleId = useId();
  const notesId = useId();
  const tagsLabelId = useId();
  const errorId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (lockAnnounced) lockRef.current?.focus();
  }, [lockAnnounced, announceTick]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  return (
    <>
      <div className="issue-detail-top">
        <button
          ref={backRef}
          type="button"
          className="issue-detail-back"
          onClick={onBlockedExit}
          data-testid="ocean-item-detail-back"
        >
          ← Back
        </button>
        <button
          type="button"
          className="issue-detail-close"
          aria-label="Close"
          onClick={onBlockedExit}
          data-testid="issue-detail-close"
        >
          ×
        </button>
      </div>

      <div className="issue-detail-scroll issue-edit-scroll" data-testid="issue-edit">
        <DomainBadge domain="issue" label="Issue" />
        <h2 className="issue-edit-heading" data-testid="issue-edit-heading">
          Edit Issue
        </h2>
        <p className="issue-edit-helper">Changes must be saved to take effect</p>

        <p
          ref={lockRef}
          tabIndex={-1}
          className={`issue-edit-lock${lockAnnounced ? " is-announced" : ""}`}
          data-testid="issue-edit-lock"
          data-lock-announced={lockAnnounced ? "true" : "false"}
        >
          <span className="issue-edit-lock-mark" aria-hidden>
            !
          </span>
          {lockAnnounced ? (
            <span className="issue-edit-lock-flag">Locked</span>
          ) : null}
          <span>{ISSUE_EDIT_LOCK}</span>
        </p>
        {lockAnnounced ? (
          <p key={announceTick} className="sr-only" role="alert">
            {ISSUE_EDIT_LOCK}
          </p>
        ) : null}

        <label className="issue-edit-label" htmlFor={titleId}>
          Title
        </label>
        <input
          ref={titleRef}
          id={titleId}
          className="issue-edit-input"
          data-testid="issue-edit-title"
          value={title}
          disabled={saving}
          aria-invalid={error?.toLowerCase().includes("title") ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          onChange={(event) => onTitle(event.target.value)}
        />

        <label className="issue-edit-label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="issue-edit-notes"
          data-testid="issue-edit-notes"
          value={notes}
          disabled={saving}
          onChange={(event) => onNotes(event.target.value)}
        />

        <p className="issue-edit-label" id={tagsLabelId}>
          Tags
        </p>
        <ItemTagsEditor
          projectTags={projectTags}
          value={tagNames}
          onChange={onTags}
          disabled={saving}
          showKindLabel
          labelledBy={tagsLabelId}
        />

        <p className="issue-edit-discard-note" data-testid="issue-edit-discard-note">
          Discard restores the saved title, notes and tags.
        </p>

        {error ? (
          <p
            ref={errorRef}
            id={errorId}
            className="issue-edit-error"
            role="alert"
            data-testid="issue-edit-error"
          >
            Error: {error}
          </p>
        ) : null}

        <div className="issue-edit-actions">
          <button
            type="button"
            className="issue-edit-discard"
            data-testid="issue-edit-discard"
            disabled={saving}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="issue-edit-save"
            data-testid="issue-edit-save"
            disabled={saving}
            aria-busy={saving ? true : undefined}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        <section className="issue-detail-section" data-testid="issue-detail-history">
          <h3>History</h3>
          {history.length ? (
            <ol className="issue-detail-history">
              {history.map((event) => {
                const line = issueHistoryLine(event);
                return (
                  <li key={event.id}>
                    <p className="issue-detail-history-line">
                      {[line.when, line.title].filter(Boolean).join(" · ")}
                    </p>
                    {line.detail ? (
                      <p className="issue-detail-history-detail">{line.detail}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          <p
            className={
              history.length ? "issue-detail-history-limit" : "issue-detail-quiet"
            }
            data-testid="ocean-item-history-limited"
          >
            {historyNotice}
          </p>
        </section>
      </div>
    </>
  );
}
