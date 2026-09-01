/**
 * Read-only Timeline projection over existing dated truth.
 * Does not persist, infer availability, or invent calendar rows.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import { formatAwayRange } from "@/lib/knowledge-centre/format-date-label";
import { getPersonBundle, namesMatchExact } from "@/lib/people/identity";
import { upcomingMeetings } from "@/lib/selectors";
import type { Meeting, MissionState, Stakeholder } from "@/lib/types";

export const NO_UNAVAILABILITY_RECORDED = "No unavailability recorded";

export type TlEventKind =
  | "milestone"
  | "deadline"
  | "date"
  | "todo"
  | "meeting"
  | "unavailability";

export type TlEvent = {
  id: string;
  kind: TlEventKind;
  title: string;
  startAt: string;
  endAt?: string | null;
  meetingId?: string | null;
  personId?: string | null;
  personName?: string | null;
  source:
    | "timeline"
    | "structured_date"
    | "todo"
    | "meeting"
    | "availability"
    | "project_milestone";
};

export type TlLane = {
  id: string;
  label: string;
  kind: "project" | "person";
  personId?: string;
  events: TlEvent[];
  /** Person lanes only. Never "available". */
  availabilityNote: typeof NO_UNAVAILABILITY_RECORDED | string | null;
  hasExplicitUnavailability: boolean;
};

export type TlProjection = {
  startMs: number;
  endMs: number;
  projectLane: TlLane;
  personLanes: TlLane[];
  events: TlEvent[];
  sparse: boolean;
  empty: boolean;
};

function dayMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

export function composeTimelineProjection(
  state: MissionState,
  projectId: string,
): TlProjection {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const events: TlEvent[] = [];
  const seen = new Set<string>();

  const remember = (event: TlEvent) => {
    const key = `${event.kind}:${event.title.trim().toLowerCase()}:${event.startAt.slice(0, 10)}`;
    if (seen.has(key) || seen.has(event.id)) return;
    if (!dayMs(event.startAt)) return;
    seen.add(key);
    seen.add(event.id);
    events.push(event);
  };

  for (const row of state.timeline ?? []) {
    if (row.projectId !== projectId) continue;
    const kind: TlEventKind =
      row.type === "meeting"
        ? "meeting"
        : row.type === "deadline" || row.type === "submission"
          ? "deadline"
          : "milestone";
    remember({
      id: `tl:${row.id}`,
      kind,
      title: row.label,
      startAt: row.startAt,
      endAt: row.endAt ?? null,
      source: "timeline",
    });
  }

  if (project?.nextMilestone && project.nextMilestoneAt) {
    remember({
      id: `proj-ms:${project.id}`,
      kind: "milestone",
      title: project.nextMilestone,
      startAt: project.nextMilestoneAt,
      source: "project_milestone",
    });
  }

  for (const item of knowledge.structured ?? []) {
    if (item.lifecycle !== "current") continue;
    if (item.kind === "date") {
      const iso = item.meta?.date?.dateIso;
      if (!iso) continue;
      remember({
        id: `date:${item.id}`,
        kind: "date",
        title: item.meta?.date?.label || item.body,
        startAt: iso,
        source: "structured_date",
      });
    }
    if (item.kind === "availability") {
      const meta = item.meta?.availability;
      const from = meta?.awayFromIso;
      if (!from) continue;
      remember({
        id: `away:${item.id}`,
        kind: "unavailability",
        title: meta?.label || item.body,
        startAt: from,
        endAt: meta?.awayToIso ?? from,
        personId: meta?.personId ?? null,
        personName: meta?.personName ?? null,
        source: "availability",
      });
    }
  }

  for (const todo of state.todos ?? []) {
    if (todo.projectId !== projectId || todo.done || !todo.dueAt) continue;
    remember({
      id: `todo:${todo.id}`,
      kind: "todo",
      title: todo.title,
      startAt: todo.dueAt,
      personName: todo.waitingOn ?? null,
      source: "todo",
    });
  }

  for (const meeting of state.meetings ?? []) {
    if (meeting.projectId !== projectId) continue;
    remember({
      id: `mtg:${meeting.id}`,
      kind: "meeting",
      title: meeting.title,
      startAt: meeting.startsAt,
      meetingId: meeting.id,
      source: "meeting",
    });
  }

  const times = events
    .flatMap((e) => [dayMs(e.startAt), e.endAt ? dayMs(e.endAt) : null])
    .filter((n): n is number => n != null);
  const now = Date.now();
  const startMs = times.length ? Math.min(...times, now) : now;
  const endMs = times.length ? Math.max(...times, now + 7 * 86400000) : now + 7 * 86400000;

  const projectEvents = events.filter((e) => e.kind !== "unavailability");
  const projectLane: TlLane = {
    id: "project",
    label: "Project",
    kind: "project",
    events: projectEvents,
    availabilityNote: null,
    hasExplicitUnavailability: false,
  };

  const personLanes: TlLane[] = [];
  for (const person of project?.stakeholders ?? []) {
    const lane = personLane(state, projectId, person, events);
    if (lane) personLanes.push(lane);
  }

  return {
    startMs,
    endMs: Math.max(endMs, startMs + 86400000),
    projectLane,
    personLanes,
    events,
    sparse: events.length > 0 && events.length < 3,
    empty: events.length === 0,
  };
}

