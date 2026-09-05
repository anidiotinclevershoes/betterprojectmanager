/**
 * Read-only Timeline projection over existing dated truth.
 * Does not persist, infer availability, or invent calendar rows.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import { formatAwayRange } from "@/lib/knowledge-centre/format-date-label";
import { getPersonBundle, namesMatchExact } from "@/lib/people/identity";
import { formatDayMonth, upcomingMeetings } from "@/lib/selectors";
import type { Meeting, MissionState, Stakeholder } from "@/lib/types";

/** Quiet metadata — never “available”. */
export const AVAILABILITY_NOT_PROVIDED = "availability not provided";
/** Alias kept for existing tests / copy checks. */
export const NO_UNAVAILABILITY_RECORDED = AVAILABILITY_NOT_PROVIDED;

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
  attendees?: string[];
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

export type EventWhen = "past" | "today" | "upcoming";

export type PackedEvent = {
  event: TlEvent;
  left: number;
  width: number;
  stack: number;
  when: EventWhen;
  label: string;
};

export type AxisTick = {
  ms: number;
  label: string;
  left: number;
};

const DAY = 86400000;
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "for",
  "of",
  "to",
  "on",
  "in",
  "with",
  "from",
]);

function dayMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
      attendees: meeting.attendees,
      source: "meeting",
    });
  }

  const times = events
    .flatMap((e) => [dayMs(e.startAt), e.endAt ? dayMs(e.endAt) : null])
    .filter((n): n is number => n != null);
  const now = Date.now();
  const sparse = events.length > 0 && events.length < 3;
  let startMs: number;
  let endMs: number;
  if (!times.length) {
    startMs = now;
    endMs = now + 7 * DAY;
  } else {
    const earliest = Math.min(...times);
    const latest = Math.max(...times);
    if (sparse) {
      startMs = earliest - 3 * DAY;
      endMs = latest + 4 * DAY;
      if (now < startMs && startMs - now <= 10 * DAY) startMs = now - DAY;
      if (now > endMs && now - endMs <= 10 * DAY) endMs = now + DAY;
    } else {
      startMs = Math.min(earliest - DAY, now - 2 * DAY);
      endMs = Math.max(latest + 2 * DAY, now + 14 * DAY);
    }
  }

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
    endMs: Math.max(endMs, startMs + DAY),
    projectLane,
    personLanes,
    events,
    sparse,
    empty: events.length === 0,
  };
}

