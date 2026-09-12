/**
 * Deterministic case library. Metamorphic cases are generated from seeds.
 * Do not author hundreds of near-identical fixtures by hand.
 */

import { FROZEN_MODEL_OUTPUTS } from "../../src/lib/eval-capture-v2/frozen-model-outputs";
import { observationsOf } from "./obs";
import {
  ANDRIS,
  AURORA_COMMENTARY,
  AURORA_TODO,
  BANNERS,
  BRIDGE,
  CAB_CANCEL,
  CANDYLAND_ID,
  DATE_MOVE,
  FIZZ_AWAY,
  OLGA_PERSON,
  OLGA_SARAH_PASTE,
  OLGA_UAT,
  PARADE_MOVE,
  PIPPA,
  RUNBOOK_V3,
  SARAH_RELEASE,
  SHARE_REPLACE,
  SHE_UAT,
  SOLO_BASES,
  TOYWORLD_ID,
  VELVET,
  makeCase,
  pack,
  seedFrom,
} from "./library";
import {
  applyPerturbation,
  type EnvelopeRow,
  type PerturbationKind,
  transcriptFromRows,
} from "./perturb";
import { permuteOrSample } from "./seed";
import type { ConvergenceCase } from "./types";
import { AURORA_ID, OLGA_ID, SARAH_ID } from "./worlds";

const FROZEN_EXPECT: Record<
  string,
  ConvergenceCase["expect"] & { projectId: string }
> = {
  "existing-person": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-pippa": "no_change" },
  },
  "new-person": {
    projectId: TOYWORLD_ID,
    decisionById: { "obs-velvet": "write" },
    writeTypeById: { "obs-velvet": "ensure_person" },
  },
  "existing-risk-update": {
    projectId: TOYWORLD_ID,
    decisionById: { "obs-packaging-worse": "write" },
  },
  "risk-resolution": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-bridge-closed": "write" },
  },
  "milestone-move": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-parade": "write" },
    writeTypeById: { "obs-parade": "update_milestone" },
  },
  "todo-create": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-banners": "write" },
    writeTypeById: { "obs-banners": "create_todo" },
  },
  "availability": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-fizz-away": "write" },
  },
  "share-vs-replace-ambiguous": {
    projectId: CANDYLAND_ID,
    decisionById: { "obs-share-replace": "needs_you" },
  },
  "duplicate-observation": {
    projectId: TOYWORLD_ID,
    decisionById: { "obs-a": "write", "obs-b": "no_change" },
  },
};

function frozenProjectId(caseId: string): string {
  if (caseId.includes("toy") || caseId === "new-person" || caseId === "existing-risk-update" || caseId === "duplicate-observation") {
    return TOYWORLD_ID;
  }
  if (caseId.includes("game") || caseId === "foreign-ids-malformed-envelope") return CANDYLAND_ID;
  return FROZEN_EXPECT[caseId]?.projectId ?? CANDYLAND_ID;
}

function soloId(key: string) {
  return `solo-${key}`;
}

function soloCases(): ConvergenceCase[] {
  return SOLO_BASES.map((base) => {
    const packed = pack(base.rows);
    return makeCase({
      id: soloId(base.key),
      family: "information_preservation",
      baseScenario: base.key,
      perturbation: "none (solo baseline)",
      expectedInvariant: "solo run is the comparison anchor; not itself a pass/fail product claim",
      world: base.world,
      projectId: base.projectId,
      focusIds: base.focusIds,
      ...packed,
      expect: {
        preserve: base.focusIds.map((id) => ({
          id,
          fields: ["statement", "evidence", "name", "scope", "date"],
        })),
      },
    });
  });
}

