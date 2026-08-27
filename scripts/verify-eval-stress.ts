/**
 * Deterministic Deep Stress evidence (no live AI).
 *
 * Three frozen Harbourline journeys against current production:
 *   1. Deep Project Creation (real New Project V2 path)
 *   2. Capture Marathon (50 sequential Capture V2 events)
 *   3. Mid-project PM handover
 *
 * Observes. Does not retune production.
 *
 * Run: npx tsx scripts/verify-eval-stress.ts
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "../src/lib/experiments/worlds";
import {
  runStackedStep,
  snapshotProject,
  type ProjectTruthSnapshot,
  type StackedStepResult,
} from "../src/lib/eval-capture-v2/stacked-runtime";
import type { MissionState } from "../src/lib/types";
import {
  DEEP_CREATION_EXPECTED,
  DEEP_CREATION_ID,
  neighbourUnchanged,
  runDeepCreation,
} from "../src/lib/eval-capture-v2/stress/deep-creation";
import {
  HARBOURLINE_ID,
  HARBOURLINE_NAME,
  neighbourNames,
  seedEarlyHarbourline,
  seedMatureHarbourline,
  snapshotHarbourline,
} from "../src/lib/eval-capture-v2/stress/harbourline";
import {
  MARATHON_CHECKPOINT_AFTER,
  MARATHON_FOREIGN_STEP_ID,
  MARATHON_ID,
  MARATHON_MIDWAY_PERSON,
  MARATHON_STEPS,
} from "../src/lib/eval-capture-v2/stress/marathon";
import { HANDOVER_ID, HANDOVER_STEPS } from "../src/lib/eval-capture-v2/stress/handover";
import {
  classifyStressStep,
  tallyClasses,
  type ClassifiedStep,
  type StressClass,
} from "../src/lib/eval-capture-v2/stress/classify";
import type { StressStep } from "../src/lib/eval-capture-v2/stress/util";

type Finding = {
  id: string;
  classification: StressClass;
  detail: string;
};

function reloadClone(state: MissionState): MissionState {
  return JSON.parse(JSON.stringify(state)) as MissionState;
}

function namesOf(list: Array<{ name: string }>): string[] {
  return list.map((row) => row.name).sort();
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function isolationIntact(state: MissionState, seed: MissionState): string[] {
  const problems: string[] = [];
  const ids = [CANDYLAND_ID, TOYWORLD_ID, GAMING_ID] as const;
  for (const id of ids) {
    const before = snapshotProject(seed, id);
    const after = snapshotProject(state, id);
    if (JSON.stringify(namesOf(before.people)) !== JSON.stringify(namesOf(after.people))) {
      problems.push(`${id} people changed`);
    }
    if (
      JSON.stringify(before.risks.map((r) => `${r.id}:${r.status}`)) !==
      JSON.stringify(after.risks.map((r) => `${r.id}:${r.status}`))
    ) {
      problems.push(`${id} risks changed`);
    }
    if (
      JSON.stringify(before.todos.map((t) => `${t.id}:${t.done}`)) !==
      JSON.stringify(after.todos.map((t) => `${t.id}:${t.done}`))
    ) {
      problems.push(`${id} todos changed`);
    }
  }
  const harbour = state.projects.find((p) => p.id === HARBOURLINE_ID);
  const foreign = (harbour?.stakeholders ?? []).filter((s) =>
    /pippa gumdrop|fizz caramel|velvet sprocket|pixel ramos/i.test(s.name),
  );
  if (foreign.length) {
    problems.push(`Harbourline gained foreign people: ${foreign.map((s) => s.name).join(", ")}`);
  }
  return problems;
}

function duplicatePeople(snap: ProjectTruthSnapshot): string[] {
  const counts = countBy(snap.people, (p) => p.name.toLowerCase());
  return Object.entries(counts)
    .filter(([, n]) => n > 1)
    .map(([name, n]) => `${name}×${n}`);
}

function seedPeopleStillPresent(seed: MissionState, state: MissionState): string[] {
  const before = snapshotProject(seed, HARBOURLINE_ID);
  const after = snapshotProject(state, HARBOURLINE_ID);
  const afterIds = new Set(after.people.map((p) => p.id));
  return before.people
    .filter((p) => !afterIds.has(p.id))
    .map((p) => `lost person ${p.name} (${p.id})`);
}

async function runJourney(args: {
  id: string;
  seed: MissionState;
  steps: StressStep[];
  checkpoints: readonly string[];
}) {
  let state = reloadClone(args.seed);
  const classified: ClassifiedStep[] = [];
  const findings: Finding[] = [];
  const checkpointLog: Array<{
    after: string;
    reloadOk: boolean;
    snapshot: ReturnType<typeof snapshotHarbourline>;
  }> = [];
  const results: StackedStepResult[] = [];

  for (const step of args.steps) {
    let result: StackedStepResult;
    try {
      result = await runStackedStep({
        step,
        projectId: HARBOURLINE_ID,
        state,
        applyReadyWrites: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/Stacked bind failed/i.test(message) || !step.bindTarget) throw err;
      findings.push({
        id: step.id,
        classification: "silent_failure",
        detail: `${message} — an earlier write likely renamed the target object.`,
      });
      result = await runStackedStep({
        step: { ...step, bindTarget: undefined },
        projectId: HARBOURLINE_ID,
        state,
        applyReadyWrites: true,
      });
    }
    state = result.state;
    results.push(result);

    const extra: { classification?: StressClass; note?: string } = {};
    if (step.id === MARATHON_FOREIGN_STEP_ID) {
      const pippa = snapshotProject(state, HARBOURLINE_ID).people.filter((p) =>
        /pippa gumdrop/i.test(p.name),
      );
      if (pippa.length) {
        extra.classification = "genuine_lume_failure";
        extra.note = "Foreign Candyland Person bound onto Harbourline.";
      } else if (result.pipeline.validation.rejected.length > 0 || result.writeCount === 0) {
        extra.classification = "lume_catch";
        extra.note = "Foreign person-gumdrop bind failed closed.";
      }
    }
    if (step.id === "m37") {
      const shader = snapshotProject(state, HARBOURLINE_ID).risks.filter((r) =>
        /shader/i.test(r.title),
      );
      if (shader.length) {
        extra.classification = "genuine_lume_failure";
        extra.note = "Retracted shader assertion became a durable Harbourline risk.";
      }
    }
    if (step.id === "h6" || step.id === "h15" || step.id === "m47") {
      const spec = snapshotProject(state, HARBOURLINE_ID).dates.find((d) =>
        /specification freeze/i.test(d.label),
      );
      const start = spec?.startAt ?? "";
      if (step.id === "m47" && start.startsWith("2026-10-02")) {
        extra.classification = "genuine_lume_failure";
        extra.note = "Stale 2 October spec freeze overwrote the later 9 October date.";
      }
      if ((step.id === "h6" || step.id === "h15") && !start.startsWith("2026-10-09")) {
        extra.classification = "genuine_lume_failure";
        extra.note = `Handover stale date mutated spec freeze to ${start || "(missing)"}.`;
      }
    }

    const row = classifyStressStep({ step, result, extra });
    classified.push(row);
    if (
      row.classification === "genuine_lume_failure" ||
      row.classification === "silent_failure"
    ) {
      findings.push({ id: step.id, classification: row.classification, detail: row.note });
    }

    if (args.checkpoints.includes(step.id)) {
      const reloaded = reloadClone(state);
      const reloadOk =
        JSON.stringify(snapshotHarbourline(state)) ===
        JSON.stringify(snapshotHarbourline(reloaded));
      if (!reloadOk) {
        findings.push({
          id: step.id,
          classification: "silent_failure",
          detail: "JSON reload snapshot diverged from in-memory state.",
        });
      }
      state = reloaded;
      checkpointLog.push({
        after: step.id,
        reloadOk,
        snapshot: snapshotHarbourline(state),
      });
    }
  }

  const isolation = isolationIntact(state, args.seed);
  for (const problem of isolation) {
    findings.push({
      id: args.id,
      classification: "silent_failure",
      detail: `Project isolation: ${problem}`,
    });
  }
  for (const lost of seedPeopleStillPresent(args.seed, state)) {
    findings.push({
      id: args.id,
      classification: "silent_failure",
      detail: lost,
    });
  }
  for (const dup of duplicatePeople(snapshotProject(state, HARBOURLINE_ID))) {
    findings.push({
      id: args.id,
      classification: "genuine_lume_failure",
      detail: `Duplicate person identity: ${dup}`,
    });
  }
  const todoDupes = Object.entries(
    countBy(snapshotProject(state, HARBOURLINE_ID).todos, (t) => t.title.toLowerCase()),
  ).filter(([, n]) => n > 1);
  for (const [title, n] of todoDupes) {
    findings.push({
      id: args.id,
      classification: "genuine_lume_failure",
      detail: `Duplicate To Do title: ${title}×${n}`,
    });
  }

  const difficultyMix = countBy(args.steps, (s) => s.difficulty);
  const reviewMix = countBy(classified, (s) => s.actualReview);

  return {
    id: args.id,
    stepCount: args.steps.length,
    difficultyMix,
    reviewMix,
    classes: tallyClasses(classified),
    classified,
    findings,
    checkpoints: checkpointLog,
    isolation,
    final: snapshotHarbourline(state),
    neighbours: neighbourNames(state),
    needsYouCount: classified.filter((c) => c.needsYouCount > 0).length,
    writeSteps: classified.filter((c) => c.writeCount > 0).length,
    results: results.map((r) => ({
      id: r.stepId,
      review: r.review,
      writeCount: r.writeCount,
      needsYouCount: r.needsYouCount,
      rejected: r.pipeline.validation.rejected.map((o) => o.id),
    })),
  };
}

function evaluateDeepCreation() {
  const run = runDeepCreation();
  const findings: Finding[] = [];
  const project = run.bundle.project;
  const peopleNames = (project.stakeholders ?? []).map((s) => s.name);
  const uniquePeople = [...new Set(peopleNames)];
  const todoTitles = run.bundle.todos.map((t) => t.title);
  const dateLabels = (run.bundle.timeline ?? []).map((t) => t.label);
  const knowledge = run.bundle.knowledge;
  const commentary = run.draft.notMentioned ?? [];
  const owenCount = peopleNames.filter((n) => n === "Owen Hart").length;
  const chatterHits = [...todoTitles, ...(knowledge.sections.now ?? []), ...(knowledge.sections.decisions ?? [])]
    .filter((t) => /cinnamon bun|grinding noise/i.test(t));
  const silverAsDecision = (knowledge.sections.decisions ?? []).some((t) =>
    /civic silver/i.test(t),
  );
  const questionAsFact = [...(knowledge.sections.now ?? []), ...(knowledge.sections.decisions ?? [])].some(
    (t) => /who owns the sso|comms embargo/i.test(t),
  );
  const inventoryAsOpenTodo = todoTitles.some((t) => /inventory/i.test(t));
  const stateRisks = (run.state.risks ?? []).filter((r) => r.projectId === project.id);
  const reloadOk = JSON.stringify(run.state) === JSON.stringify(run.reloaded);

  if (run.state.projects.filter((p) => p.name === HARBOURLINE_NAME).length !== 1) {
    findings.push({
      id: DEEP_CREATION_ID,
      classification: "genuine_lume_failure",
      detail: "Harbourline was not created exactly once.",
    });
  }
  if (owenCount > 1) {
    findings.push({
      id: "np-owen-repeat",
      classification: "architectural_limit",
      detail: `New Project mapper does not identity-merge repeated full names (Owen Hart ×${owenCount}).`,
    });
  }
  if (stateRisks.length > 0) {
    findings.push({
      id: "np-risks-domain",
      classification: "architectural_limit",
      detail: "Unexpected: New Project wrote state.risks (current path maps risks to knowledge bullets).",
    });
  } else {
    findings.push({
      id: "np-risks-domain",
      classification: "architectural_limit",
      detail:
        "New Project V2 stores risks as knowledge.sections.risks bullets, not ProjectRisk records. Documented V1 create path — not Capture V2.",
    });
  }
  if (chatterHits.length) {
    findings.push({
      id: "np-chatter",
      classification: "genuine_lume_failure",
      detail: `Harmless chatter became durable: ${chatterHits.join("; ")}`,
    });
  }
  if (silverAsDecision) {
    findings.push({
      id: "np-not-silver",
      classification: "genuine_lume_failure",
      detail: "Explicitly not-decided civic silver became a Decision.",
    });
  }
  if (questionAsFact) {
    findings.push({
      id: "np-questions",
      classification: "genuine_lume_failure",
      detail: "Open questions became knowledge facts.",
    });
  }
  if (inventoryAsOpenTodo) {
    findings.push({
      id: "np-done-inventory",
      classification: "genuine_lume_failure",
      detail: "Completed series inventory became a new open To Do.",
    });
  }
  if (!neighbourUnchanged(run.state, run.neighbours)) {
    findings.push({
      id: DEEP_CREATION_ID,
      classification: "silent_failure",
      detail: "Neighbour experimental worlds changed during create.",
    });
  }

  const peopleMissing = DEEP_CREATION_EXPECTED.people.filter(
    (name) => !uniquePeople.includes(name),
  );
  const todosMissing = DEEP_CREATION_EXPECTED.todoTitles.filter(
    (title) => !todoTitles.some((t) => t.toLowerCase() === title.toLowerCase()),
  );
  const datesMissing = DEEP_CREATION_EXPECTED.dateLabels.filter(
    (label) => !dateLabels.some((t) => t.toLowerCase() === label.toLowerCase()),
  );
  const riskBullets = knowledge.sections.risks ?? [];
  const risksMissing = DEEP_CREATION_EXPECTED.riskTitles.filter(
    (title) => !riskBullets.some((t) => t.toLowerCase().includes(title.toLowerCase())),
  );

  const availabilityPerson = peopleNames.filter((n) => /away|november/i.test(n));
  if (availabilityPerson.length) {
    findings.push({
      id: "np-avail-lila",
      classification: "architectural_limit",
      detail: `Availability mapped to the Person bucket and created stakeholder-like rows: ${availabilityPerson.join(", ")}`,
    });
  }

  const nowCount = (knowledge.sections.now ?? []).length;
  const peopleBulletCount = (knowledge.sections.people ?? []).length;
  if (peopleNames.length > peopleBulletCount) {
    findings.push({
      id: "np-unique-bullets",
      classification: "architectural_limit",
      detail: `buildNewProject uniqueBullets capped knowledge.people at ${peopleBulletCount} (stakeholders ${peopleNames.length}).`,
    });
  }

  return {
    id: DEEP_CREATION_ID,
    path: "new-project-v2 (parse → categorise → draftFromProvisional → buildNewProject)",
    notCaptureV2: true,
    observationCount: run.parsed.items.length,
    categories: countBy(run.items, (i) => i.category),
    peopleCount: peopleNames.length,
    uniquePeopleCount: uniquePeople.length,
    owenCount,
    todoCount: todoTitles.length,
    dateCount: dateLabels.length,
    riskBulletCount: riskBullets.length,
    stateRiskCount: stateRisks.length,
    commentaryCount: commentary.length,
    knowledgeNowCount: nowCount,
    knowledgePeopleBulletCount: peopleBulletCount,
    peopleMissing,
    todosMissing,
    datesMissing,
    risksMissing,
    chatterHits,
    silverAsDecision,
    questionAsFact,
    inventoryAsOpenTodo,
    neighbourOk: neighbourUnchanged(run.state, run.neighbours),
    reloadOk,
    findings,
    peopleNames,
    todoTitles,
    dateLabels,
    riskBullets,
    commentary,
    todosAllOpen: run.bundle.todos.every((t) => t.done === false),
  };
}

async function main() {
  const deep = evaluateDeepCreation();
  const marathon = await runJourney({
    id: MARATHON_ID,
    seed: seedEarlyHarbourline(),
    steps: MARATHON_STEPS,
    checkpoints: MARATHON_CHECKPOINT_AFTER,
  });
  const handover = await runJourney({
    id: HANDOVER_ID,
    seed: seedMatureHarbourline(),
    steps: HANDOVER_STEPS,
    checkpoints: ["h18"],
  });

  const midwayPresent =
    marathon.final.people.filter((n) => n === MARATHON_MIDWAY_PERSON).length === 1;
  if (!midwayPresent) {
    marathon.findings.push({
      id: "m21",
      classification: marathon.final.people.filter((n) => n === MARATHON_MIDWAY_PERSON).length
        ? "genuine_lume_failure"
        : "silent_failure",
      detail: `Quinn Adler identity after marathon: ${marathon.final.people.filter((n) => n === MARATHON_MIDWAY_PERSON).length}`,
    });
  }

  const specAfterMarathon = marathon.final.dates.find((d) =>
    /specification freeze/i.test(d.label),
  );
  if (specAfterMarathon && !specAfterMarathon.startAt?.startsWith("2026-10-09")) {
    marathon.findings.push({
      id: "m13",
      classification: "genuine_lume_failure",
      detail: `Spec freeze ended at ${specAfterMarathon.startAt}, expected 9 October after the move.`,
    });
  }

  const mouldAfterHandover = handover.final.risks.find((r) => /mould/i.test(r.title));
  if (mouldAfterHandover && mouldAfterHandover.status === "resolved") {
    handover.findings.push({
      id: "h16",
      classification: "genuine_lume_failure",
      detail: "Uncertain 'may already have been resolved' closed the mould risk.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    providerCalls: 0,
    deep,
    marathon: {
      ...marathon,
      classified: marathon.classified,
    },
    handover: {
      ...handover,
      classified: handover.classified,
    },
  };

  const outDir = join(process.cwd(), "test-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "eval-stress.json"), JSON.stringify(report, null, 2));

  const hard = [
    ...deep.findings,
    ...marathon.findings,
    ...handover.findings,
  ].filter(
    (f) =>
      f.classification === "genuine_lume_failure" ||
      f.classification === "silent_failure",
  );

  console.log("Deep stress (frozen, no providers)");
  console.log(
    `  deep-creation: ${deep.observationCount} items, people ${deep.uniquePeopleCount}/${deep.peopleCount}, todos ${deep.todoCount}, dates ${deep.dateCount}, risk bullets ${deep.riskBulletCount}, state.risks ${deep.stateRiskCount}`,
  );
  console.log(
    `  marathon: ${marathon.stepCount} events, writes ${marathon.writeSteps}, needs-you steps ${marathon.needsYouCount}, checkpoints ${marathon.checkpoints.length}`,
  );
  console.log(
    `  handover: ${handover.stepCount} events, writes ${handover.writeSteps}, needs-you steps ${handover.needsYouCount}`,
  );
  console.log(`  classes marathon: ${JSON.stringify(marathon.classes)}`);
  console.log(`  classes handover: ${JSON.stringify(handover.classes)}`);
  if (deep.findings.length) {
    console.log("  deep findings:");
    for (const f of deep.findings) console.log(`    [${f.classification}] ${f.id}: ${f.detail}`);
  }
  if (marathon.findings.length) {
    console.log("  marathon findings:");
    for (const f of marathon.findings) console.log(`    [${f.classification}] ${f.id}: ${f.detail}`);
  }
  if (handover.findings.length) {
    console.log("  handover findings:");
    for (const f of handover.findings) console.log(`    [${f.classification}] ${f.id}: ${f.detail}`);
  }

  assert.equal(deep.observationCount >= 40, true, "deep creation should be a large dump");
  assert.equal(MARATHON_STEPS.length >= 40 && MARATHON_STEPS.length <= 60, true);
  assert.equal(handover.stepCount >= 12, true);
  assert.equal(deep.neighbourOk, true, "deep creation isolation");
  assert.equal(marathon.isolation.length, 0, marathon.isolation.join("; "));
  assert.equal(handover.isolation.length, 0, handover.isolation.join("; "));
  assert.equal(deep.reloadOk, true, "deep creation reload parity");

  if (hard.length) {
    console.error(`\nHard findings (${hard.length}) — classified, production not patched:`);
    for (const f of hard) console.error(`  [${f.classification}] ${f.id}: ${f.detail}`);
    process.exit(1);
  }

  console.log("\nDeep stress coverage completed with no hard integrity failures.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
