"use client";

import { useMemo, useState } from "react";
import { MeMark } from "@/components/brand/MeMark";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { TimelineFrame } from "@/components/frames/TimelineFrame";
import { composeHomeProjection } from "@/lib/knowledge-centre/home-projection";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { useMission } from "@/lib/store";

export function OceanHomeProjection({
  projectId,
  onOpenDetails,
  onAddSuggestion,
}: {
  projectId: string;
  onOpenDetails: (ref: KnowledgeItemRef) => void;
  onAddSuggestion: (recommendationId: string) => void;
}) {
  const { state } = useMission();
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const home = useMemo(
    () => composeHomeProjection(state, projectId),
    [state, projectId],
  );

  return (
    <div className="ocean-home" data-testid="ocean-home">
      <div className="ocean-home-top">
        <section
          className="ocean-home-queue lume-domain-section"
          data-domain="todo"
          data-testid="ocean-home-queue"
          aria-label="Working queue"
        >
          <header className="ocean-home-section-head lume-domain-section-head">
            <DomainIcon domain="todo" />
            <h2>To Do</h2>
            <span className="ocean-home-count">{home.queue.length}</span>
          </header>
          <div className="lume-domain-section-body">
          {home.queue.length ? (
            <ul className="ocean-home-queue-list">
              {home.queue.map((item) => (
                <li
                  key={item.id}
                  className={`ocean-home-queue-item is-${item.kind}`}
                  data-testid={`ocean-home-queue-${item.kind}`}
                  data-stays-issue={item.staysIssue ? "true" : undefined}
                >
                  <div
                    className={`ocean-home-queue-copy${
                      item.kind === "todo" || item.kind === "issue"
                        ? " has-domain-icon"
                        : ""
                    }`}
                  >
                    {item.kind === "todo" || item.kind === "issue" ? (
                      <DomainIcon
                        domain={item.kind === "todo" ? "todo" : "issue"}
                      />
                    ) : (
                      <p className="ocean-home-kicker">
                        {item.kind === "date" ? "Date" : "Suggestion"}
                      </p>
                    )}
                    <div>
                    <h3>{item.title}</h3>
                    {item.supporting ? <p>{item.supporting}</p> : null}
                    {item.kind === "suggestion" ? (
                      <p className="ocean-home-suggestion-note">
                        <MeMark size="micro" /> not a To Do yet
                      </p>
                    ) : null}
                    </div>
                  </div>
                  {item.kind === "suggestion" && item.recommendationId ? (
                    <button
                      type="button"
                      className="primary-btn"
                      data-testid={`ocean-home-suggestion-add-${item.recommendationId}`}
                      onClick={() => onAddSuggestion(item.recommendationId!)}
                    >
                      Add
                    </button>
                  ) : item.ref ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      data-testid={`ocean-home-open-${item.id}`}
                      onClick={() => onOpenDetails(item.ref!)}
                    >
                      Open Details
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ocean-home-empty">Nothing in the working queue.</p>
          )}
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
                  <p className="ocean-home-person-name">{person.title}</p>
                  {person.supporting ? (
                    <p className="ocean-home-muted">{person.supporting}</p>
                  ) : null}
                  {person.ref ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => onOpenDetails(person.ref!)}
                    >
                      Open Details
                    </button>
                  ) : null}
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
          <span>Issues · {home.issues.length}</span>
        </button>
        {issuesOpen ? (
          <div className="lume-domain-section-body">
            {home.issues.length ? (
              <ul>
                {home.issues.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    {item.ref ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => onOpenDetails(item.ref!)}
                      >
                        Open Details
                      </button>
                    ) : null}
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
          <span>Knowledge · {home.knowledge.length}</span>
        </button>
        {knowledgeOpen ? (
          <div className="lume-domain-section-body">
            {home.knowledge.length ? (
              <ul>
                {home.knowledge.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    {item.ref ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => onOpenDetails(item.ref!)}
                      >
                        Open Details
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ocean-home-empty">No knowledge recorded yet.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="kc-feature" data-testid="ocean-home-timeline">
        <p className="kc-feature-label">Timeline</p>
        <div className="kc-feature-body ocean-embed-frame">
          <TimelineFrame projectId={projectId} size="tall" />
        </div>
      </section>
    </div>
  );
}