function historicalCases(): ConvergenceCase[] {
  const out: ConvergenceCase[] = [];
  for (const frozen of FROZEN_MODEL_OUTPUTS) {
    const rows = observationsOf(frozen.rawModelJson);
    const expect = FROZEN_EXPECT[frozen.caseId];
    const projectId = expect?.projectId ?? frozenProjectId(frozen.caseId);
    out.push(
      makeCase({
        id: `hist-${frozen.caseId}`,
        family: "historical_regression",
        baseScenario: frozen.caseId,
        perturbation: "none (frozen envelope)",
        expectedInvariant: `Frozen Lume path for ${frozen.caseId} keeps its previously locked decision`,
        world: "experimental",
        projectId,
        focusIds: rows.map((row) => row.id),
        transcript: transcriptFromRows(rows),
        rawModelJson: frozen.rawModelJson,
        expect: expect
          ? {
              decisionById: expect.decisionById,
              writeTypeById: expect.writeTypeById,
            }
          : undefined,
      }),
    );
  }

  out.push(
    makeCase({
      id: "hist-aurora-date-move",
      family: "historical_regression",
      baseScenario: "aurora-date-move",
      perturbation: "none",
      expectedInvariant: "Production release date move is an update_milestone write",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-date"],
      ...pack([DATE_MOVE]),
      expect: {
        decisionById: { "obs-date": "write" },
        writeTypeById: { "obs-date": "update_milestone" },
      },
    }),
    makeCase({
      id: "hist-aurora-andris-isolated",
      family: "historical_regression",
      baseScenario: "aurora-andris-isolated",
      perturbation: "none",
      expectedInvariant: "Andris alone is Needs You (incomplete recorded name)",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-andris"],
      ...pack([ANDRIS]),
      expect: {
        decisionById: { "obs-andris": "needs_you" },
        reasonClassById: { "obs-andris": "needs_you_identity_incomplete" },
      },
    }),
    makeCase({
      id: "hist-aurora-andris-full-paste",
      family: "historical_regression",
      baseScenario: "aurora-andris-full-paste",
      perturbation: "transcript also names Olga Petrov and Sarah Kim",
      expectedInvariant:
        "Andris in a paste that also names Olga+Sarah stays incomplete-name Needs You; sibling names must not become a multiple-match",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-andris"],
      ...pack([ANDRIS], OLGA_SARAH_PASTE),
      expect: {
        decisionById: { "obs-andris": "needs_you" },
        reasonClassById: { "obs-andris": "needs_you_identity_incomplete" },
      },
    }),
    makeCase({
      id: "hist-aurora-pronoun-uat",
      family: "historical_regression",
      baseScenario: "aurora-pronoun-uat",
      perturbation: "none",
      expectedInvariant: "Pronoun + two named people stays Needs You",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-she"],
      ...pack([SHE_UAT]),
      expect: { decisionById: { "obs-she": "needs_you" } },
    }),
    makeCase({
      id: "hist-np-olga-sarah",
      family: "historical_regression",
      surface: "new_project",
      baseScenario: "np-olga-sarah-responsibilities",
      perturbation: "none",
      expectedInvariant: "Olga/Sarah UAT and Release scopes survive the NP mapper; no Needs You re-ask",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-uat", "obs-sarah-rel"],
      ...pack([OLGA_UAT, SARAH_RELEASE]),
      expect: {
        np: {
          needsYouCount: 0,
          responsibilitiesByName: {
            "Olga Petrov": ["UAT"],
            "Sarah Kim": ["Release"],
          },
        },
      },
    }),
    makeCase({
      id: "hist-np-name-only",
      family: "historical_regression",
      surface: "new_project",
      baseScenario: "np-name-only-person",
      perturbation: "none",
      expectedInvariant: "Name-only Person is complete; no Needs You",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-sarah-murphy"],
      ...pack([
        {
          id: "obs-sarah-murphy",
          statement: "Sarah Murphy is on the project.",
          evidence: "Sarah Murphy is on the project.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "Sarah Murphy", responsibilities: [] },
        },
      ]),
      expect: {
        np: { needsYouCount: 0, responsibilitiesByName: { "Sarah Murphy": [] } },
      },
    }),
    makeCase({
      id: "hist-np-informal-name-only",
      family: "historical_regression",
      surface: "new_project",
      baseScenario: "np-informal-name-only-people",
      perturbation: "none (schema-valid name-only people)",
      expectedInvariant:
        "Schema-valid name-only Person observations survive Organise; missing responsibility is not a discard",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-bob", "obs-mike"],
      ...pack([
        {
          id: "obs-bob",
          statement: "bob is the ba",
          evidence: "bob is the ba",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "bob" },
        },
        {
          id: "obs-mike",
          statement: "mike handles the legacy builds",
          evidence: "mike handles the legacy builds",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "mike" },
        },
      ]),
      expect: {
        np: {
          needsYouCount: 0,
          names: ["bob", "mike"],
          responsibilitiesByName: { bob: [], mike: [] },
        },
      },
    }),
  );
  return out;
}

