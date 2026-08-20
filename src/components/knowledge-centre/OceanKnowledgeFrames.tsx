"use client";

import { useMemo, useState, type ReactNode } from "react";
import { KnowledgeItemCard } from "@/components/knowledge-centre/KnowledgeItemCard";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import { emptyKnowledge } from "@/lib/knowledge";
import {
  formatAwayRange,
  type PriorityDot,
} from "@/lib/knowledge-centre/format-date-label";
import {
  knowledgeDetailEquals,
  personIdFromPeopleCardId,
  refForKnowledgeRisk,
  refForPerson,
  refForRisk,
  refForSectionLine,
  refForStructuredItem,
  refForTimeline,
  refForTodo,
  refForUnconfirmedOwner,
  type KnowledgeItemRef,
} from "@/lib/knowledge-centre/knowledge-item-detail";
import {
  buildDateRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
} from "@/lib/knowledge-centre/ocean-frames";
import { isKnowledgeUuid } from "@/lib/knowledge-identity";
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
 * Slice 2C: cards open a reusable item-detail drawer (stable id, not index).
 */
export function OceanKnowledgeFrames({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const [selected, setSelected] = useState<KnowledgeItemRef | null>(null);

  const project = state.projects.find((p) => p.id === projectId);
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);

  const select = (ref: KnowledgeItemRef) => {
    setSelected((prev) =>
      knowledgeDetailEquals(prev, ref) ? null : ref,
    );
  };

  const isSelected = (ref: KnowledgeItemRef) =>
    knowledgeDetailEquals(selected, ref);

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
        ref: refForStructuredItem(i.id),
      }));
    }
    const ids = knowledge.sectionItemIds?.now;
    return (knowledge.sections.now ?? []).map((b, idx) => {
      const itemId =
        Array.isArray(ids) && typeof ids[idx] === "string" ? ids[idx] : null;
      const ref = refForSectionLine("now", b, itemId);
      return {
        id: itemId && isKnowledgeUuid(itemId) ? itemId : `now-body:${b}`,
        title: b,
        meta: null as string | null,
        epistemic: null as string | null,
        priority: "none" as PriorityDot,
        ref,
      };
    });
  }, [knowledge]);

  const risks = useMemo(
    () => buildOpenRiskRows(state, projectId),
    [state, projectId],
  );

  const todos = useMemo(
    () => buildTodoRows(state, projectId),
    [state, projectId],
  );

  const decisionLines = useMemo(() => {
    const ids = knowledge.sectionItemIds?.decisions;
    return (knowledge.sections.decisions ?? []).map((b, i) => {
      const itemId =
        Array.isArray(ids) && typeof ids[i] === "string" ? ids[i] : null;
      return {
        id: itemId && isKnowledgeUuid(itemId) ? itemId : `dec-body:${b}`,
        title: b,
        ref: refForSectionLine("decisions", b, itemId),
      };
    });
  }, [knowledge]);

  const peopleCards = useMemo(() => {
    const base = buildPeopleRows(state, projectId);
    const stakeholderIds = (project?.stakeholders ?? []).map((s) => s.id);
    return base.map((card) => {
      const personId = personIdFromPeopleCardId(card.id, stakeholderIds);
      let ref: KnowledgeItemRef | null = null;
      if (personId) {
        ref = refForPerson(personId);
      } else if (isKnowledgeUuid(card.id)) {
        // Unconfirmed owner structured item
        ref = refForUnconfirmedOwner(card.id);
      }
      const person = personId
        ? project?.stakeholders.find((s) => s.id === personId)
        : undefined;
      let meta: string | null = null;
      if (person) {
        const bundle = getPersonBundle(state, projectId, person.id);
        const away = bundle?.availability[0];
        meta = away
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
      }
      return { ...card, meta, ref };
    });
  }, [state, projectId, project]);

  const dependencies = useMemo(() => {
    return (knowledge.structured ?? [])
      .filter((i) => i.kind === "dependency" && i.lifecycle === "current")
      .map((i) => ({
        id: i.id,
        title: i.body,
        ref: refForStructuredItem(i.id),
      }));
  }, [knowledge.structured]);

  const dates = useMemo(
    () =>
      buildDateRows(state, projectId).map((row) => ({
        ...row,
        ref: refForTimeline(row.id),
      })),
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
        ref: refForTodo(t.id) as KnowledgeItemRef,
      }));
    const ids = knowledge.sectionItemIds?.openLoops;
    const fromLoops = (knowledge.sections.openLoops ?? []).map((b, i) => {
      const itemId =
        Array.isArray(ids) && typeof ids[i] === "string" ? ids[i] : null;
      return {
        id: itemId && isKnowledgeUuid(itemId) ? itemId : `loop-body:${b}`,
        title: b,
        meta: null as string | null,
        ref: refForSectionLine("openLoops", b, itemId),
      };
    });
    return [...fromTodos, ...fromLoops];
  }, [state.todos, knowledge.sections.openLoops, knowledge.sectionItemIds, projectId]);

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
                selected={isSelected(item.ref)}
                onSelect={() => select(item.ref)}
                testId={`ocean-card-${item.id}`}
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
            risks.map((item) => {
              const ref = isKnowledgeUuid(item.id)
                ? refForRisk(item.id)
                : refForKnowledgeRisk(item.id, item.title);
              return (
                <KnowledgeItemCard
                  key={item.id}
                  title={item.title}
                  priority={item.priority}
                  selected={isSelected(ref)}
                  onSelect={() => select(ref)}
                  testId={`ocean-card-risk-${item.id}`}
                />
              );
            })
          ) : (
            <p className="ocean-frame-empty">No open risks.</p>
          )}
        </FrameShell>

        <FrameShell title="To Do" accent="todo" testId="ocean-frame-todo">
          {todos.length ? (
            todos.map((item) => {
              const ref = refForTodo(item.id);
              return (
                <KnowledgeItemCard
                  key={item.id}
                  title={item.title}
                  meta={item.meta}
                  selected={isSelected(ref)}
                  onSelect={() => select(ref)}
                  testId={`ocean-card-todo-${item.id}`}
                />
              );
            })
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
            peopleCards.map((item) =>
              item.ref ? (
                <KnowledgeItemCard
                  key={item.id}
                  title={item.title}
                  meta={item.meta}
                  epistemic={item.epistemic}
                  selected={isSelected(item.ref)}
                  onSelect={() => select(item.ref!)}
                  testId={`ocean-card-person-${item.id}`}
                />
              ) : (
                <KnowledgeItemCard
                  key={item.id}
                  title={item.title}
                  meta={item.meta}
                  epistemic={item.epistemic}
                />
              ),
            )
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
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                selected={isSelected(item.ref)}
                onSelect={() => select(item.ref)}
                testId={`ocean-card-dep-${item.id}`}
              />
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
          {decisionLines.length ? (
            decisionLines.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                selected={isSelected(item.ref)}
                onSelect={() => select(item.ref)}
                testId={`ocean-card-decision-${item.id}`}
              />
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
              <KnowledgeItemCard
                key={item.id}
                title={item.title}
                selected={isSelected(item.ref)}
                onSelect={() => select(item.ref)}
                testId={`ocean-card-date-${item.id}`}
              />
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
                selected={isSelected(item.ref)}
                onSelect={() => select(item.ref)}
                testId={`ocean-card-waiting-${item.id}`}
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

      <KnowledgeItemDetailDrawer
        projectId={projectId}
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
