/**
 * Deterministic Tell Me suggested questions from live project state.
 * No AI call — cost control.
 */
import { knowledgeHasContent } from "@/lib/knowledge";
import type { MissionState, Project, TodoItem } from "@/lib/types";
import type { TellMeSuggestedQuestion } from "@/lib/tell-me/types";

function firstName(displayName?: string | null): string | null {
  if (!displayName?.trim()) return null;
  const part = displayName.trim().split(/\s+/)[0];
  return part || null;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function openTodos(state: MissionState, projectId: string): TodoItem[] {
  return state.todos.filter(
    (t) => t.projectId === projectId && !t.done,
  );
}

function waitingTodos(state: MissionState, projectId: string): TodoItem[] {
  return openTodos(state, projectId).filter(
    (t) =>
      Boolean(t.waitingOn?.trim()) ||
      t.kind === "WAITING" ||
      t.kind === "CHASE",
  );
}

function mentionsCab(text: string): boolean {
  return /\bcab\b/i.test(text);
}

function collectProjectText(state: MissionState, projectId: string): string {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const parts = [
    project?.name ?? "",
    project?.summary ?? "",
    project?.currentFocus ?? "",
    ...(project?.stakeholders ?? []).map((s) => `${s.name} ${s.role}`),
    ...(knowledge?.sections.now ?? []),
    ...(knowledge?.sections.decisions ?? []),
    ...(knowledge?.sections.risks ?? []),
    ...(knowledge?.sections.people ?? []),
    ...(knowledge?.sections.openLoops ?? []),
    ...state.todos
      .filter((t) => t.projectId === projectId)
      .map((t) => `${t.title} ${t.waitingOn ?? ""} ${t.detail ?? ""}`),
    ...state.timeline
      .filter((t) => t.projectId === projectId)
      .map((t) => t.label),
    ...state.releases
      .filter((r) => r.projectId === projectId)
      .map((r) => r.name),
    ...state.meetings
      .filter((m) => m.projectId === projectId)
      .map((m) => m.title),
  ];
  return parts.join("\n");
}

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

export function buildSuggestedQuestions(args: {
  state: MissionState;
  projectId: string | null;
  userDisplayName?: string | null;
  limit?: number;
}): TellMeSuggestedQuestion[] {
  const limit = args.limit ?? 6;
  const out: TellMeSuggestedQuestion[] = [];
  const name = firstName(args.userDisplayName);

  if (!args.projectId) {
    const waitingAcross = args.state.todos.filter(
      (t) =>
        !t.done &&
        (Boolean(t.waitingOn?.trim()) ||
          t.kind === "WAITING" ||
          t.kind === "CHASE"),
    );
    if (waitingAcross.length) {
      pushUnique(
        out,
        {
          id: "cross-waiting",
          question: "What am I waiting on across my projects?",
          reason: "Open waiting items exist across projects",
          signals: ["waiting"],
        },
        limit,
      );
    }
    const upcoming = args.state.timeline
      .filter((t) => {
        const d = daysUntil(t.startAt);
        return d != null && d >= 0 && d <= 14;
      })
      .slice(0, 3);
    if (upcoming.length) {
      pushUnique(
        out,
        {
          id: "cross-upcoming",
          question: "Which releases or milestones are coming up next?",
          reason: "Upcoming timeline items in the next two weeks",
          signals: ["timeline"],
        },
        limit,
      );
    }
    const cabProjects = args.state.projects.filter((p) =>
      mentionsCab(collectProjectText(args.state, p.id)),
    );
    if (cabProjects.length) {
      pushUnique(
        out,
        {
          id: "cross-cab",
          question: "Which of my projects have CAB work coming up?",
          reason: "CAB-related language found in project intelligence",
          signals: ["cab"],
        },
        limit,
      );
    }
    return out.slice(0, limit);
  }

  const projectId = args.projectId;
  const project = args.state.projects.find((p) => p.id === projectId);
  if (!project) return out;

  const text = collectProjectText(args.state, projectId);
  const knowledge = args.state.knowledge.find((k) => k.projectId === projectId);
  const waiting = waitingTodos(args.state, projectId);
  const open = openTodos(args.state, projectId);
  const risks = [
    ...(knowledge?.sections.risks ?? []),
    ...args.state.recommendations.filter(
      (r) =>
        r.projectId === projectId &&
        r.status === "active" &&
        r.kind === "risk",
    ),
  ];
  const people = knowledge?.sections.people ?? [];
  const openLoops = knowledge?.sections.openLoops ?? [];
  const decisions = knowledge?.sections.decisions ?? [];

  const cabSoon =
    mentionsCab(text) ||
    args.state.meetings.some(
      (m) => m.projectId === projectId && mentionsCab(m.title),
    ) ||
    args.state.timeline.some(
      (t) => t.projectId === projectId && mentionsCab(t.label),
    ) ||
    args.state.releases.some(
      (r) =>
        r.projectId === projectId &&
        (r.currentStage === "cab_preparation" ||
          r.currentStage === "cab_approval" ||
          mentionsCab(r.name)),
    );

  if (waiting.length) {
    const who = waiting[0]?.waitingOn?.trim();
    pushUnique(
      out,
      {
        id: "waiting-on",
        question: who
          ? `What am I still waiting on ${who} for?`
          : "What am I still waiting on?",
        reason: "Open waiting / chase items",
        signals: ["waiting"],
      },
      limit,
    );
    pushUnique(
      out,
      {
        id: "chase-week",
        question: "Who do I need to chase this week?",
        reason: "Waiting items need follow-up",
        signals: ["waiting", "chase"],
      },
      limit,
    );
  }

  if (cabSoon) {
    pushUnique(
      out,
      {
        id: "cab-ready",
        question: "What still needs to happen before CAB?",
        reason: "CAB-related work appears in project intelligence",
        signals: ["cab"],
      },
      limit,
    );
    pushUnique(
      out,
      {
        id: "cab-risk",
        question: "What could stop us being ready for CAB?",
        reason: "CAB readiness anxiety",
        signals: ["cab", "risk"],
      },
      limit,
    );
  }

  if (risks.length) {
    pushUnique(
      out,
      {
        id: "open-risks",
        question: "Which risks are most likely to affect the next release?",
        reason: "Open risks recorded",
        signals: ["risk"],
      },
      limit,
    );
  }

  const recentMove = (args.state.history ?? []).find(
    (h) =>
      h.projectId === projectId &&
      /moved|slip|delay|reschedul|date change/i.test(
        `${h.title} ${h.detail ?? ""}`,
      ),
  );
  if (recentMove || /moved|slipped|delayed/i.test(text)) {
    pushUnique(
      out,
      {
        id: "why-moved",
        question: "Why was the release moved?",
        reason: "Date-change signal in history or knowledge",
        signals: ["date_change"],
      },
      limit,
    );
  }

  const stakeholderName =
    project.stakeholders?.[0]?.name?.split(/\s+/)[0] ||
    people
      .map((p) => p.match(/\b([A-Z][a-z]+)\b/)?.[1])
      .find(Boolean) ||
    waiting.map((t) => t.waitingOn?.trim()).find(Boolean) ||
    null;

  if (stakeholderName) {
    pushUnique(
      out,
      {
        id: "stakeholder-need",
        question: `What does ${stakeholderName} still need from me?`,
        reason: "Named stakeholder in people / waiting context",
        signals: ["stakeholder"],
      },
      limit,
    );
    pushUnique(
      out,
      {
        id: "stakeholder-agree",
        question: `What did we agree with ${stakeholderName}?`,
        reason: "Stakeholder commitments may live in knowledge",
        signals: ["stakeholder", "decision"],
      },
      limit,
    );
  }

  if (decisions.length || /governance|lead time|48 hours|policy/i.test(text)) {
    pushUnique(
      out,
      {
        id: "governance",
        question: "What governance rules do I need to remember?",
        reason: "Decisions / constraints present",
        signals: ["knowledge", "constraint"],
      },
      limit,
    );
  }

  if (openLoops.length) {
    pushUnique(
      out,
      {
        id: "open-loops",
        question: "What open loops could catch me out?",
        reason: "Open loops recorded in knowledge",
        signals: ["openLoops"],
      },
      limit,
    );
  }

  const upcomingMeeting = args.state.meetings
    .filter((m) => m.projectId === projectId)
    .map((m) => ({ m, d: daysUntil(m.startsAt) }))
    .filter((x) => x.d != null && x.d >= 0 && x.d <= 3)
    .sort((a, b) => (a.d ?? 99) - (b.d ?? 99))[0];

  if (upcomingMeeting) {
    pushUnique(
      out,
      {
        id: "meeting-catch",
        question: `What could catch me out before ${upcomingMeeting.m.title}?`,
        reason: "Meeting within three days",
        signals: ["meeting"],
      },
      limit,
    );
  }

  if (name && waiting.length >= 2 && out.length < limit) {
    pushUnique(
      out,
      {
        id: "personal-waiting",
        question: `${name}, what are the two things still waiting on others?`,
        reason: "Personalised waiting prompt",
        signals: ["waiting", "personal"],
      },
      limit,
    );
  }

  if (!out.length && projectIsThin(args.state, project)) {
    pushUnique(
      out,
      {
        id: "thin-capture",
        question: "What are the biggest risks I have mentioned so far?",
        reason: "Thin project — encourage Capture → Learn loop",
        signals: ["empty"],
      },
      limit,
    );
  }

  if (!out.length && open.length) {
    pushUnique(
      out,
      {
        id: "fallback-open",
        question: "What is still outstanding on this project?",
        reason: "Open work exists",
        signals: ["todo"],
      },
      limit,
    );
  }

  return out.slice(0, limit);
}

function projectIsThin(state: MissionState, project: Project): boolean {
  const knowledge = state.knowledge.find((k) => k.projectId === project.id);
  const hasKnowledge = knowledge ? knowledgeHasContent(knowledge) : false;
  const todos = state.todos.filter((t) => t.projectId === project.id);
  return !hasKnowledge && todos.length === 0;
}

export function buildPersonalisedHint(args: {
  state: MissionState;
  projectId: string | null;
  userDisplayName?: string | null;
}): string | null {
  const name = firstName(args.userDisplayName);
  if (!args.projectId) return null;
  const waiting = waitingTodos(args.state, args.projectId);
  if (name && waiting.length >= 2) {
    return `${name}, you still have ${waiting.length} things waiting on others. Want to ask what they are?`;
  }
  const text = collectProjectText(args.state, args.projectId);
  if (name && mentionsCab(text)) {
    return `You’ve got CAB approaching, ${name}. You might want to ask what could stop readiness.`;
  }
  return null;
}
