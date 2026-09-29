"use client";

import type { Ref } from "react";
import { DomainBadge } from "@/components/domain/DomainIcon";
import {
  formatIssueStamp,
  issueHistoryLine,
  issueLifecycleAction,
  issueStatusLabel,
} from "@/lib/knowledge-centre/issue-detail-presentation";
import type { HistoryEvent } from "@/lib/types";
import type { KnowledgeDetailRelation } from "@/lib/knowledge-centre/knowledge-item-detail";
import type { RiskStatus } from "@/types/database";

/**
 * Page 09 Section M Issue detail, for a genuine Risk row only.
 * Title, Notes, and tags are read-only here. Edit Issue stays unmounted.
 * The atomic Issue save exists, and this screen does not call it yet.
 */
export function IssueDetailView({
  title,
  status,
  createdAt,
  updatedAt,
  notes,
  tags,
  history,
  historyNotice,
  relations,
  onBack,
  onClose,
  onResolve,
  onReopen,
  backRef,
}: {
  title: string;
  status: RiskStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes: string | null;
  tags: string[];
  history: HistoryEvent[];
  historyNotice: string;
  relations: KnowledgeDetailRelation[];
  onBack: () => void;
  onClose: () => void;
  onResolve: () => void;
  onReopen: () => void;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const action = issueLifecycleAction(status);
  const added = formatIssueStamp(createdAt, false);
  const updated = formatIssueStamp(updatedAt, true);
  const resolvedWhen =
    status === "resolved" ? formatIssueStamp(updatedAt, false) : null;

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
          data-testid="issue-detail-close"
        >
          ×
        </button>
      </div>

      <div className="issue-detail-scroll">
        <DomainBadge domain="issue" label="Issue" />
        <h2 className="issue-detail-title" data-testid="issue-detail-title">
          {title}
        </h2>
        {status === "resolved" ? (
          <p className="issue-detail-resolved" data-testid="issue-detail-resolved">
            {resolvedWhen ? `Resolved · ${resolvedWhen}` : "Resolved"}
          </p>
        ) : null}

        <section className="issue-detail-section" data-testid="issue-detail-details">
          <h3>Details</h3>
          <dl>
            <div className="issue-detail-row">
              <dt>Status</dt>
              <dd data-testid="issue-detail-status">{issueStatusLabel(status)}</dd>
            </div>
            <div className="issue-detail-row">
              <dt>Added</dt>
              <dd>{added ?? "Not recorded"}</dd>
            </div>
            <div className="issue-detail-row">
              <dt>Last updated</dt>
              <dd>{updated ?? "Not recorded"}</dd>
            </div>
          </dl>
        </section>

        <section className="issue-detail-section" data-testid="issue-detail-tags">
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

        <section className="issue-detail-section" data-testid="issue-detail-notes">
          <h3>Notes</h3>
          {notes ? (
            <div className="issue-detail-notes">
              <span className="issue-detail-accent" aria-hidden />
              <p data-testid="issue-detail-notes-body">{notes}</p>
            </div>
          ) : (
            <p className="issue-detail-quiet" data-testid="issue-detail-notes-empty">
              No notes yet.
            </p>
          )}
        </section>

        {relations.length ? (
          <section className="issue-detail-section" data-testid="issue-detail-related">
            <h3>Related</h3>
            <ul>
              {relations.map((relation) => (
                <li key={`${relation.kind}-${relation.id}`}>{relation.label}</li>
              ))}
            </ul>
          </section>
        ) : null}

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
              history.length
                ? "issue-detail-history-limit"
                : "issue-detail-quiet"
            }
            data-testid="ocean-item-history-limited"
          >
            {historyNotice}
          </p>
        </section>
      </div>

      <footer className="issue-detail-footer" data-testid="issue-detail-actions">
        {action === "resolve" ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="issue-detail-resolve"
            onClick={onResolve}
          >
            Resolve issue
          </button>
        ) : null}
        {action === "reopen" ? (
          <button
            type="button"
            className="issue-detail-action"
            data-testid="issue-detail-reopen"
            onClick={onReopen}
          >
            Reopen issue
          </button>
        ) : null}
        {action === "resolve" ? (
          <p className="issue-detail-hint">
            Resolve removes this from current Issues and keeps its history.
          </p>
        ) : null}
        {action === "reopen" ? (
          <p className="issue-detail-hint">
            Resolved issues stay in project history. Reopen if this becomes
            current again.
          </p>
        ) : null}
      </footer>
    </>
  );
}
