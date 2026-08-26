/**
 * Phase 0 — current Capture + New Project behavioural baseline.
 * Records what post-3B Capture does on experimental worlds (local pipeline).
 *
 * Run: npx tsx scripts/verify-phase0-capture-baseline.ts
 */
import assert from "node:assert/strict";
import { planCaptureApply } from "../src/lib/capture/apply";
import {
  extractLocalFindings,
  type IndexedContextRecord,
} from "../src/lib/capture/findings";
import { assembleFromNarrative } from "../src/lib/create-project";
import {
  BASELINE_CAPTURE_PASTES,
  CANDYLAND_ID,
  GAMING_ID,
  NEW_PROJECT_MESSY_INPUT,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

function indexFromWorld() {
  const world = experimentalApplyWorld();
  const index = new Map<string, IndexedContextRecord>();
  for (const project of world.projects) {
    for (const person of project.stakeholders) {
      index.set(person.id, {
        id: person.id,
        entityType: "stakeholder",
        title: person.name,
        rawType: "stakeholder",
      });
    }
  }
  for (const risk of world.risks) {
    index.set(risk.id, {
      id: risk.id,
      entityType: "risk",
      title: risk.title,
      status: risk.status,
      rawType: "risk",
    });
  }
  for (const todo of world.todos) {
    index.set(todo.id, {
      id: todo.id,
      entityType: "todo",
      title: todo.title,
      status: todo.done ? "done" : "open",
      rawType: "todo",
    });
  }
  for (const item of world.timeline) {
    index.set(item.id, {
      id: item.id,
      entityType: "milestone",
      title: item.label,
      date: item.startAt,
      rawType: "milestone",
    });
  }
  return { world, index };
}

function main() {
  const { world, index } = indexFromWorld();
  console.log("Phase 0 baseline — local Capture pipeline (no OpenAI)\n");

  for (const caseRow of BASELINE_CAPTURE_PASTES) {
    const findings = extractLocalFindings(caseRow.paste, index);
    const domains = findings.map((f) => f.target?.entityType ?? f.findingType);
    console.log(`• ${caseRow.id}`);
    console.log(`  paste: ${caseRow.paste}`);
    console.log(`  intent: ${caseRow.intent}`);
    console.log(
      `  local findings: ${findings.length ? findings.map((f) => `${f.findingType}:${f.fact}`).join(" | ") : "(none)"}`,
    );
    console.log(`  domains: ${domains.join(", ") || "—"}`);
  }

  const isolationFindings = extractLocalFindings(
    "Gumdrop Bridge icing is resolved.",
    index,
  );
  assert.ok(
    isolationFindings.every(
      (f) => !f.target?.entityId || f.target.entityId === "risk-bridge",
    ),
  );
  assert.doesNotMatch(
    isolationFindings.map((f) => f.fact).join(" "),
    /Track freeze|Console certification/i,
  );

  const newProject = assembleFromNarrative(NEW_PROJECT_MESSY_INPUT, "delivery", "talk");
  console.log("\nNew Project local assembleFromNarrative:");
  console.log(`  name=${newProject.name} code=${newProject.code}`);
  console.log(
    `  people=${(newProject.stakeholders ?? []).map((s) => s.name).join(", ") || "—"}`,
  );
  console.log(`  risks=${(newProject.risks ?? []).map((r) => r.title).join(", ") || "—"}`);
  console.log(`  todos=${(newProject.todos ?? []).map((t) => t.title).join(", ") || "—"}`);
  console.log(
    `  dates=${(newProject.importantDates ?? []).map((d) => d.label).join(", ") || "—"}`,
  );

  assert.equal(world.projectIds.has(CANDYLAND_ID), true);
  assert.equal(world.projectIds.has(TOYWORLD_ID), true);
  assert.equal(world.projectIds.has(GAMING_ID), true);

  console.log("\nverify-phase0-capture-baseline: OK");
}

main();