function pairCases(): ConvergenceCase[] {
  const pairs: Array<{
    id: string;
    family: ConvergenceCase["family"];
    a: string;
    b: string;
    extra?: string;
    perturbation: string;
    invariant: string;
  }> = [
    {
      id: "cross-andris-olga-uat",
      family: "cross_observation_contamination",
      a: "andris",
      b: "olga-uat",
      perturbation: "Andris + Olga UAT observations together",
      invariant:
        "Andris decision/reasonClass stays the solo incomplete-name Needs You; Olga must not retarget Andris",
    },
    {
      id: "cross-andris-sarah-rel",
      family: "cross_observation_contamination",
      a: "andris",
      b: "sarah-release",
      perturbation: "Andris + Sarah Release together",
      invariant: "Andris stays independent of Sarah",
    },
    {
      id: "cross-andris-date",
      family: "cross_observation_contamination",
      a: "andris",
      b: "date-move",
      perturbation: "Andris + date move",
      invariant: "Date write and Andris Needs You stay local",
    },
    {
      id: "cross-andris-todo",
      family: "cross_observation_contamination",
      a: "andris",
      b: "aurora-todo",
      perturbation: "Andris + unrelated todo",
      invariant: "Todo create does not change Andris identity",
    },
    {
      id: "cross-olga-sarah",
      family: "cross_observation_contamination",
      a: "olga-uat",
      b: "sarah-release",
      perturbation: "Olga UAT + Sarah Release",
      invariant: "Each person's scope stays on that person",
    },
    {
      id: "cross-date-runbook",
      family: "cross_observation_contamination",
      a: "date-move",
      b: "runbook",
      perturbation: "Date move + runbook knowledge",
      invariant: "Milestone write is independent of knowledge create",
    },
    {
      id: "cross-parade-fizz",
      family: "cross_observation_contamination",
      a: "parade",
      b: "fizz-away",
      perturbation: "Parade move + Fizz availability",
      invariant: "Independent Candyland observations stay independent",
    },
    {
      id: "cross-banners-bridge",
      family: "cross_observation_contamination",
      a: "banners",
      b: "bridge",
      perturbation: "Todo create + risk resolve",
      invariant: "Todo and risk stay in their domains",
    },
    {
      id: "cross-pippa-velvet-worlds",
      family: "cross_observation_contamination",
      a: "pippa",
      b: "velvet",
      perturbation: "Pippa (Candyland envelope) beside Velvet (Toyworld ids) on Candyland entry",
      invariant: "Foreign Velvet ids fail closed; Pippa semantics unchanged",
    },
    {
      id: "cross-andris-transcript-olga-sarah",
      family: "cross_observation_contamination",
      a: "andris",
      b: "andris",
      extra: OLGA_SARAH_PASTE,
      perturbation: "Andris envelope only; transcript also names Olga Petrov and Sarah Kim",
      invariant:
        "Sibling names in the Capture text must not change Andris from incomplete-name to multiple-match",
    },
  ];

  const byKey = new Map(SOLO_BASES.map((b) => [b.key, b]));
  const out: ConvergenceCase[] = [];
  for (const pair of pairs) {
    const left = byKey.get(pair.a)!;
    const right = byKey.get(pair.b)!;
    const rows =
      pair.id === "cross-andris-transcript-olga-sarah"
        ? left.rows
        : [...left.rows, ...right.rows.filter((row) => !left.rows.includes(row))];
    const packed = pack(rows, pair.extra ?? "");
    const sameProject = left.projectId === right.projectId && left.world === right.world;
    const reverse =
      pair.id === "cross-andris-transcript-olga-sarah" || !sameProject
        ? null
        : [...right.rows, ...left.rows.filter((row) => !right.rows.includes(row))];
    out.push(
      makeCase({
        id: pair.id,
        family: pair.family,
        baseScenario: pair.a,
        perturbation: pair.perturbation,
        expectedInvariant: pair.invariant,
        world: left.world,
        projectId: left.projectId,
        focusIds: left.focusIds,
        compareToId: soloId(pair.a),
        ...packed,
      }),
    );
    if (reverse) {
      out.push(
        makeCase({
          id: `${pair.id}-rev`,
          family: pair.family,
          baseScenario: pair.b,
          perturbation: `${pair.perturbation} (reversed order)`,
          expectedInvariant: pair.invariant,
          world: right.world,
          projectId: right.projectId,
          focusIds: right.focusIds,
          compareToId: soloId(pair.b),
          ...pack(reverse),
        }),
      );
    }
  }
  return out;
}

function orderCases(): ConvergenceCase[] {
  const groups: Array<{
    id: string;
    world: ConvergenceCase["world"];
    projectId: string;
    rows: EnvelopeRow[];
    focusIds: string[];
  }> = [
    {
      id: "order-aurora-independent",
      world: "aurora",
      projectId: AURORA_ID,
      rows: [DATE_MOVE, RUNBOOK_V3, AURORA_TODO, AURORA_COMMENTARY],
      focusIds: ["obs-date", "obs-runbook", "obs-aurora-todo"],
    },
    {
      id: "order-candy-independent",
      world: "experimental",
      projectId: CANDYLAND_ID,
      rows: [PARADE_MOVE, FIZZ_AWAY, BANNERS, BRIDGE],
      focusIds: [PARADE_MOVE.id, FIZZ_AWAY.id, BANNERS.id, BRIDGE.id],
    },
  ];
  const out: ConvergenceCase[] = [];
  for (const group of groups) {
    const canonicalId = `${group.id}-canonical`;
    const canonical = pack(group.rows);
    out.push(
      makeCase({
        id: canonicalId,
        family: "order_invariance",
        baseScenario: group.id,
        perturbation: "canonical order",
        expectedInvariant: "Canonical order is the comparison anchor",
        world: group.world,
        projectId: group.projectId,
        focusIds: group.focusIds,
        ...canonical,
      }),
    );
    const perms = permuteOrSample(group.rows, seedFrom(group.id), 8);
    perms.forEach((perm, index) => {
      const same =
        perm.length === group.rows.length &&
        perm.every((row, i) => row === group.rows[i]);
      if (same) return;
      out.push(
        makeCase({
          id: `${group.id}-p${String(index).padStart(2, "0")}`,
          family: "order_invariance",
          seed: seedFrom(`${group.id}:${index}`),
          baseScenario: group.id,
          perturbation: `reorder permutation ${index}`,
          expectedInvariant:
            "Reordering independent observations must not change focus semantics",
          world: group.world,
          projectId: group.projectId,
          focusIds: group.focusIds,
          compareToId: canonicalId,
          ...pack(perm),
        }),
      );
    });
  }
  return out;
}

const INVARIANCE_PERTURBS: PerturbationKind[] = [
  "prepend-irrelevant",
  "append-irrelevant",
  "insert-irrelevant",
  "unrelated-people",
  "unrelated-dates",
];

function metamorphicFamily(
  family: ConvergenceCase["family"],
  kinds: PerturbationKind[],
  seeds: number[],
  bases = SOLO_BASES,
): ConvergenceCase[] {
  const out: ConvergenceCase[] = [];
  for (const base of bases) {
    for (const kind of kinds) {
      for (const salt of seeds) {
        const seed = seedFrom(`${base.key}:${kind}:${salt}`);
        const rows = applyPerturbation(kind, base.rows, seed);
        out.push(
          makeCase({
            id: `meta-${family}-${base.key}-${kind}-s${salt}`,
            family,
            seed,
            baseScenario: base.key,
            perturbation: `${kind} seed=${salt}`,
            expectedInvariant: `Focus observations of ${base.key} stay semantically identical under ${kind}`,
            world: base.world,
            projectId: base.projectId,
            focusIds: base.focusIds,
            compareToId: soloId(base.key),
            ...pack(rows),
          }),
        );
      }
    }
  }
  return out;
}

