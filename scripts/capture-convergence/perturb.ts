/**
 * Seedable, deterministic perturbation generators. No extra dependency.
 */

import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";
import { obs } from "./obs";
import { mulberry32, seededPick, seededShuffle } from "./seed";

export const IRRELEVANT_SENTENCES: readonly string[] = [
  "The coffee machine is broken again.",
  "Someone left the window open in the meeting room.",
  "Parking is busy today.",
  "The projector remote is missing.",
  "Lunch catering arrived late.",
  "The lift is out of service on floor three.",
  "Wi-Fi in the annex is intermittent.",
  "Please remember to recycle.",
  "The fire drill is next Thursday.",
  "Office plants need watering.",
  "The printer is jammed.",
  "Someone booked the wrong room.",
];

export const UNRELATED_PEOPLE: readonly string[] = [
  "Jordan Hale",
  "Priya Nair",
  "Marcus Chen",
  "Elena Voss",
  "Theo Brandt",
];

export const UNRELATED_DATES: readonly string[] = [
  "3 March",
  "next Tuesday",
  "the 14th",
  "end of Q3",
  "mid-October",
];

export const AMBIGUOUS_SENTENCES: readonly string[] = [
  "They will take ownership of it.",
  "She said it should move.",
  "We should probably do something about that.",
  "It might slip if we are not careful.",
  "Someone needs to follow up.",
];

export type EnvelopeRow = CaptureObservationV2 | Record<string, unknown>;

export type PerturbationKind =
  | "prepend-irrelevant"
  | "append-irrelevant"
  | "insert-irrelevant"
  | "reorder"
  | "duplicate"
  | "first-name"
  | "unrelated-people"
  | "unrelated-dates"
  | "ambiguous-beside"
  | "malformed-beside";

function irrId(seed: number, tag: string): string {
  return `obs-irr-${tag}-${seed >>> 0}`;
}

export function irrelevantCommentary(seed: number, tag: string): CaptureObservationV2 {
  const rng = mulberry32(seed);
  const text = seededPick(rng, [...IRRELEVANT_SENTENCES]);
  return obs({
    id: irrId(seed, tag),
    statement: text,
    evidence: text,
    domain: "commentary",
    disposition: "commentary",
    truthIntent: "current",
  });
}

export function malformedRow(seed: number): Record<string, unknown> {
  const rng = mulberry32(seed);
  const variants: Record<string, unknown>[] = [
    { id: `obs-mal-${seed}-domain`, domain: "issue" },
    { id: `obs-mal-${seed}-empty-title`, domain: "todo", title: "", statement: "" },
    { id: `obs-mal-${seed}-empty-name`, domain: "person", name: "", disposition: "create_new" },
    { id: `obs-mal-${seed}-know`, domain: "knowledge" },
    {
      id: `obs-mal-${seed}-blank-ms`,
      domain: "milestone",
      statement: "   ",
      evidence: "   ",
      disposition: "update_existing",
      truthIntent: "current",
    },
    {
      id: `obs-mal-${seed}-no-intent`,
      statement: "Something happened.",
      evidence: "Something happened.",
      domain: "todo",
      disposition: "create_new",
    },
  ];
  return seededPick(rng, variants);
}

export function prependIrrelevant(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  return [irrelevantCommentary(seed, "pre"), ...rows];
}

export function appendIrrelevant(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  return [...rows, irrelevantCommentary(seed, "app")];
}

export function insertIrrelevantBetween(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  if (rows.length < 2) return appendIrrelevant(rows, seed);
  const rng = mulberry32(seed);
  const i = 1 + Math.floor(rng() * (rows.length - 1));
  return [...rows.slice(0, i), irrelevantCommentary(seed, "mid"), ...rows.slice(i)];
}

export function reorderIndependent(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  return seededShuffle(mulberry32(seed), rows);
}

export function duplicateObservation(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  if (rows.length === 0) return rows;
  const rng = mulberry32(seed);
  const i = Math.floor(rng() * rows.length);
  const src = rows[i]!;
  const id =
    src && typeof src === "object" && "id" in src ? String((src as { id?: unknown }).id) : "x";
  const dup = { ...(src as object), id: `obs-dup-${id}-${seed >>> 0}` } as EnvelopeRow;
  const insertAt = Math.floor(rng() * (rows.length + 1));
  const out = rows.slice();
  out.splice(insertAt, 0, dup);
  return out;
}

