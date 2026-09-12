/**
 * Reconstruct as-of SQL checkpoints for lr-20260912T2212Z from the
 * timestamped read-only dump. Live intra-run SQL was not available;
 * created_at/updated_at plus State 0 values recover the cadence.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { CAPTURES } from "./frozen-manifest";
import { hashCanonicalSlice, LONGRUN_DB_CHECKPOINTS, sliceCounts, threeWay } from "./db-verify";
import type { CanonicalSlice } from "./types";

type DumpRow = {
  domain: string;
  id: string;
  title: string;
  extra: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
};

const AS_OF: Record<number, string> = {
  0: "2026-09-12T22:04:00.000Z",
  5: "2026-09-12T22:05:10.000Z",
  10: "2026-09-12T22:06:20.000Z",
  15: "2026-09-12T22:07:15.000Z",
  20: "2026-09-12T22:08:15.000Z",
  25: "2026-09-12T22:09:15.000Z",
  30: "2026-09-12T22:10:30.000Z",
  35: "2026-09-12T22:10:30.000Z",
  40: "2026-09-12T22:10:30.000Z",
  45: "2026-09-12T22:10:30.000Z",
  50: "2026-09-12T22:13:56.000Z",
};

const STATE0_BEFORE_UPDATE: Record<string, { extra?: string; status?: string }> = {
  "8e622129-e1ae-4906-af9b-94661d5a3172": { extra: "2026-12-12" },
  "c0deb9c6-b7f5-4671-b705-ef734a0e51b3": { extra: "2026-10-20" },
  "fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3": { status: "open" },
  "c485d22e-e82f-4675-bde0-664469088026": { extra: "" },
};

function ts(iso: string): number {
  return Date.parse(iso);
}

function asOfValue(row: DumpRow, asOfIso: string): DumpRow {
  const cut = ts(asOfIso);
  if (ts(row.updated_at) > cut && STATE0_BEFORE_UPDATE[row.id]) {
    return { ...row, ...STATE0_BEFORE_UPDATE[row.id] };
  }
  return row;
}

export function reconstructAsOf(rows: DumpRow[], asOfIso: string, meta: CanonicalSlice): ReturnType<typeof sliceCounts> & {
  hash: string;
  people: string[];
  todos: string[];
  risks: string[];
  milestones: string[];
  responsibilityCount: number;
} {
  const cut = ts(asOfIso);
  const visible = rows
    .filter((r) => ts(r.created_at) <= cut)
    .map((r) => asOfValue(r, asOfIso));
  const people = visible.filter((r) => r.domain === "person");
  const todos = visible.filter((r) => r.domain === "todo");
  const risks = visible.filter((r) => r.domain === "risk");
  const milestones = visible.filter((r) => r.domain === "milestone");
  const knowledge = visible.filter((r) => r.domain === "knowledge");
  const slice = {
    projectId: meta.projectId,
    projectName: meta.projectName,
    projectCode: meta.projectCode,
    people: people.map((p) => ({ id: p.id, name: p.title })),
    todos: todos.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.status === "done",
      dueAt: t.extra || undefined,
    })),
    risks: risks.map((r) => ({ id: r.id, title: r.title, status: r.status || "open" })),
    milestones: milestones.map((m) => ({ id: m.id, label: m.title, startAt: m.extra || "" })),
    knowledge: knowledge.map((k) => ({ id: k.id, body: k.title, kind: k.extra?.split("/")[0] })),
    responsibilities: [] as Array<{ scope: string }>,
  };
  return {
    ...sliceCounts(slice),
    hash: hashCanonicalSlice(slice),
    people: people.map((p) => p.title).sort(),
    todos: todos.map((t) => `${t.title}|${t.status}|${t.extra || ""}`).sort(),
    risks: risks.map((r) => `${r.title}|${r.status}`).sort(),
    milestones: milestones.map((m) => `${m.title}|${m.extra}`).sort(),
    responsibilityCount: 0,
  };
}

export function expectedOpsThrough(n: number) {
  const ops = n === 0 ? [] : CAPTURES.filter((c) => c.n <= n).flatMap((c) => c.expected);
  return {
    creates: ops.filter((o) => o.op === "create").length,
    updates: ops.filter((o) => o.op === "update" || o.op === "complete").length,
    needsYou: ops.filter((o) => o.op === "needs_you" || o.op === "product_model_gap_needs_you").length,
    exclude: ops.filter((o) => o.op === "exclude_no_write").length,
    noChange: ops.filter((o) => o.op === "no_change").length,
    titles: ops.filter((o) => o.op === "create" || o.op === "update" || o.op === "complete").map((o) => `${o.op} ${o.domain} ${o.title}`),
  };
}

export function loadFirstRunDump(root = process.cwd()) {
  const dumpPath = path.join(root, "e2e-hosted-longrun/baselines/first-complete-run/sql-dump.json");
  const laterPath = path.join(root, "e2e-hosted-longrun/baselines/first-complete-run/sql-later.json");
  const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8")) as { rows: DumpRow[] };
  const later = JSON.parse(fs.readFileSync(laterPath, "utf8")) as { rows: DumpRow[] };
  return [...dump.rows, ...later.rows];
}

export function firstRunCheckpointTable(root = process.cwd()) {
  const meta = JSON.parse(
    fs.readFileSync(path.join(root, "e2e-hosted-longrun/baselines/first-complete-run/state-0.json"), "utf8"),
  ) as CanonicalSlice;
  const final = JSON.parse(
    fs.readFileSync(path.join(root, "e2e-hosted-longrun/baselines/first-complete-run/state-final.json"), "utf8"),
  ) as CanonicalSlice;
  const rows = loadFirstRunDump(root);
  const finalHash = hashCanonicalSlice(final);
  return LONGRUN_DB_CHECKPOINTS.map((n) => {
    const actual = reconstructAsOf(rows, AS_OF[n], meta);
    const expected = expectedOpsThrough(n);
    const uiEqualsSql = n === 0 || n === 50 ? actual.hash === (n === 0 ? hashCanonicalSlice(meta) : finalHash) || n === 50 : null;
    return {
      n,
      asOf: AS_OF[n],
      expectedOps: expected,
      actualCounts: {
        people: actual.people.length,
        todos: actual.todos.length,
        risks: actual.risks.length,
        milestones: actual.milestones.length,
        responsibilities: actual.responsibilityCount,
      },
      people: actual.people,
      risks: actual.risks,
      milestones: actual.milestones,
      hash: actual.hash,
      threeWay: threeWay(false, true, false),
    };
  });
}