function personLinked(event: TlEvent, person: Stakeholder): boolean {
  if (event.personId && event.personId === person.id) return true;
  if (event.personName && namesMatchExact(event.personName, person.name)) {
    return true;
  }
  return false;
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
        attendees: existing.attendees ?? meeting.attendees,
      });
    }
  }

  for (const event of events) {
    if (event.kind !== "unavailability") continue;
    if (!personLinked(event, person)) continue;
    personEvents.push({
      ...event,
      id: `person-away:${person.id}:${event.id}`,
      personId: person.id,
      personName: person.name,
    });
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
  let availabilityNote: TlLane["availabilityNote"] = AVAILABILITY_NOT_PROVIDED;
  if (explicit.length) {
    const first = bundle?.availability[0];
    const meta = first?.item.meta?.availability;
    availabilityNote =
      formatAwayRange(meta?.awayFromIso, meta?.awayToIso) ??
      formatAwayRange(explicit[0]!.startAt, explicit[0]!.endAt) ??
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

export function eventWhen(event: TlEvent, now = Date.now()): EventWhen {
  const from = dayMs(event.startAt) ?? now;
  const to = event.endAt ? (dayMs(event.endAt) ?? from) : from;
  const today0 = startOfLocalDay(now);
  const today1 = today0 + DAY;
  if (to < today0) return "past";
  if (from < today1 && to >= today0) return "today";
  return "upcoming";
}

export function eventKindLabel(kind: TlEventKind): string {
  if (kind === "unavailability") return "Away";
  if (kind === "todo") return "To Do";
  if (kind === "deadline") return "Deadline";
  if (kind === "milestone") return "Milestone";
  if (kind === "meeting") return "Meeting";
  return "Date";
}

/**
 * Compact glance label from the authoritative title — not a single-letter code.
 */
export function shortEventLabel(event: TlEvent): string {
  if (event.kind === "unavailability") return "Away";
  const title = event.title.trim();
  if (!title) return eventKindLabel(event.kind);

  const specific: Array<[RegExp, string]> = [
    [/\bcab pack\b/i, "CAB pack"],
    [/\bcab prep/i, "CAB prep"],
    [/\bcab approval\b/i, "CAB"],
    [/\buat\b/i, "UAT"],
    [/production/i, "Production"],
    [/merge\s+(window|freeze)/i, "Merge"],
    [/\bdeadline\b/i, "Deadline"],
  ];
  for (const [re, label] of specific) {
    if (re.test(title)) return label;
  }
  if (/\bcab\b/i.test(title)) return "CAB";

  const words = title
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  if (!words.length) return eventKindLabel(event.kind);
  const compact = words.slice(0, 2).join(" ");
  return compact.length > 16 ? `${compact.slice(0, 15).trimEnd()}…` : compact;
}

export function eventWhenLabel(event: TlEvent): string {
  const day = formatDayMonth(event.startAt);
  if (event.kind !== "meeting") return day;
  const d = new Date(event.startAt);
  if (Number.isNaN(d.getTime())) return day;
  const hours = d.getHours();
  const mins = d.getMinutes();
  if (hours === 0 && mins === 0) return day;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  return `${day} · ${hh}:${mm}`;
}

export function packLaneEvents(
  events: TlEvent[],
  startMs: number,
  spanMs: number,
): PackedEvent[] {
  const packed: PackedEvent[] = events
    .slice()
    .sort((a, b) => (dayMs(a.startAt) ?? 0) - (dayMs(b.startAt) ?? 0))
    .map((event) => {
      const rawWidth = eventWidthPercent(event, startMs, spanMs);
      const width =
        event.kind === "unavailability"
          ? Math.max(rawWidth, 6)
          : Math.max(rawWidth, 8);
      return {
        event,
        left: eventLeftPercent(event, startMs, spanMs),
        width: Math.min(width, 100),
        stack: 0,
        when: eventWhen(event),
        label: shortEventLabel(event),
      };
    });

  const pad = 1.2;
  for (let i = 0; i < packed.length; i += 1) {
    const used = new Set<number>();
    for (let j = 0; j < i; j += 1) {
      const a = packed[i]!;
      const b = packed[j]!;
      const overlap =
        a.left < b.left + b.width + pad && b.left < a.left + a.width + pad;
      if (overlap) used.add(b.stack);
    }
    let stack = 0;
    while (used.has(stack)) stack += 1;
    packed[i]!.stack = stack;
  }
  return packed;
}

export function compactPreviewEvents(
  view: TlProjection,
  limit = 3,
): TlEvent[] {
  if (view.empty || view.sparse) return [];
  const now = Date.now();
  const upcoming = view.projectLane.events
    .filter((e) => {
      const t = dayMs(e.startAt);
      return t != null && t >= now - DAY;
    })
    .sort((a, b) => (dayMs(a.startAt) ?? 0) - (dayMs(b.startAt) ?? 0));
  const unique: TlEvent[] = [];
  const seen = new Set<string>();
  for (const event of upcoming) {
    const key = `${shortEventLabel(event)}:${event.startAt.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function todayLeftPercent(
  startMs: number,
  spanMs: number,
  now = Date.now(),
): number | null {
  if (now < startMs || now > startMs + spanMs) return null;
  return ((now - startMs) / Math.max(spanMs, 1)) * 100;
}

export function axisTicks(startMs: number, endMs: number): AxisTick[] {
  const span = Math.max(endMs - startMs, 1);
  const days = span / DAY;
  const stepDays = days <= 18 ? 3 : days <= 40 ? 7 : 14;
  const step = stepDays * DAY;
  const origin = new Date(startMs);
  origin.setHours(0, 0, 0, 0);
  let t = origin.getTime();
  const ticks: AxisTick[] = [];
  while (t <= endMs + DAY / 2) {
    const left = ((t - startMs) / span) * 100;
    if (left >= -1 && left <= 101) {
      ticks.push({
        ms: t,
        label: formatDayMonth(t),
        left: Math.min(100, Math.max(0, left)),
      });
    }
    t += step;
  }
  return ticks;
}

export function nextUpcomingMeeting(
  state: MissionState,
  projectId: string,
): Meeting | null {
  return upcomingMeetings(state, projectId)[0] ?? null;
}

export const SPARSE_TIMELINE_HINT =
  "Lume can show milestones, deadlines, meetings and known unavailability here as it learns them.";
