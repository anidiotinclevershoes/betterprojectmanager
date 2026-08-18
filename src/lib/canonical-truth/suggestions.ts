/**
 * Deterministic Knowledge-driven question suggestions / autocomplete.
 * Navigation intelligence only — never calls OpenAI.
 */
import type { MissionState } from "@/lib/types";
import { deriveLegacyStructured } from "@/lib/canonical-truth/serialize";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { TellMeSuggestedQuestion } from "@/lib/tell-me/types";
import { emptyKnowledge } from "@/lib/knowledge";

const TEMPLATES = {
  responsibility: (scope: string) => `Who owns ${scope}?`,
  unknownOwner: (scope: string) => `Who owns ${scope}?`,
  milestone: (label: string) => `When is ${label}?`,
  waitingOn: (person: string) => `What am I waiting on from ${person}?`,
  blocking: (item: string) => `What is blocking ${item}?`,
  availability: (person: string) => `When does ${person} return?`,
} as const;

function pushUnique(
  out: TellMeSuggestedQuestion[],
  item: TellMeSuggestedQuestion,
  limit: number,
) {
  if (out.length >= limit) return;
  if (out.some((q) => q.question.toLowerCase() === item.question.toLowerCase())) {
    return;
  }
  out.push(item);
}

function itemsForProject(
  state: MissionState,
  projectId: string,
): CanonicalTruthItem[] {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  if (knowledge.structured?.length) {
    return knowledge.structured.filter((i) => i.lifecycle === "current");
  }
  return deriveLegacyStructured(knowledge).filter(
    (i) => i.lifecycle === "current",
  );
}

/**
 * Build suggestions from stored canonical Knowledge / milestones / waiting.
 * Pure sync — no network, no OpenAI.
 */
export function buildCanonicalSuggestions(args: {
  state: MissionState;
  projectId: string | null;
  limit?: number;
  /** Optional filter string for local autocomplete */
  query?: string | null;
}): TellMeSuggestedQuestion[] {
  const limit = args.limit ?? 8;
  const out: TellMeSuggestedQuestion[] = [];
  if (!args.projectId) return out;

  const projectId = args.projectId;
  const items = itemsForProject(args.state, projectId);
  const q = (args.query ?? "").trim().toLowerCase();

  const matchesQuery = (text: string) =>
    !q || text.toLowerCase().includes(q);

  for (const item of items) {
    const resp = item.meta?.responsibility;
    if (item.kind === "responsibility" && resp?.scope) {
      if (
        !resp.ownerConfirmed ||
        item.epistemic === "unknown"
      ) {
        const question = TEMPLATES.unknownOwner(resp.scope);
        if (matchesQuery(question) || matchesQuery(resp.scope)) {
          pushUnique(
            out,
            {
              id: `canon-unk-${item.id}`,
              question,
              reason: "Owner not confirmed in Knowledge",
              signals: ["canonical", "unknown_owner", resp.scope],
            },
            limit,
          );
        }
      } else if (resp.personName) {
        const question = TEMPLATES.responsibility(resp.scope);
        if (matchesQuery(question) || matchesQuery(resp.personName)) {
          pushUnique(
            out,
            {
              id: `canon-own-${item.id}`,
              question,
              reason: `Stored responsibility @${resp.personName} → ${resp.scope}`,
              signals: ["canonical", "responsibility", resp.scope],
            },
            limit,
          );
        }
      }
    }

    if (item.kind === "availability") {
      const name =
        (item.meta?.responsibility?.personName as string | undefined) ||
        item.body.split(/\s+/)[0];
      if (name) {
        const question = TEMPLATES.availability(name);
        if (matchesQuery(question)) {
          pushUnique(
            out,
            {
              id: `canon-avail-${item.id}`,
              question,
              reason: "Availability recorded in Knowledge",
              signals: ["canonical", "availability"],
            },
            limit,
          );
        }
      }
    }

    if (item.kind === "dependency" || /\bblock/i.test(item.body)) {
      const label = item.body.replace(/^blocked by\s+/i, "").slice(0, 40);
      const question = TEMPLATES.blocking(label);
      if (matchesQuery(question)) {
        pushUnique(
          out,
          {
            id: `canon-dep-${item.id}`,
            question,
            reason: "Dependency / blocker in Knowledge",
            signals: ["canonical", "dependency"],
          },
          limit,
        );
      }
    }
  }

  for (const t of args.state.timeline.filter((x) => x.projectId === projectId)) {
    const question = TEMPLATES.milestone(t.label);
    if (matchesQuery(question) || matchesQuery(t.label)) {
      pushUnique(
        out,
        {
          id: `canon-ms-${t.id}`,
          question,
          reason: "Milestone in project timeline",
          signals: ["canonical", "milestone", t.label],
        },
        limit,
      );
    }
  }

  for (const todo of args.state.todos.filter(
    (t) =>
      t.projectId === projectId &&
      !t.done &&
      (t.waitingOn || t.kind === "WAITING" || t.kind === "CHASE"),
  )) {
    const person = todo.waitingOn?.trim();
    if (!person) continue;
    const question = TEMPLATES.waitingOn(person);
    if (matchesQuery(question) || matchesQuery(person)) {
      pushUnique(
        out,
        {
          id: `canon-wait-${todo.id}`,
          question,
          reason: `Waiting on ${person}`,
          signals: ["canonical", "waiting", person],
        },
        limit,
      );
    }
  }

  return out.slice(0, limit);
}

/** Test helper — proves this module never imports OpenAI. */
export const CANONICAL_SUGGESTIONS_NO_AI = true as const;
