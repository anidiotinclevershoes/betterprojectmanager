"use client";

import { useMemo, useState } from "react";
import { MeMark } from "@/components/brand/MeMark";
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
          className="ocean-home-queue"
          data-testid="ocean-home-queue"
          aria-label="Working queue"
        >
          <header className="ocean-home-section-head">
            <h2>To Do</h2>
            <span className="ocean-home-count">{home.queue.length}</span>
          </header>
          {home.queue.length ? (
            <ul className="ocean-home-queue-list">
              {home.queue.map((item) => (
                <li
                  key={item.id}
                  className={`ocean-home-queue-item is-${item.kind}`}
                  data-testid={`ocean-home-queue-${item.kind}`}
                  data-stays-issue={item.staysIssue ? "true" : undefined}
                >
                  <div className="ocean-home-queue-copy">
                    <p className="ocean-home-kicker">
                      {item.kind === "todo"
                        ? "To Do"
                        : item.kind === "issue"
                          ? "Issue"
                          : item.kind === "date"
                            ? "Date"
                            : "Suggestion"}
                    </p>
                    <h3>{item.title}</h3>
                    {item.supporting ? <p>{item.supporting}</p> : null}
                    {item.kind === "suggestion" ? (
                      <p className="ocean-home-suggestion-note">
                        <MeMark size="micro" /> not a To Do yet
                      </p>
                    ) : null}
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
        </section>

        <section
          className="ocean-home-people"
          data-testid="ocean-home-people"
          aria-label="People"
        >
          <header className="ocean-home-section-head">
            <h2>People</h2>
            <span className="ocean-home-count">{home.people.length}</span>
          </header>
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
        </section>
      </div>

      <section
        className="ocean-home-collapsible is-issues"
        data-testid="ocean-home-issues"
      >
        <button
          type="button"
          className="ocean-home-collapse-btn"
          aria-expanded={issuesOpen}
          onClick={() => setIssuesOpen((open) => !open)}
        >
          Issues · {home.issues.length}
        </button>
        {issuesOpen ? (
          home.issues.length ? (
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
          )
        ) : null}
      </section>

      <section
        className="ocean-home-collapsible is-knowledge"
        data-testid="ocean-home-knowledge"
      >
        <button
          type="button"
          className="ocean-home-collapse-btn"
          aria-expanded={knowledgeOpen}
          onClick={() => setKnowledgeOpen((open) => !open)}
        >
          Knowledge · {home.knowledge.length}
        </button>
        {knowledgeOpen ? (
          home.knowledge.length ? (
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
          )
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
