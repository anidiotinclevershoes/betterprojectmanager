"use client";

import { useState } from "react";
import { DomainIcon } from "@/components/domain/DomainIcon";
import type { LumeDomain } from "@/lib/domain/lume-domain";
import type { CaptureObservation } from "@/lib/capture/review/observations";

const GROUPS: { domain: LumeDomain; label: string }[] = [
  { domain: "people", label: "People" },
  { domain: "todo", label: "To Do" },
  { domain: "issue", label: "Issues" },
  { domain: "knowledge", label: "Knowledge" },
];

function domainOf(obs: CaptureObservation): LumeDomain | null {
  const label = obs.actionLabel.toLowerCase();
  if (/\b(person|people|stakeholder|availability)\b/.test(label)) return "people";
  if (/\b(to do|todo|action)\b/.test(label)) return "todo";
  if (/\b(issue|risk)\b/.test(label)) return "issue";
  if (/\b(knowledge|memory)\b/.test(label)) return "knowledge";
  return null;
}

export function CaptureSummary({
  observations,
  changesDetected,
  readyCount,
  needsAttentionCount,
  onSelectObservation,
}: {
  observations: CaptureObservation[];
  /** Unique validated project-state changes. */
  changesDetected: number;
  readyCount: number;
  /** Needs you + Unmatched. */
  needsAttentionCount: number;
  onSelectObservation?: (observation: CaptureObservation) => void;
}) {
  const [open, setOpen] = useState(true);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const uninterpreted = observations.filter(
    (obs) => obs.actionStatus === "no_change" || obs.actionStatus === "ignored",
  );
  const needs = observations.filter(
    (obs) =>
      obs.actionStatus === "needs_review" || obs.actionStatus === "unmatched",
  );
  const grouped = GROUPS.map((group) => ({
    ...group,
    items: observations.filter((obs) => domainOf(obs) === group.domain),
  })).filter((group) => group.items.length > 0);
  const ungrouped = observations.filter(
    (obs) =>
      !domainOf(obs) &&
      !uninterpreted.some((item) => item.id === obs.id) &&
      obs.actionStatus !== "needs_review" &&
      obs.actionStatus !== "unmatched",
  );

  return (
    <section
      className="capture-summary-panel lume-extracted-rail p09-extracted"
      aria-labelledby="capture-understood-title"
    >
      <header className="p09-extracted-head">
        <h3 id="capture-understood-title" className="p09-extracted-title">
          Lume extracted
        </h3>
        <button
          type="button"
          className="p09-extracted-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </header>

      {open ? (
        observations.length === 0 ? (
          <p className="meta" data-testid="capture-empty-review">
            Lume could not turn this Capture into a safe change. Nothing was
            written. This is Needs You, not a silent skip.
          </p>
        ) : (
          <div className="p09-extracted-body">
            {needs.length > 0 ? (
              <p className="p09-extracted-needs">
                {needs.length === 1
                  ? `1 reference Lume could not place — “${needs[0]!.text}”`
                  : `${needs.length} references Lume could not place`}
              </p>
            ) : null}
            {grouped.map((group) => {
              const closed = closedGroups[group.domain];
              return (
                <section key={group.domain} className="p09-extracted-group">
                  <button
                    type="button"
                    className="p09-extracted-group-head"
                    aria-expanded={!closed}
                    onClick={() =>
                      setClosedGroups((prev) => ({
                        ...prev,
                        [group.domain]: !prev[group.domain],
                      }))
                    }
                  >
                    <DomainIcon domain={group.domain} />
                    <span>{group.label}</span>
                    <span className="p09-extracted-count">{group.items.length}</span>
                  </button>
                  {closed ? null : (
                    <ul className="p09-extracted-items">
                      {group.items.map((obs) => (
                        <li key={obs.id}>{observationLine(obs, onSelectObservation)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            {ungrouped.length > 0 ? (
              <ul className="p09-extracted-items">
                {ungrouped.map((obs) => (
                  <li key={obs.id}>{observationLine(obs, onSelectObservation)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}

      <p className="capture-summary-line sr-only" role="status">
        <span>
          {changesDetected} change{changesDetected === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>{readyCount} ready</span>
        <span aria-hidden>·</span>
        <span>
          {needsAttentionCount} need{needsAttentionCount === 1 ? "s" : ""} you
        </span>
      </p>
    </section>
  );
}

function observationLine(
  obs: CaptureObservation,
  onSelectObservation?: (observation: CaptureObservation) => void,
) {
  const clickable = Boolean(obs.reviewCardId && onSelectObservation);
  if (!clickable) return <span>{obs.text}</span>;
  return (
    <button type="button" onClick={() => onSelectObservation?.(obs)}>
      {obs.text}
    </button>
  );
}
