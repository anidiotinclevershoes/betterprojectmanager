"use client";

import type { ReactNode, Ref } from "react";
import { DomainBadge } from "@/components/domain/DomainIcon";
import { formatShortDayMonth } from "@/lib/knowledge-centre/format-date-label";
import type {
  PersonAvailabilityView,
  PersonResponsibilityView,
} from "@/lib/people/identity";
import type { HistoryEvent } from "@/lib/types";

/**
 * Page 09 Person — detail · working (798:9587).
 * Domain badge is the signed Person mark (824:9660).
 * Presentation over the existing Person bundle. This screen does not save.
 */
export function PersonDetailView({
  name,
  role,
  lastContactAt,
  currentResponsibilities,
  historicalResponsibilities,
  sharedScopes,
  availability,
  waitingLines,
  legacyContext,
  history,
  historyNotice,
  onBack,
  onClose,
  onAddResponsibility,
  onHandover,
  ownerSlot,
  backRef,
}: {
  name: string;
  role: string;
  lastContactAt?: string | null;
  currentResponsibilities: PersonResponsibilityView[];
  historicalResponsibilities: PersonResponsibilityView[];
  sharedScopes: Array<{ scope: string; coOwnerNames: string[] }>;
  availability: PersonAvailabilityView[];
  waitingLines: string[];
  legacyContext: string[];
  history: HistoryEvent[];
  historyNotice: string;
  onBack: () => void;
  onClose: () => void;
  onAddResponsibility: () => void;
  onHandover: (scope: string) => void;
  ownerSlot?: ReactNode;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const roleLabel = role.trim();
  const contactRaw = lastContactAt?.trim() ?? "";
  const lastContact = contactRaw
    ? (formatShortDayMonth(contactRaw) ?? contactRaw)
    : null;
  const availabilityLines = availability
    .map((row) => row.body.trim())
    .filter(Boolean);
  const sharedByScope = new Map(sharedScopes.map((row) => [row.scope, row]));

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
          data-testid="person-detail-close"
        >
          ×
        </button>
      </div>

      <div className="issue-detail-scroll" data-testid="person-detail">
        <DomainBadge domain="people" label="Person" />
        <h2 className="issue-detail-title" data-testid="person-detail-name">
          {name}
        </h2>
        <p
          className={`person-detail-role${roleLabel ? "" : " is-absent"}`}
          data-testid="person-detail-role"
        >
          {roleLabel || "No role recorded."}
        </p>

        <section className="issue-detail-section" data-testid="person-detail-details">
          <h3>Details</h3>
          <dl>
            <div className="issue-detail-row">
              <dt>Role</dt>
              <dd>{roleLabel || "No role recorded."}</dd>
            </div>
            {lastContact ? (
              <div className="issue-detail-row">
                <dt>Last contact</dt>
                <dd data-testid="person-detail-last-contact">{lastContact}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section
          className="issue-detail-section"
          data-testid="person-detail-responsibilities"
        >
          <h3>Responsibilities</h3>
          {currentResponsibilities.length ? (
            currentResponsibilities.map((row) => {
              const shared = sharedByScope.get(row.scope);
              const coOwners = shared?.coOwnerNames.filter(Boolean) ?? [];
              return (
                <div key={row.item.id} className="person-detail-responsibility">
                  <span className="issue-detail-accent" aria-hidden />
                  <div>
                    <p data-testid="person-detail-responsibility">
                      {row.scope}
                      {coOwners.length ? (
                        <span data-testid="person-detail-shared">
                          {` · Shared with ${coOwners.join(", ")}`}
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      className="person-detail-handover"
                      data-testid={`ocean-item-detail-handover-${row.item.id}`}
                      onClick={() => onHandover(row.scope)}
                    >
                      Hand over {row.scope}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="issue-detail-quiet">No current responsibilities.</p>
          )}
          {historicalResponsibilities.length ? (
            <div data-testid="person-detail-previous">
              <h4 className="person-detail-subhead">Previous responsibilities</h4>
              <ul className="person-detail-list">
                {historicalResponsibilities.map((row) => (
                  <li key={row.item.id}>{row.scope}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {availabilityLines.length ? (
          <section className="issue-detail-section" data-testid="person-detail-availability">
            <h3>Availability</h3>
            <ul className="person-detail-list">
              {availabilityLines.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {waitingLines.length ? (
          <section className="issue-detail-section" data-testid="person-detail-waiting">
            <h3>Waiting on them</h3>
            <ul className="person-detail-list">
              {waitingLines.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {legacyContext.length ? (
          <section className="issue-detail-section" data-testid="person-detail-legacy">
            <h3>Older people notes</h3>
            <p className="issue-detail-quiet">
              Older People-section prose. Not this person&apos;s role,
              responsibilities, availability, or history.
            </p>
            <ul className="person-detail-list">
              {legacyContext.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="issue-detail-section" data-testid="person-detail-history">
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

      {ownerSlot ? <div className="person-detail-owner">{ownerSlot}</div> : null}

      <footer className="issue-detail-footer" data-testid="person-detail-actions">
        <button
          type="button"
          className="issue-detail-action"
          data-testid="person-detail-add"
          onClick={onAddResponsibility}
        >
          Add responsibility
        </button>
        <p className="issue-detail-hint">
          Responsibilities use the explicit share / replace flow.
        </p>
      </footer>
    </>
  );
}
