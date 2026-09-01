/**
 * Meeting-scoped Catch Me Up — read-only assembly of existing project truth.
 * Does not persist. Does not use stored generic Meeting.prep advice.
 * Reuses deterministic Tell Me snapshot + meeting / people / risk / todo truth.
 */
import { buildDeterministicSnapshot } from "@/lib/tell-me/snapshot-deterministic";
import { composeKnowledgeCentreItems } from "@/lib/knowledge-centre/four-bucket";
import { daysUntil, formatWhen, upcomingMeetings } from "@/lib/selectors";
import { namesMatchExact } from "@/lib/people/identity";
import type { Meeting, MissionState } from "@/lib/types";

export type CatchUpLine = {
  id: string;
  text: string;
  source: "meeting" | "focus" | "knowledge" | "history" | "risk" | "todo" | "decision" | "date" | "person" | "needs_you";
};

export type MeetingCatchUpBrief = {
  meetingId: string;
  title: string;
  whenLabel: string;
  attendees: string[];
  about: CatchUpLine[];
  mattersNow: CatchUpLine[];
  address: CatchUpLine[];
  context: CatchUpLine[];
  evidence: CatchUpLine[];
  thin: boolean;
};

const GENERIC_PREP_FORBIDDEN = [
  /remember to set an agenda/i,
  /facilitation tip/i,
  /likely questions/i,
  /leadership opportunit/i,
];

export function formatMeetingWhen(iso: string): string {
  const days = daysUntil(iso);
  const d = new Date(iso);
  const time = Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days === 0 && time) return `Today ${time}`;
  if (days === 1 && time) return `Tomorrow ${time}`;
  return formatWhen(iso);
}

function overlap(text: string, needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => n.length > 2 && hay.includes(n.toLowerCase()));
}

function meetingNeedles(meeting: Meeting): string[] {
  return [
    ...meeting.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2),
    ...meeting.attendees,
  ];
}

