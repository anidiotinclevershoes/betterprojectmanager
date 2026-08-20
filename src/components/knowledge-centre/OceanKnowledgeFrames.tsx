"use client";

import { useMemo, type ReactNode } from "react";
import { KnowledgeItemCard } from "@/components/knowledge-centre/KnowledgeItemCard";
import { emptyKnowledge } from "@/lib/knowledge";
import {
  formatAwayRange,
  type PriorityDot,
} from "@/lib/knowledge-centre/format-date-label";
import {
  buildDateRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
} from "@/lib/knowledge-centre/ocean-frames";
import { getPersonBundle } from "@/lib/people/identity";
import { useMission } from "@/lib/store";
import { MeetingPrepFrame } from "@/components/frames/MeetingPrepFrame";
import { TimelineFrame } from "@/components/frames/TimelineFrame";

function FrameShell({
  title,
  accent,
  children,
  testId,
}: {
  title: string;
  accent: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section
      className={`ocean-knowledge-frame accent-${accent}`}
      data-testid={testId}
      data-frame={title}
    >
      <header className="ocean-knowledge-frame-header">
        <h3>{title}</h3>
      </header>
      <div className="ocean-knowledge-frame-body">{children}</div>
    </section>
  );
}

function epistemicLabel(
  epistemic: string | null | undefined,
): string | null {
  if (!epistemic) return null;
  if (epistemic === "confirmed" || epistemic === "legacy") return null;
  if (epistemic === "informal") return "Informal";
  if (epistemic === "unknown") return "Unconfirmed";
  if (epistemic === "conflicting") return "Conflicting";
  if (epistemic === "suggested") return "Unconfirmed";
  return null;
}

/**
 * Ocean Knowledge frames: three large default columns, remainder via scroll.
 * No accordion / expand-more control. No decorative header icons.
 */