function identityMatrix(): ConvergenceCase[] {
  const out: ConvergenceCase[] = [];
  out.push(
    makeCase({
      id: "id-olga-full-correct-uuid",
      family: "identity_matrix",
      baseScenario: "olga-full-uuid",
      perturbation: "full name + correct UUID",
      expectedInvariant: "Olga Petrov with person-olga binds; UUID is not sufficient alone but full name is",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-uuid"],
      ...pack([
        {
          id: "obs-olga-uuid",
          statement: "Olga Petrov will own Legacy documentation.",
          evidence: "Olga Petrov will own Legacy documentation.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          projectId: AURORA_ID,
          candidateTargetId: OLGA_ID,
          candidateTargetTitle: "Olga Petrov",
          proposedValues: { personName: "Olga Petrov", scope: "Legacy documentation" },
        },
      ]),
      expect: { decisionById: { "obs-olga-uuid": "write" } },
    }),
    makeCase({
      id: "id-andris-correct-olga-uuid",
      family: "identity_matrix",
      baseScenario: "andris-forged-olga-uuid",
      perturbation: "incomplete name Andris + Olga UUID",
      expectedInvariant: "UUID is not identity proof; Needs You; do not write Olga",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-andris-uuid"],
      ...pack([
        {
          id: "obs-andris-uuid",
          statement: "Andris will take ownership of Legacy.",
          evidence: "Andris will take ownership of Legacy.",
          domain: "responsibility",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: AURORA_ID,
          candidateTargetId: OLGA_ID,
          candidateTargetTitle: "Olga Petrov",
          proposedValues: { personName: "Andris", scope: "Legacy" },
        },
      ]),
      expect: { decisionById: { "obs-andris-uuid": "needs_you" } },
    }),
    makeCase({
      id: "id-olga-wrong-uuid",
      family: "identity_matrix",
      baseScenario: "olga-wrong-uuid",
      perturbation: "Olga Petrov + invented UUID",
      expectedInvariant: "Invented UUID fails closed",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-bad-uuid"],
      ...pack([
        {
          id: "obs-olga-bad-uuid",
          statement: "Olga Petrov will own Legacy documentation.",
          evidence: "Olga Petrov will own Legacy documentation.",
          domain: "responsibility",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: AURORA_ID,
          candidateTargetId: "person-does-not-exist",
          candidateTargetTitle: "Olga Petrov",
          proposedValues: { personName: "Olga Petrov", scope: "Legacy documentation" },
        },
      ]),
      expect: { decisionById: { "obs-olga-bad-uuid": "rejected" } },
    }),
    makeCase({
      id: "id-first-name-olga",
      family: "identity_matrix",
      baseScenario: "olga-first-name",
      perturbation: "unique first name Olga, no UUID",
      expectedInvariant:
        "First name only is not recorded full-name identity; Needs You; do not bind Olga Petrov",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-first"],
      ...pack([
        {
          id: "obs-olga-first",
          statement: "Olga will own Legacy documentation.",
          evidence: "Olga will own Legacy documentation.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { personName: "Olga", scope: "Legacy documentation" },
        },
      ]),
      expect: { decisionById: { "obs-olga-first": "needs_you" } },
    }),
    makeCase({
      id: "id-new-full-name-andris-berzins",
      family: "identity_matrix",
      baseScenario: "new-full-name",
      perturbation: "genuinely new full name Andris Berzins",
      expectedInvariant: "New full name may create a person; must not bind Olga or Sarah",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-andris-berzins"],
      ...pack([
        {
          id: "obs-andris-berzins",
          statement: "Andris Berzins is joining as Legacy owner.",
          evidence: "Andris Berzins is joining as Legacy owner.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetTitle: "Andris Berzins",
          proposedValues: { name: "Andris Berzins", role: "Legacy owner" },
        },
      ]),
      expect: { decisionById: { "obs-andris-berzins": "write" } },
    }),
    makeCase({
      id: "id-pronoun-she-two-names",
      family: "identity_matrix",
      baseScenario: "pronoun-she",
      perturbation: "She + Olga Petrov and Sarah Kim in evidence",
      expectedInvariant: "Pronoun with two evidenced people is Needs You",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-she"],
      ...pack([SHE_UAT]),
      expect: { decisionById: { "obs-she": "needs_you" } },
    }),
    makeCase({
      id: "id-sarah-uuid-on-olga-obs",
      family: "identity_matrix",
      baseScenario: "sarah-uuid-wrong-person",
      perturbation: "Sarah Kim statement + Olga UUID",
      expectedInvariant: "Name/UUID mismatch fails closed",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-mismatch"],
      ...pack([
        {
          id: "obs-mismatch",
          statement: "Sarah Kim will own Release comms.",
          evidence: "Sarah Kim will own Release comms.",
          domain: "responsibility",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: AURORA_ID,
          candidateTargetId: OLGA_ID,
          candidateTargetTitle: "Olga Petrov",
          proposedValues: { personName: "Sarah Kim", scope: "Release comms" },
        },
      ]),
      expect: { decisionById: { "obs-mismatch": "needs_you" } },
    }),
    makeCase({
      id: "id-pippa-first-on-candy",
      family: "identity_matrix",
      baseScenario: "pippa-first-name",
      perturbation: "unique first name Pippa on Candyland",
      expectedInvariant:
        "Disposition no_change with a first-name-only statement must not write; Lume currently short-circuits no_change before the identity gate",
      world: "experimental",
      projectId: CANDYLAND_ID,
      focusIds: ["obs-pippa-first"],
      ...pack([
        {
          id: "obs-pippa-first",
          statement: "Pippa is still the UAT lead.",
          evidence: "Pippa is still the UAT lead.",
          domain: "person",
          disposition: "no_change",
          truthIntent: "current",
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa",
          proposedValues: { name: "Pippa" },
        },
      ]),
      expect: { decisionById: { "obs-pippa-first": "no_change" } },
    }),
    makeCase({
      id: "id-brick-ambiguous-first",
      family: "identity_matrix",
      baseScenario: "brick-first-name",
      perturbation: "Brick from the warehouse (may not be Brick Oakley)",
      expectedInvariant: "Do not bind Brick Oakley from a first name",
      world: "experimental",
      projectId: TOYWORLD_ID,
      focusIds: ["obs-brick"],
      ...pack([
        {
          id: "obs-brick",
          statement: "Brick from the warehouse called; he wants to help with assembly.",
          evidence: "Brick from the warehouse called; he wants to help with assembly.",
          domain: "person",
          disposition: "ambiguous",
          truthIntent: "uncertain",
          proposedValues: { name: "Brick" },
        },
      ]),
      expect: { decisionById: { "obs-brick": "needs_you" } },
    }),
    makeCase({
      id: "id-velvet-must-not-be-brick",
      family: "identity_matrix",
      baseScenario: "velvet-new",
      perturbation: "none",
      expectedInvariant: "Velvet Sprocket creates; must not retarget Brick or Buttons",
      world: "experimental",
      projectId: TOYWORLD_ID,
      focusIds: [VELVET.id],
      ...pack([VELVET]),
      expect: { decisionById: { [VELVET.id]: "write" } },
    }),
    makeCase({
      id: "id-sarah-kim-correct-uuid",
      family: "identity_matrix",
      baseScenario: "sarah-full-uuid",
      perturbation: "Sarah Kim + correct UUID",
      expectedInvariant: "Sarah Kim binds to person-sarah",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-sarah-uuid"],
      ...pack([
        {
          id: "obs-sarah-uuid",
          statement: "Sarah Kim will own Release comms.",
          evidence: "Sarah Kim will own Release comms.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          projectId: AURORA_ID,
          candidateTargetId: SARAH_ID,
          candidateTargetTitle: "Sarah Kim",
          proposedValues: { personName: "Sarah Kim", scope: "Release comms" },
        },
      ]),
      expect: { decisionById: { "obs-sarah-uuid": "write" } },
    }),
  );

  for (const salt of [1, 2]) {
    const seed = seedFrom(`first-name-olga-uat:${salt}`);
    out.push(
      makeCase({
        id: `id-meta-first-name-olga-s${salt}`,
        family: "identity_matrix",
        seed,
        baseScenario: "olga-uat",
        perturbation: `first-name perturbation seed=${salt}`,
        expectedInvariant:
          "Replacing Olga Petrov with Olga must not silently keep a full-name bind",
        world: "aurora",
        projectId: AURORA_ID,
        focusIds: ["obs-olga-uat"],
        ...pack(applyPerturbation("first-name", [OLGA_UAT], seed)),
        expect: { decisionById: { "obs-olga-uat": "needs_you" } },
      }),
    );
  }
  return out;
}