export function buildMeetingCatchUpBrief(
  state: MissionState,
  meeting: Meeting,
): MeetingCatchUpBrief {
  const project = state.projects.find((p) => p.id === meeting.projectId);
  const snapshot = buildDeterministicSnapshot({
    state,
    projectId: meeting.projectId,
  });
  const needles = meetingNeedles(meeting);
  const composed = composeKnowledgeCentreItems(state, meeting.projectId);
  const about: CatchUpLine[] = [];
  const mattersNow: CatchUpLine[] = [];
  const address: CatchUpLine[] = [];
  const context: CatchUpLine[] = [];

  about.push({
    id: `mtg:${meeting.id}`,
    text: `${meeting.title} · ${formatMeetingWhen(meeting.startsAt)}`,
    source: "meeting",
  });
  if (project?.currentFocus?.trim()) {
    about.push({
      id: `focus:${project.id}`,
      text: project.currentFocus.trim(),
      source: "focus",
    });
  }
  for (const line of snapshot.keyState.slice(0, 4)) {
    if (line.startsWith("Focus:")) continue;
    if (overlap(line, needles) || about.length < 3) {
      const id = `now:${line}`;
      if (!about.some((a) => a.text === line)) {
        about.push({ id, text: line, source: "knowledge" });
      }
    }
  }

  const recentHistory = (state.history ?? [])
    .filter((h) => h.projectId === meeting.projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  for (const event of recentHistory) {
    mattersNow.push({
      id: `hist:${event.id}`,
      text: event.detail?.trim() || event.title,
      source: "history",
    });
  }
  if (!mattersNow.length && project?.currentFocus?.trim()) {
    mattersNow.push({
      id: `matters-focus:${project.id}`,
      text: project.currentFocus.trim(),
      source: "focus",
    });
  }
  for (const risk of snapshot.majorRisks.slice(0, 3)) {
    if (
      overlap(risk, needles) ||
      mattersNow.length < 2
    ) {
      if (!mattersNow.some((l) => l.text === risk)) {
        mattersNow.push({
          id: `risk-now:${risk}`,
          text: risk,
          source: "risk",
        });
      }
    }
  }

  for (const risk of (state.risks ?? []).filter(
    (r) => r.projectId === meeting.projectId && r.status === "open",
  )) {
    address.push({
      id: `risk:${risk.id}`,
      text: risk.title,
      source: "risk",
    });
  }
  for (const todo of (state.todos ?? []).filter(
    (t) => t.projectId === meeting.projectId && !t.done,
  )) {
    const dueSoon =
      todo.dueAt &&
      (daysUntil(todo.dueAt) ?? 99) <= 10;
    const related =
      overlap(todo.title, needles) ||
      meeting.attendees.some((a) =>
        namesMatchExact(a, todo.waitingOn ?? ""),
      );
    if (dueSoon || related || address.length < 3) {
      address.push({
        id: `todo:${todo.id}`,
        text: todo.waitingOn
          ? `${todo.title} (waiting on ${todo.waitingOn})`
          : todo.title,
        source: "todo",
      });
    }
  }
  for (const item of composed.filter((i) => i.needsYou).slice(0, 3)) {
    address.push({
      id: `ny:${item.id}`,
      text: item.needsYou ?? item.title,
      source: "needs_you",
    });
  }

  for (const name of meeting.attendees) {
    const person = project?.stakeholders.find((s) => namesMatchExact(s.name, name));
    if (!person) continue;
    const role = person.role?.trim();
    context.push({
      id: `person:${person.id}`,
      text: role ? `${person.name} — ${role}` : person.name,
      source: "person",
    });
  }
  for (const decision of snapshot.importantKnowledge.slice(0, 4)) {
    if (overlap(decision, needles) || context.length < 4) {
      if (!context.some((l) => l.text === decision)) {
        context.push({
          id: `dec:${decision}`,
          text: decision,
          source: "decision",
        });
      }
    }
  }
  for (const date of snapshot.significantDates.slice(0, 4)) {
    context.push({
      id: `date:${date}`,
      text: date,
      source: "date",
    });
  }

  const uniq = (rows: CatchUpLine[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.text.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const brief: MeetingCatchUpBrief = {
    meetingId: meeting.id,
    title: meeting.title,
    whenLabel: formatMeetingWhen(meeting.startsAt),
    attendees: meeting.attendees,
    about: uniq(about).slice(0, 5),
    mattersNow: uniq(mattersNow).slice(0, 5),
    address: uniq(address).slice(0, 6),
    context: uniq(context).slice(0, 6),
    evidence: [],
    thin: false,
  };
  const safe = (rows: CatchUpLine[]) =>
    rows.filter((line) => !GENERIC_PREP_FORBIDDEN.some((b) => b.test(line.text)));
  brief.about = safe(brief.about);
  brief.mattersNow = safe(brief.mattersNow);
  brief.address = safe(brief.address);
  brief.context = safe(brief.context);
  brief.evidence = [
    ...brief.about,
    ...brief.mattersNow,
    ...brief.address,
    ...brief.context,
  ];
  brief.thin = brief.evidence.length <= 2;

  return brief;
}

export function briefUsesStoredPrepAdvice(
  brief: MeetingCatchUpBrief,
  meeting: Meeting,
): boolean {
  const prepBits = [
    ...meeting.prep.talkingPoints,
    ...meeting.prep.questionsToAsk,
    ...meeting.prep.stakeholderConcerns,
    ...meeting.prep.leadershipOpportunities,
    meeting.prep.openingScript,
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  return brief.evidence.some((line) =>
    prepBits.some((bit) => line.text.includes(bit)),
  );
}

export function nextKnownMeeting(
  state: MissionState,
  projectId: string,
): Meeting | null {
  return upcomingMeetings(state, projectId)[0] ?? null;
}