function personLane(
  state: MissionState,
  projectId: string,
  person: Stakeholder,
  events: TlEvent[],
): TlLane | null {
  const bundle = getPersonBundle(state, projectId, person.id);
  const meetings = (state.meetings ?? []).filter(
    (m) =>
      m.projectId === projectId &&
      m.attendees.some((name) => namesMatchExact(name, person.name)),
  );
  const personEvents: TlEvent[] = [];

  for (const meeting of meetings) {
    const existing = events.find((e) => e.meetingId === meeting.id);
    if (existing) {
      personEvents.push({
        ...existing,
        id: `person-mtg:${person.id}:${meeting.id}`,
        personId: person.id,
        personName: person.name,
      });
    }
  }

  for (const event of events) {
    if (event.kind !== "unavailability") continue;
    const linked =
      event.personId === person.id ||
      (event.personName && namesMatchExact(event.personName, person.name)) ||
      tokens(event.title).some((t) => person.name.toLowerCase().includes(t));
    if (linked) {
      personEvents.push({
        ...event,
        id: `person-away:${person.id}:${event.id}`,
        personId: person.id,
        personName: person.name,
      });
    }
  }

  for (const todo of state.todos ?? []) {
    if (todo.projectId !== projectId || todo.done || !todo.dueAt) continue;
    if (!todo.waitingOn || !namesMatchExact(todo.waitingOn, person.name)) continue;
    personEvents.push({
      id: `person-todo:${person.id}:${todo.id}`,
      kind: "todo",
      title: todo.title,
      startAt: todo.dueAt,
      personId: person.id,
      personName: person.name,
      source: "todo",
    });
  }

  if (!personEvents.length) return null;

  const explicit = personEvents.filter((e) => e.kind === "unavailability");
  let availabilityNote: TlLane["availabilityNote"] = NO_UNAVAILABILITY_RECORDED;
  if (explicit.length) {
    const first = bundle?.availability[0];
    const meta = first?.item.meta?.availability;
    availabilityNote =
      formatAwayRange(meta?.awayFromIso, meta?.awayToIso) ??
      explicit[0]!.title;
  }

  return {
    id: person.id,
    label: person.name,
    kind: "person",
    personId: person.id,
    events: personEvents,
    availabilityNote,
    hasExplicitUnavailability: explicit.length > 0,
  };
}

export function eventLeftPercent(
  event: TlEvent,
  startMs: number,
  spanMs: number,
): number {
  const t = dayMs(event.startAt) ?? startMs;
  return Math.min(100, Math.max(0, ((t - startMs) / Math.max(spanMs, 1)) * 100));
}

export function eventWidthPercent(
  event: TlEvent,
  startMs: number,
  spanMs: number,
): number {
  const from = dayMs(event.startAt) ?? startMs;
  const to = event.endAt ? (dayMs(event.endAt) ?? from) : from;
  const width = ((Math.max(to, from) - from) / Math.max(spanMs, 1)) * 100;
  return Math.max(width, event.kind === "unavailability" ? 4 : 1.2);
}

export function nextUpcomingMeeting(
  state: MissionState,
  projectId: string,
): Meeting | null {
  return upcomingMeetings(state, projectId)[0] ?? null;
}

export const SPARSE_TIMELINE_HINT =
  "Lume can show milestones, deadlines, meetings and known unavailability here as it learns them.";