function compositionCases(): ConvergenceCase[] {
  const busyAurora: EnvelopeRow[] = [
    DATE_MOVE,
    CAB_CANCEL,
    ANDRIS,
    SHE_UAT,
    RUNBOOK_V3,
    OLGA_PERSON,
    AURORA_TODO,
    AURORA_COMMENTARY,
  ];
  const busyCandy: EnvelopeRow[] = [
    PARADE_MOVE,
    FIZZ_AWAY,
    PIPPA,
    BANNERS,
    SHARE_REPLACE,
    BRIDGE,
    AURORA_COMMENTARY,
  ];
  const out: ConvergenceCase[] = [];
  const auroraCanon = "comp-aurora-busy-canonical";
  out.push(
    makeCase({
      id: auroraCanon,
      family: "composition",
      baseScenario: "aurora-busy-meeting",
      perturbation: "canonical 8-observation envelope",
      expectedInvariant:
        "Unsupported CAB stays Needs You; date write, runbook write, Andris Needs You, pronoun Needs You stay local",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-date", "obs-cab", "obs-andris", "obs-she", "obs-runbook", "obs-aurora-todo"],
      ...pack(busyAurora),
      expect: {
        decisionById: {
          "obs-date": "write",
          "obs-cab": "needs_you",
          "obs-andris": "needs_you",
          "obs-she": "needs_you",
          "obs-runbook": "write",
          "obs-aurora-todo": "write",
        },
        writeTypeById: {
          "obs-date": "update_milestone",
          "obs-runbook": "write_knowledge",
        },
      },
    }),
  );
  permuteOrSample(busyAurora, seedFrom("comp-aurora"), 8).forEach((perm, index) => {
    if (perm.every((row, i) => row === busyAurora[i])) return;
    out.push(
      makeCase({
        id: `comp-aurora-busy-p${String(index).padStart(2, "0")}`,
        family: "composition",
        seed: seedFrom(`comp-aurora:${index}`),
        baseScenario: "aurora-busy-meeting",
        perturbation: `reorder busy meeting permutation ${index}`,
        expectedInvariant: "Busy-meeting focus semantics are order-invariant",
        world: "aurora",
        projectId: AURORA_ID,
        focusIds: ["obs-date", "obs-cab", "obs-andris", "obs-she", "obs-runbook"],
        compareToId: auroraCanon,
        ...pack(perm),
      }),
    );
  });
  for (const kind of ["prepend-irrelevant", "append-irrelevant", "malformed-beside", "ambiguous-beside"] as PerturbationKind[]) {
    const seed = seedFrom(`comp-aurora:${kind}`);
    out.push(
      makeCase({
        id: `comp-aurora-busy-${kind}`,
        family: "composition",
        seed,
        baseScenario: "aurora-busy-meeting",
        perturbation: kind,
        expectedInvariant: "Noise beside a busy meeting must not retarget focus observations",
        world: "aurora",
        projectId: AURORA_ID,
        focusIds: ["obs-date", "obs-cab", "obs-andris", "obs-she", "obs-runbook"],
        compareToId: auroraCanon,
        ...pack(applyPerturbation(kind, busyAurora, seed)),
      }),
    );
  }

  const candyCanon = "comp-candy-busy-canonical";
  out.push(
    makeCase({
      id: candyCanon,
      family: "composition",
      baseScenario: "candy-busy-meeting",
      perturbation: "canonical mixed Candyland envelope",
      expectedInvariant: "Share/replace stays Needs You; parade/fizz/banners/bridge stay local",
      world: "experimental",
      projectId: CANDYLAND_ID,
      focusIds: [PARADE_MOVE.id, FIZZ_AWAY.id, BANNERS.id, BRIDGE.id, SHARE_REPLACE.id, PIPPA.id],
      ...pack(busyCandy),
      expect: {
        decisionById: {
          [PARADE_MOVE.id]: "write",
          [FIZZ_AWAY.id]: "write",
          [BANNERS.id]: "write",
          [BRIDGE.id]: "write",
          [SHARE_REPLACE.id]: "needs_you",
          [PIPPA.id]: "no_change",
        },
      },
    }),
  );
  permuteOrSample(busyCandy, seedFrom("comp-candy"), 6).forEach((perm, index) => {
    if (perm.every((row, i) => row === busyCandy[i])) return;
    out.push(
      makeCase({
        id: `comp-candy-busy-p${String(index).padStart(2, "0")}`,
        family: "composition",
        seed: seedFrom(`comp-candy:${index}`),
        baseScenario: "candy-busy-meeting",
        perturbation: `reorder candy permutation ${index}`,
        expectedInvariant: "Candyland mixed load is order-invariant for focus ids",
        world: "experimental",
        projectId: CANDYLAND_ID,
        focusIds: [PARADE_MOVE.id, SHARE_REPLACE.id, PIPPA.id],
        compareToId: candyCanon,
        ...pack(perm),
      }),
    );
  });
  return out;
}

