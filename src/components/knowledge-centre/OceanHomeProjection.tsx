"use client";

import { useMemo, useState } from "react";
import { MeMark } from "@/components/brand/MeMark";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { TimelineFrame } from "@/components/frames/TimelineFrame";
import {
  WORKSPACE_PAGE_HEADINGS,
  WorkspacePageHeading,
} from "@/components/knowledge-centre/WorkspacePageHeading";
import {
  composeHomeProjection,
  partitionHomeQueue,
  type HomeQueueItem,
  type HomeQueueKind,
} from "@/lib/knowledge-centre/home-projection";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import type { KcComposedItem } from "@/lib/knowledge-centre/four-bucket";
import type { LumeDomain } from "@/lib/domain/lume-domain";
import { useMission } from "@/lib/store";
import "./ocean-home.css";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const AVATAR_COLORS = [
  "#2ea3c7",
  "#5d4bb8",
  "#78b833",
  "#db6338",
  "#9c7bd8",
  "#5cc8f2",
] as const;

function todayBandLabel(now: number): string {
  const d = new Date(now);
  return `TODAY · ${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function queueDomain(kind: HomeQueueKind): LumeDomain | null {
  if (kind === "todo") return "todo";
  if (kind === "issue") return "issue";
  if (kind === "date") return "knowledge";
  return null;
}

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export function OceanHomeProjection({
  projectId,
  onOpenDetails,
  onAddSuggestion,
  onAddTodo,
}: {
  projectId: string;
  onOpenDetails: (ref: KnowledgeItemRef) => void;
  onAddSuggestion: (recommendationId: string) => void;
  onAddTodo?: () => void;
}) {
  const { state, toggleTodo, dismissSuggestionDurable } = useMission();
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  // Page 09 populated Home shows Suggestions off. Toggle is presentation only.
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const home = useMemo(
    () => composeHomeProjection(state, projectId),
    [state, projectId],
  );
  const now = Date.now();
  const visibleQueue = showSuggestions
    ? home.queue
    : home.queue.filter((item) => item.kind !== "suggestion");
  const bands = partitionHomeQueue(visibleQueue, now);
  const showBands = bands.today.length > 0 || bands.next.length > 0;

  async function onDiscard(recommendationId: string) {
    setActionError(null);
    setDiscardingId(recommendationId);
    try {
      const result = await dismissSuggestionDurable(recommendationId);
      if (!result.ok) {
        setActionError(result.error ?? "Could not remember this dismissal.");
      }
    } finally {
      setDiscardingId(null);
    }
  }

  function AddTodoButton() {
    if (!onAddTodo) return null;
    return (
      <button
        type="button"
        className="ocean-home-action is-primary"
        data-testid="ocean-home-add-todo"
        aria-label="Add To Do"
        onClick={onAddTodo}
      >
        + Add
      </button>
    );
  }

  function QueueRows({ items }: { items: HomeQueueItem[] }) {
    return (
      <ul className="ocean-home-queue-list">
        {items.map((item) => {
          const domain = queueDomain(item.kind);
          if (item.kind === "suggestion" && item.recommendationId) {
            const provenance =
              item.supporting && /not a To Do yet/i.test(item.supporting)
                ? null
                : "Not a To Do yet";
            return (
              <li
                key={item.id}
                className="ocean-home-queue-item is-suggestion"
                data-testid={`ocean-home-queue-${item.kind}`}
              >
                <div className="ocean-home-suggestion-copy">
                  <p className="ocean-home-suggestion-kicker">
                    <span className="ocean-home-suggestion-mark">
                      <MeMark size="micro" />
                    </span>
                    Suggestion
                  </p>
                  <h3>{item.title}</h3>
                  {item.supporting ? <p>{item.supporting}</p> : null}
                  {provenance ? (
                    <p className="ocean-home-suggestion-note">{provenance}</p>
                  ) : null}
                </div>
                <div className="ocean-home-queue-actions">
                  <button
                    type="button"
                    className="ocean-home-action"
                    data-testid={`ocean-home-suggestion-discard-${item.recommendationId}`}
                    disabled={discardingId === item.recommendationId}
                    onClick={() => void onDiscard(item.recommendationId!)}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="ocean-home-action is-primary"
                    data-testid={`ocean-home-suggestion-add-${item.recommendationId}`}
                    onClick={() => onAddSuggestion(item.recommendationId!)}
                  >
                    Add
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={item.id}
              className={`ocean-home-queue-item is-${item.kind}`}
              data-testid={`ocean-home-queue-${item.kind}`}
              data-stays-issue={item.staysIssue ? "true" : undefined}
            >
              {domain ? <DomainIcon domain={domain} /> : <span />}
              <div className="ocean-home-queue-copy">
                <h3>{item.title}</h3>
                {item.supporting ? <p>{item.supporting}</p> : null}
                {item.needsYou ? (
                  <p className="ocean-home-needs">{item.needsYou}</p>
                ) : null}
              </div>
              <div className="ocean-home-queue-actions">
                {item.ref ? (
                  <button
                    type="button"
                    className="ocean-home-action"
                    data-testid={`ocean-home-open-${item.id}`}
                    onClick={() => onOpenDetails(item.ref!)}
                  >
                    Open Details
                  </button>
                ) : null}
                {item.kind === "todo" && item.todoId ? (
                  <button
                    type="button"
                    className="ocean-home-action"
                    data-testid={`ocean-home-close-${item.todoId}`}
                    onClick={() => toggleTodo(item.todoId!)}
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="ocean-home" data-testid="ocean-home">
      <WorkspacePageHeading {...WORKSPACE_PAGE_HEADINGS.home} />
      <div className="ocean-home-top">
        <section
          className="ocean-home-queue lume-domain-section"
          data-domain="todo"
          data-testid="ocean-home-queue"
          data-suggestions={showSuggestions ? "on" : "off"}
          aria-label="Working queue"
        >
          <header className="ocean-home-section-head lume-domain-section-head">
            <DomainIcon domain="todo" />
            <h2>To Do</h2>
            <span className="ocean-home-count">{visibleQueue.length}</span>
            <span className="ocean-home-head-spacer" />
            <button
              type="button"
              className={`ocean-home-suggestions${showSuggestions ? " is-on" : ""}`}
              aria-pressed={showSuggestions}
              data-testid="ocean-home-suggestions-toggle"
              onClick={() => setShowSuggestions((on) => !on)}
            >
              <span>Suggestions</span>
              <span className="ocean-home-switch" aria-hidden />
            </button>
            {bands.today.length === 0 ? <AddTodoButton /> : null}
          </header>
          <div className="lume-domain-section-body">
            {visibleQueue.length ? (
              <>
                {showBands && bands.today.length ? (
                  <div className="ocean-home-band">
                    <span>{todayBandLabel(now)}</span>
                    <AddTodoButton />
                  </div>
                ) : null}
                {bands.today.length ? <QueueRows items={bands.today} /> : null}
                {bands.ungrouped.length ? (
                  <QueueRows items={bands.ungrouped} />
                ) : null}
                {showBands && bands.next.length ? (
                  <div className="ocean-home-band">
                    <span>NEXT</span>
                  </div>
                ) : null}
                {bands.next.length ? <QueueRows items={bands.next} /> : null}
              </>
            ) : (
              <p className="ocean-home-empty">Nothing in the working queue.</p>
            )}
            {actionError ? (
              <p className="ocean-home-action-error" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="ocean-home-people lume-domain-section"
          data-domain="people"
          data-testid="ocean-home-people"
          aria-label="People"
        >
          <header className="ocean-home-section-head lume-domain-section-head">
            <DomainIcon domain="people" />
            <h2>People</h2>
            <span className="ocean-home-count">{home.people.length}</span>
          </header>
          <div className="lume-domain-section-body">
            {home.people.length ? (
              <ul>
                {home.people.map((person) => (
                  <li key={person.id}>
                    <PersonRow person={person} onOpenDetails={onOpenDetails} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ocean-home-empty">No people recorded yet.</p>
            )}
          </div>
        </section>
      </div>

      <section
        className="ocean-home-collapsible is-issues lume-domain-section"
        data-domain="issue"
        data-testid="ocean-home-issues"
      >
        <button
          type="button"
          className="ocean-home-collapse-btn lume-domain-section-head"
          aria-expanded={issuesOpen}
          onClick={() => setIssuesOpen((open) => !open)}
        >
          <DomainIcon domain="issue" />
          <span className="ocean-home-section-title">Issues</span>
          <span className="ocean-home-count">{home.issues.length}</span>
          <span
            className="ocean-home-chevron"
            data-open={issuesOpen ? "true" : "false"}
            aria-hidden
          >
            ⌄
          </span>
        </button>
        {issuesOpen ? (
          <div className="lume-domain-section-body">
            {home.issues.length ? (
              <ul>
                {home.issues.map((item) => (
                  <li key={item.id}>
                    <OverviewRow
                      item={item}
                      domain="issue"
                      onOpenDetails={onOpenDetails}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ocean-home-empty">No open issues.</p>
            )}
          </div>
        ) : null}
      </section>

      <section
        className="ocean-home-collapsible is-knowledge lume-domain-section"
        data-domain="knowledge"
        data-testid="ocean-home-knowledge"
      >
        <button
          type="button"
          className="ocean-home-collapse-btn lume-domain-section-head"
          aria-expanded={knowledgeOpen}
          onClick={() => setKnowledgeOpen((open) => !open)}
        >
          <DomainIcon domain="knowledge" />
          <span className="ocean-home-section-title">Knowledge</span>
          <span className="ocean-home-count">{home.knowledge.length}</span>
          <span
            className="ocean-home-chevron"
            data-open={knowledgeOpen ? "true" : "false"}
            aria-hidden
          >
            ⌄
          </span>
        </button>
        {knowledgeOpen ? (
          <div className="lume-domain-section-body">
            {home.knowledge.length ? (
              <ul>
                {home.knowledge.map((item) => (
                  <li key={item.id}>
                    <OverviewRow
                      item={item}
                      domain="knowledge"
                      onOpenDetails={onOpenDetails}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ocean-home-empty">No knowledge recorded yet.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="ocean-home-timeline" data-testid="ocean-home-timeline">
        <p className="ocean-home-timeline-label">Timeline</p>
        <div className="ocean-home-timeline-body">
          <TimelineFrame projectId={projectId} size="tall" />
        </div>
      </section>
    </div>
  );
}

function PersonRow({
  person,
  onOpenDetails,
}: {
  person: KcComposedItem;
  onOpenDetails: (ref: KnowledgeItemRef) => void;
}) {
  const letters = initials(person.title);
  const body = (
    <>
      {letters ? (
        <span
          className="ocean-home-avatar"
          style={{ background: avatarColor(person.title) }}
          aria-hidden
        >
          {letters}
        </span>
      ) : (
        <span />
      )}
      <span className="ocean-home-person-copy">
        <span className="ocean-home-person-name">{person.title}</span>
        {person.supporting ? (
          <span className="ocean-home-muted">{person.supporting}</span>
        ) : null}
      </span>
      {person.ref ? (
        <span className="ocean-home-disclosure" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );
  if (!person.ref) {
    return <div className="ocean-home-person">{body}</div>;
  }
  return (
    <button
      type="button"
      className="ocean-home-person"
      data-testid={`ocean-home-open-${person.id}`}
      onClick={() => onOpenDetails(person.ref!)}
    >
      {body}
    </button>
  );
}

function OverviewRow({
  item,
  domain,
  onOpenDetails,
}: {
  item: KcComposedItem;
  domain: LumeDomain;
  onOpenDetails: (ref: KnowledgeItemRef) => void;
}) {
  const body = (
    <>
      <DomainIcon domain={domain} />
      <span className="ocean-home-overview-copy">
        <span className="ocean-home-overview-title">{item.title}</span>
        {item.supporting ? (
          <span className="ocean-home-muted">{item.supporting}</span>
        ) : null}
        {item.needsYou ? (
          <span className="ocean-home-needs">{item.needsYou}</span>
        ) : null}
      </span>
      {item.tagNames.length ? (
        <span className="ocean-home-tags">
          {item.tagNames.map((name) => (
            <span key={name} className="ocean-home-tag">
              {name}
            </span>
          ))}
        </span>
      ) : null}
      {item.ref ? (
        <span className="ocean-home-disclosure" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );
  if (!item.ref) {
    return <div className="ocean-home-overview-row">{body}</div>;
  }
  return (
    <button
      type="button"
      className="ocean-home-overview-row"
      data-testid={`ocean-home-open-${item.id}`}
      onClick={() => onOpenDetails(item.ref!)}
    >
      {body}
    </button>
  );
}