export function replaceFullNameWithFirst(rows: EnvelopeRow[]): EnvelopeRow[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const rec = row as Record<string, unknown>;
    const proposed =
      rec.proposedValues && typeof rec.proposedValues === "object"
        ? { ...(rec.proposedValues as Record<string, unknown>) }
        : {};
    const name =
      (typeof proposed.name === "string" && proposed.name) ||
      (typeof proposed.personName === "string" && proposed.personName) ||
      (typeof rec.candidateTargetTitle === "string" && rec.candidateTargetTitle) ||
      "";
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return row;
    const first = parts[0]!;
    const rewrite = (value: unknown) =>
      typeof value === "string" ? value.replaceAll(name, first) : value;
    if (proposed.name) proposed.name = first;
    if (proposed.personName) proposed.personName = first;
    return {
      ...rec,
      statement: rewrite(rec.statement),
      evidence: rewrite(rec.evidence),
      candidateTargetTitle: first,
      proposedValues: Object.keys(proposed).length ? proposed : rec.proposedValues,
    } as EnvelopeRow;
  });
}

export function addUnrelatedNamedPeople(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  const rng = mulberry32(seed);
  const name = seededPick(rng, [...UNRELATED_PEOPLE]);
  return [
    ...rows,
    obs({
      id: irrId(seed, "person"),
      statement: `${name} joined the parking-committee chat.`,
      evidence: `${name} joined the parking-committee chat.`,
      domain: "person",
      disposition: "create_new",
      truthIntent: "current",
      candidateTargetTitle: name,
      proposedValues: { name },
    }),
  ];
}

export function addUnrelatedDates(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  const rng = mulberry32(seed);
  const when = seededPick(rng, [...UNRELATED_DATES]);
  const title = `Book the offsite for ${when}`;
  return [
    ...rows,
    obs({
      id: irrId(seed, "date"),
      statement: title,
      evidence: title,
      domain: "todo",
      disposition: "create_new",
      truthIntent: "current",
      proposedValues: { title, dueAt: when },
    }),
  ];
}

export function addAmbiguousBeside(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  const rng = mulberry32(seed);
  const text = seededPick(rng, [...AMBIGUOUS_SENTENCES]);
  return [
    ...rows,
    obs({
      id: irrId(seed, "amb"),
      statement: text,
      evidence: text,
      domain: "responsibility",
      disposition: "ambiguous",
      truthIntent: "uncertain",
      proposedValues: { ownershipSemantics: "ambiguous" },
    }),
  ];
}

export function addMalformedBeside(rows: EnvelopeRow[], seed: number): EnvelopeRow[] {
  return [...rows, malformedRow(seed)];
}

export function applyPerturbation(
  kind: PerturbationKind,
  rows: EnvelopeRow[],
  seed: number,
): EnvelopeRow[] {
  switch (kind) {
    case "prepend-irrelevant":
      return prependIrrelevant(rows, seed);
    case "append-irrelevant":
      return appendIrrelevant(rows, seed);
    case "insert-irrelevant":
      return insertIrrelevantBetween(rows, seed);
    case "reorder":
      return reorderIndependent(rows, seed);
    case "duplicate":
      return duplicateObservation(rows, seed);
    case "first-name":
      return replaceFullNameWithFirst(rows);
    case "unrelated-people":
      return addUnrelatedNamedPeople(rows, seed);
    case "unrelated-dates":
      return addUnrelatedDates(rows, seed);
    case "ambiguous-beside":
      return addAmbiguousBeside(rows, seed);
    case "malformed-beside":
      return addMalformedBeside(rows, seed);
  }
}

export function transcriptFromRows(rows: EnvelopeRow[], extra = ""): string {
  const parts = rows
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const rec = row as Record<string, unknown>;
      const bits = [rec.statement, rec.evidence, rec.name, rec.title, rec.text].filter(
        (v) => typeof v === "string" && String(v).trim(),
      );
      return bits.map((v) => String(v).trim()).join(" ");
    })
    .filter(Boolean);
  if (extra.trim()) parts.push(extra.trim());
  return parts.join("\n\n");
}