function duplicationCases(): ConvergenceCase[] {
  const out: ConvergenceCase[] = [];
  for (const base of SOLO_BASES.filter((b) =>
    ["date-move", "andris", "olga-uat", "parade", "banners", "packaging"].includes(b.key),
  )) {
    for (const salt of [1, 2, 3]) {
      const seed = seedFrom(`dup:${base.key}:${salt}`);
      out.push(
        makeCase({
          id: `dup-${base.key}-s${salt}`,
          family: "duplication",
          seed,
          baseScenario: base.key,
          perturbation: `duplicate observation seed=${salt}`,
          expectedInvariant:
            "Duplicating evidence must not change the original observation's disposition/target",
          world: base.world,
          projectId: base.projectId,
          focusIds: base.focusIds,
          compareToId: soloId(base.key),
          ...pack(applyPerturbation("duplicate", base.rows, seed)),
        }),
      );
    }
  }
  out.push(
    makeCase({
      id: "dup-frozen-packaging-merge",
      family: "duplication",
      baseScenario: "duplicate-observation",
      perturbation: "frozen merge envelope",
      expectedInvariant: "Merged duplicate does not produce two packaging writes",
      world: "experimental",
      projectId: TOYWORLD_ID,
      focusIds: ["obs-a", "obs-b"],
      transcript: transcriptFromRows(observationsOf(FROZEN_MODEL_OUTPUTS.find((f) => f.caseId === "duplicate-observation")!.rawModelJson)),
      rawModelJson: FROZEN_MODEL_OUTPUTS.find((f) => f.caseId === "duplicate-observation")!.rawModelJson,
      expect: {
        decisionById: { "obs-a": "write", "obs-b": "no_change" },
      },
    }),
  );
  return out;
}

