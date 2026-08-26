/**
 * Lume's internal shape for a project object.
 *
 * One grammar for every kind of object — person, risk, to do, milestone,
 * decision, area of work, and whatever Lume holds in future. The user never
 * sees this abstraction; they see people, risks, dates and tasks.
 *
 * Content is STRUCTURED by default. Prose is the exception, not the norm.
 */

export type EntityKind =
  | "person"
  | "risk"
  | "task"
  | "date"
  | "milestone"
  | "decision"
  | "issue"
  | "waiting"
  | "area"
  | "position"
  | "meeting";

/** Epistemic state. `known` is ordinary project knowledge and looks ordinary. */
export type Trust = "known" | "noticed" | "needs-you";

export type Severity = "high" | "medium" | "low";

/** One row in RIGHT NOW. `ref` makes the value open that object. */
export interface Fact {
  label: string;
  value: string;
  ref?: string;
}

/** One row in CONNECTED TO. Labels come from Lume's fixed vocabulary. */
export interface Connection {
  label: string;
  targetId: string;
}

export interface EvidenceItem {
  source: string;
  when: string;
  quote?: string;
}

export interface HistoryItem {
  when: string;
  text: string;
  was?: string;
}

/** A real human decision Lume cannot make. No suggested answers. */
export interface NeedsYou {
  statement: string;
  question: string;
}

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  /** Overrides the type label shown in the inspector header. */
  typeLabel?: string;
  /** Person subtitle only. */
  role?: string;
  initials?: string;
  /** The concise second line on the Ocean card. */
  meta?: string;
  severity?: Severity;

  trust: Trust;
  /** Why Lume derived this. Shown only inside More details. */
  noticedBecause?: string;
  needsYou?: NeedsYou;

  /** 3–5 rows, most important first. */
  now: Fact[];
  /** Appended to RIGHT NOW inside More details. */
  moreNow?: Fact[];

  /** 2–4 genuinely useful connections. Omit when there are none. */
  connected?: Connection[];
  /** Revealed inside More details. */
  moreConnected?: Connection[];

  /** One-line provenance shown in the compact inspector. */
  source?: { name: string; when: string };
  /** Fuller evidence behind More details. */
  evidence?: EvidenceItem[];
  history?: HistoryItem[];

  /** Contextual, object-specific. Usually one or two. */
  actions?: string[];

  dateISO?: string;
  dateEndISO?: string;
  /** What the date MEANS — Due, CAB, Away, Release, Freeze, Starts. */
  dateSemantic?: string;
}

export type EntityMap = Record<string, Entity>;