export function OceanKnowledgeFrames({ projectId }: { projectId: string }) {
  const { state, toggleTodo } = useMission();
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);

  const currentPosition = useMemo(() => {
    const structured = (knowledge.structured ?? []).filter(
      (i) =>
        i.lifecycle === "current" &&
        (i.section === "now" || i.kind === "fact" || i.kind === "date"),
    );
    if (structured.length) {
      return structured.map((i) => ({
        id: i.id,
        title: i.body,
        meta: null as string | null,
        epistemic: epistemicLabel(i.epistemic),
        priority: "none" as PriorityDot,
      }));
    }
    return (knowledge.sections.now ?? []).map((b, idx) => ({
      id: `now-${idx}`,
      title: b,
      meta: null as string | null,
      epistemic: null as string | null,
      priority: "none" as PriorityDot,
    }));
  }, [knowledge]);

  const risks = useMemo(
    () => buildOpenRiskRows(state, projectId),
    [state, projectId],
  );

  const todos = useMemo(
    () => buildTodoRows(state, projectId),
    [state, projectId],
  );

  const decisions = knowledge.sections.decisions ?? [];

  const peopleCards = useMemo(() => {
    const base = buildPeopleRows(state, projectId);
    return base.map((card) => {
      const person = project?.stakeholders.find((s) =>
        card.id.startsWith(s.id),
      );
      if (!person) return { ...card, meta: null as string | null };
      const bundle = getPersonBundle(state, projectId, person.id);
      const away = bundle?.availability[0];
      const awayMeta = away
        ? formatAwayRange(
            (
              away.item.meta as {
                availability?: { awayFromIso?: string; awayToIso?: string };
              } | null
            )?.availability?.awayFromIso,
            (
              away.item.meta as {
                availability?: { awayFromIso?: string; awayToIso?: string };
              } | null
            )?.availability?.awayToIso,
          ) ?? away.body
        : null;
      return { ...card, meta: awayMeta };
    });
  }, [state, projectId, project]);

  const dependencies = useMemo(() => {
    return (knowledge.structured ?? [])
      .filter((i) => i.kind === "dependency" && i.lifecycle === "current")
      .map((i) => ({ id: i.id, title: i.body }));
  }, [knowledge.structured]);

  const dates = useMemo(
    () => buildDateRows(state, projectId),
    [state, projectId],
  );

  const waiting = useMemo(() => {
    const fromTodos = (state.todos ?? [])
      .filter(
        (t) =>
          t.projectId === projectId &&
          !t.done &&
          (t.kind === "WAITING" || t.kind === "CHASE" || Boolean(t.waitingOn)),
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: t.waitingOn ? `Waiting on ${t.waitingOn}` : null,
      }));
    const fromLoops = (knowledge.sections.openLoops ?? []).map((b, i) => ({
      id: `loop-${i}`,
      title: b,
      meta: null as string | null,
    }));
    return [...fromTodos, ...fromLoops];
  }, [state.todos, knowledge.sections.openLoops, projectId]);

  return (
    <div className="ocean-knowledge-frames" data-testid="ocean-knowledge-frames">
      <div
        className="ocean-knowledge-frames-primary"
        data-testid="ocean-frames-primary"
      >
        <FrameShell
          title="Current position"
          accent="position"
          testId="ocean-frame-current-position"
        >
          {currentPosition.length ? (
            currentPosition.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                meta={item.meta}
                priority={item.priority}
                epistemic={item.epistemic}
              />
            ))
          ) : (
            <p className="ocean-frame-empty">Nothing recorded yet.</p>
          )}
        </FrameShell>

        <FrameShell
          title="Risks & blockers"
          accent="risks"
          testId="ocean-frame-risks"
        >
          {risks.length ? (
            risks.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                priority={item.priority}
              />
            ))
          ) : (
            <p className="ocean-frame-empty">No open risks.</p>
          )}
        </FrameShell>

        <FrameShell title="To Do" accent="todo" testId="ocean-frame-todo">
          {todos.length ? (
            todos.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                meta={item.meta}
                onSelect={() => toggleTodo(item.id)}
              />
            ))
          ) : (
            <p className="ocean-frame-empty">No open to-dos.</p>
          )}
        </FrameShell>
      </div>

      <div
        className="ocean-knowledge-frames-secondary"
        data-testid="ocean-frames-secondary"
      >
        <FrameShell
          title="People & context"
          accent="people"
          testId="ocean-frame-people"
        >
          {peopleCards.length ? (
            peopleCards.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                meta={item.meta}
                epistemic={item.epistemic}
              />
            ))
          ) : (
            <p className="ocean-frame-empty">No people recorded yet.</p>
          )}
        </FrameShell>

        <FrameShell
          title="Dependencies"
          accent="deps"
          testId="ocean-frame-dependencies"
        >
          {dependencies.length ? (
            dependencies.map((item) => (
              <KnowledgeItemCard key={item.id} title={item.title} />
            ))
          ) : (
            <p className="ocean-frame-empty">
              No structured dependencies yet.
            </p>
          )}
        </FrameShell>

        <FrameShell
          title="Decisions"
          accent="decisions"
          testId="ocean-frame-decisions"
        >
          {decisions.length ? (
            decisions.map((b, i) => (
              <KnowledgeItemCard key={`d-${i}`} title={b} />
            ))
          ) : (
            <p className="ocean-frame-empty">No decisions recorded.</p>
          )}
        </FrameShell>

        <FrameShell
          title="Important dates"
          accent="dates"
          testId="ocean-frame-dates"
        >
          {dates.length ? (
            dates.map((item) => (
              <KnowledgeItemCard key={item.id} title={item.title} />
            ))
          ) : (
            <p className="ocean-frame-empty">No milestones recorded.</p>
          )}
        </FrameShell>

        <FrameShell
          title="Waiting & open loops"
          accent="waiting"
          testId="ocean-frame-waiting"
        >
          {waiting.length ? (
            waiting.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                meta={item.meta}
              />
            ))
          ) : (
            <p className="ocean-frame-empty">No open loops.</p>
          )}
        </FrameShell>

        <section
          className="ocean-knowledge-frame accent-meeting ocean-legacy-embed"
          data-testid="ocean-frame-meeting-prep"
          data-frame="Meeting Prep"
        >
          <header className="ocean-knowledge-frame-header">
            <h3>Meeting Prep</h3>
          </header>
          <div className="ocean-knowledge-frame-body ocean-embed-frame">
            <MeetingPrepFrame projectId={projectId} size="tall" />
          </div>
        </section>

        <section
          className="ocean-knowledge-frame accent-timeline ocean-legacy-embed"
          data-testid="ocean-frame-timeline"
          data-frame="Timeline"
        >
          <header className="ocean-knowledge-frame-header">
            <h3>Timeline</h3>
          </header>
          <div className="ocean-knowledge-frame-body ocean-embed-frame">
            <TimelineFrame projectId={projectId} size="tall" />
          </div>
        </section>
      </div>
    </div>
  );
}