function contradictionCases(): ConvergenceCase[] {
  return [
    makeCase({
      id: "contra-parade-two-dates",
      family: "contradiction",
      baseScenario: "parade-contradiction",
      perturbation: "same milestone, two dates",
      expectedInvariant:
        "Contradictory dates on Parade day must not silently pick one write; Needs You or local conflict",
      world: "experimental",
      projectId: CANDYLAND_ID,
      focusIds: ["obs-parade-a", "obs-parade-b"],
      ...pack([
        {
          ...PARADE_MOVE,
          id: "obs-parade-a",
          statement: "Parade day moved to 29 October 2026",
          evidence: "Parade day is now 29 October 2026.",
          proposedValues: { date: "2026-10-29" },
        },
        {
          ...PARADE_MOVE,
          id: "obs-parade-b",
          statement: "Parade day remains 15 October 2026",
          evidence: "Parade day remains 15 October 2026.",
          proposedValues: { date: "2026-10-15" },
        },
      ]),
      expect: { needsYouLocal: true },
    }),
    makeCase({
      id: "contra-release-two-dates",
      family: "contradiction",
      baseScenario: "release-contradiction",
      perturbation: "19 Sep vs still 12 Sep",
      expectedInvariant: "Contradictory release dates do not silently apply both",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-date", "obs-date-stay"],
      ...pack([
        DATE_MOVE,
        {
          ...DATE_MOVE,
          id: "obs-date-stay",
          statement: "Production release is still 12 September.",
          evidence: "Production release is still 12 September.",
          proposedValues: { label: "Production release", date: "2026-09-12" },
        },
      ]),
      expect: { needsYouLocal: true },
    }),
    makeCase({
      id: "contra-olga-sarah-same-scope",
      family: "contradiction",
      baseScenario: "uat-two-owners",
      perturbation: "Olga owns UAT replace + Sarah owns UAT replace",
      expectedInvariant: "Replace/replace on the same scope is local; do not drop either silently",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-uat", "obs-sarah-uat"],
      ...pack([
        OLGA_UAT,
        {
          ...SARAH_RELEASE,
          id: "obs-sarah-uat",
          statement: "Sarah Kim is responsible for UAT.",
          evidence: "Sarah Kim is responsible for UAT.",
          proposedValues: {
            personName: "Sarah Kim",
            scope: "UAT",
            ownershipSemantics: "replace",
          },
        },
      ]),
    }),
    makeCase({
      id: "contra-risk-open-and-closed",
      family: "contradiction",
      baseScenario: "bridge-open-closed",
      perturbation: "same risk open and resolved",
      expectedInvariant: "Opposite risk statuses stay local / Needs You; no silent last-write-wins Apply Ready pair",
      world: "experimental",
      projectId: CANDYLAND_ID,
      focusIds: ["obs-bridge-open", "obs-bridge-closed"],
      ...pack([
        {
          ...BRIDGE,
          id: "obs-bridge-open",
          statement: "Gumdrop Bridge icing is still open",
          evidence: "Gumdrop Bridge icing is still open.",
          proposedValues: { status: "open" },
        },
        {
          ...BRIDGE,
          id: "obs-bridge-closed",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "The icing on Gumdrop Bridge has melted; that risk is closed.",
          proposedValues: { status: "resolved" },
        },
      ]),
      expect: { needsYouLocal: true },
    }),
  ];
}

function productGapCases(): ConvergenceCase[] {
  return [
    makeCase({
      id: "gap-cab-cancel-remove",
      family: "product_model_gap",
      baseScenario: "cab-cancelled",
      perturbation: "none",
      expectedInvariant:
        "PRODUCT MODEL: a cancelled dated item should be a cancel/remove write, not Needs You-as-complete",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-cab"],
      ...pack([CAB_CANCEL]),
      expect: {
        productModelGap: true,
        decisionById: { "obs-cab": "write" },
        writeTypeById: { "obs-cab": "cancel_milestone" },
      },
    }),
    makeCase({
      id: "gap-runbook-v3-retire-v2",
      family: "product_model_gap",
      baseScenario: "runbook-v3",
      perturbation: "none",
      expectedInvariant:
        "PRODUCT MODEL: superseding runbook v3 should retire v2, not only create another knowledge fact",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-runbook"],
      ...pack([RUNBOOK_V3]),
      expect: {
        productModelGap: true,
        decisionById: { "obs-runbook": "write" },
        writeTypeById: { "obs-runbook": "replace_knowledge" },
      },
    }),
    makeCase({
      id: "gap-cab-as-knowledge",
      family: "product_model_gap",
      baseScenario: "cab-as-knowledge",
      perturbation: "cancelled date extracted as knowledge",
      expectedInvariant:
        "PRODUCT MODEL: cancelling a date must not become a note that leaves the date standing",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-cab-know"],
      ...pack([
        {
          id: "obs-cab-know",
          statement: "The CAB preparation session is cancelled and is no longer required.",
          evidence: "The CAB preparation session is cancelled and is no longer required.",
          domain: "knowledge",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            text: "The CAB preparation session is cancelled and is no longer required.",
          },
        },
      ]),
      expect: {
        productModelGap: true,
        decisionById: { "obs-cab-know": "write" },
        writeTypeById: { "obs-cab-know": "cancel_milestone" },
      },
    }),
  ];
}

function preservationExtras(): ConvergenceCase[] {
  return [
    makeCase({
      id: "pres-olga-scope-in-values",
      family: "information_preservation",
      baseScenario: "olga-uat-scoped",
      perturbation: "none",
      expectedInvariant: "Name Olga Petrov and scope UAT survive parse → plan",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-uat"],
      ...pack([OLGA_UAT]),
      expect: {
        preserve: [{ id: "obs-olga-uat", fields: ["name", "scope", "statement", "evidence"] }],
      },
    }),
    makeCase({
      id: "pres-olga-scope-only-in-statement",
      family: "information_preservation",
      baseScenario: "olga-uat-statement-scope",
      perturbation: "model omitted proposedValues.scope",
      expectedInvariant:
        "Scope UAT in the statement must not silently disappear; preserve or reject-with-reason",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-olga-stmt"],
      ...pack([
        {
          id: "obs-olga-stmt",
          statement: "Olga Petrov is responsible for UAT.",
          evidence: "Olga Petrov is responsible for UAT.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { personName: "Olga Petrov" },
        },
      ]),
      expect: {
        preserve: [{ id: "obs-olga-stmt", fields: ["name", "statement"] }],
      },
    }),
    makeCase({
      id: "pres-date-19-sep",
      family: "information_preservation",
      baseScenario: "date-move",
      perturbation: "none",
      expectedInvariant: "19 September proposed date survives to planner",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-date"],
      ...pack([DATE_MOVE]),
      expect: {
        preserve: [{ id: "obs-date", fields: ["date", "statement"] }],
        decisionById: { "obs-date": "write" },
      },
    }),
    makeCase({
      id: "pres-sarah-release",
      family: "information_preservation",
      baseScenario: "sarah-release",
      perturbation: "none",
      expectedInvariant: "Sarah Kim + Release survive",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-sarah-rel"],
      ...pack([SARAH_RELEASE]),
      expect: {
        preserve: [{ id: "obs-sarah-rel", fields: ["name", "scope", "statement"] }],
      },
    }),
    makeCase({
      id: "pres-np-adapter-foreign-id",
      family: "information_preservation",
      surface: "new_project",
      baseScenario: "np-informal-people-foreign-id",
      perturbation: "unscoped New Project; model invented candidateTargetId",
      expectedInvariant:
        "Name-only Bob/Mike must survive the New Project adapter even when the extractor invents target ids",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-bob", "obs-mike"],
      ...pack([
        {
          id: "obs-bob",
          statement: "bob is the ba",
          evidence: "bob is the ba",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetId: "person-bob",
          proposedValues: { name: "bob" },
        },
        {
          id: "obs-mike",
          statement: "mike handles the legacy builds",
          evidence: "mike handles the legacy builds",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetId: "person-mike",
          proposedValues: { personName: "mike" },
        },
      ]),
      expect: {
        np: { names: ["bob", "mike"] },
      },
    }),
    makeCase({
      id: "pres-np-adapter-missing-truth-intent",
      family: "information_preservation",
      surface: "new_project",
      baseScenario: "np-informal-people-missing-truth-intent",
      perturbation: "extractor omitted truthIntent",
      expectedInvariant:
        "Named people in a structurally valid observations array must not vanish from New Project Organise",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-bob", "obs-mike"],
      rawModelJson: {
        observations: [
          {
            id: "obs-bob",
            statement: "bob is the ba",
            evidence: "bob is the ba",
            domain: "person",
            disposition: "create_new",
            proposedValues: { name: "bob" },
          },
          {
            id: "obs-mike",
            statement: "mike handles the legacy builds",
            evidence: "mike handles the legacy builds",
            domain: "person",
            disposition: "create_new",
            proposedValues: { name: "mike" },
          },
        ],
      },
      transcript: "bob is the ba\n\nmike handles the legacy builds",
      expect: {
        np: { names: ["bob", "mike"] },
      },
    }),
    makeCase({
      id: "pres-np-adapter-unknown-disposition",
      family: "information_preservation",
      surface: "new_project",
      baseScenario: "np-informal-people-unknown-disposition",
      perturbation: "extractor used disposition create instead of create_new",
      expectedInvariant:
        "Named people must not vanish from New Project Organise because of a near-miss disposition enum",
      world: "aurora",
      projectId: AURORA_ID,
      focusIds: ["obs-bob", "obs-mike"],
      rawModelJson: {
        observations: [
          {
            id: "obs-bob",
            statement: "bob is the ba",
            evidence: "bob is the ba",
            domain: "person",
            disposition: "create",
            truthIntent: "current",
            proposedValues: { name: "bob" },
          },
          {
            id: "obs-mike",
            statement: "mike handles the legacy builds",
            evidence: "mike handles the legacy builds",
            domain: "person",
            disposition: "create",
            truthIntent: "current",
            proposedValues: { name: "mike" },
          },
        ],
      },
      transcript: "bob is the ba\n\nmike handles the legacy builds",
      expect: {
        np: { names: ["bob", "mike"] },
      },
    }),
  ];
}

export function buildGeneratedCases(): ConvergenceCase[] {
  const cases = [
    ...historicalCases(),
    ...soloCases(),
    ...preservationExtras(),
    ...pairCases(),
    ...orderCases(),
    ...metamorphicFamily("irrelevant_context", INVARIANCE_PERTURBS, [1, 2, 3]),
    ...metamorphicFamily("ambiguity_isolation", ["ambiguous-beside"], [1, 2, 3, 4]),
    ...metamorphicFamily("malformed_isolation", ["malformed-beside"], [1, 2, 3, 4, 5]),
    ...identityMatrix(),
    ...compositionCases(),
    ...duplicationCases(),
    ...contradictionCases(),
    ...productGapCases(),
  ];
  const seen = new Set<string>();
  for (const row of cases) {
    if (seen.has(row.id)) throw new Error(`Duplicate convergence case id ${row.id}`);
    seen.add(row.id);
  }
  return cases;
}
