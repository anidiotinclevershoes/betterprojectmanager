/**
 * Harbourline h1 must create Quinn Adler without weakening D-051.
 *
 * The frozen envelope may paraphrase in `statement`. Identity evidence must
 * be a verbatim Capture quote. Paraphrased evidence fails closed.
 *
 * Run: npx tsx scripts/verify-harbourline-h1-identity.ts
 */
import assert from "node:assert/strict";
import { runStackedStep, snapshotProject } from "../src/lib/eval-capture-v2/stacked-runtime";
import {
  HARBOURLINE_ID,
  seedMatureHarbourline,
} from "../src/lib/eval-capture-v2/stress/harbourline";
import { HANDOVER_STEPS } from "../src/lib/eval-capture-v2/stress/handover";
import { MARATHON_MIDWAY_PERSON, MARATHON_STEPS } from "../src/lib/eval-capture-v2/stress/marathon";

function evidenceQuotedInTranscript(transcript: string, evidence: string): boolean {
  const source = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  const quote = evidence.replace(/\s+/g, " ").trim().toLowerCase();
  if (!source || !quote) return false;
  if (source.includes(quote)) return true;
  const loosened = quote.replace(/[.,;:!?]+$/g, "").trim();
  return Boolean(loosened && source.includes(loosened));
}

function h1() {
  const step = HANDOVER_STEPS.find((s) => s.id === "h1");
  assert.ok(step, "handover h1 exists");
  return step;
}

async function main() {
  const step = h1();
  const raw = step.rawModelJson as { observations?: Array<{ evidence?: string; statement?: string }> };
  const observation = raw.observations?.[0];
  assert.ok(observation, "h1 has one observation");
  const evidence = typeof observation.evidence === "string" ? observation.evidence.trim() : "";
  assert.ok(
    evidenceQuotedInTranscript(step.transcript, evidence),
    "h1 evidence must be a verbatim Capture quote (D-051). Do not weaken identity safety to make CI green.",
  );

  const seed = seedMatureHarbourline();
  const before = snapshotProject(seed, HARBOURLINE_ID);
  assert.equal(before.peopleNames.includes("Quinn Adler"), false);

  const result = await runStackedStep({
    step,
    projectId: HARBOURLINE_ID,
    state: structuredClone(seed),
    applyReadyWrites: true,
  });
  const after = snapshotProject(result.state, HARBOURLINE_ID);
  assert.equal(result.needsYouCount, 0, `h1 must not Needs You: ${result.needsYouCount}`);
  assert.ok(result.writeCount >= 1, "h1 must produce a Ready write");
  assert.equal(
    after.peopleNames.filter((n) => n === "Quinn Adler").length,
    1,
    `Quinn Adler after h1: ${after.peopleNames.join(", ")}`,
  );

  const marathonQuinn = MARATHON_STEPS.find((s) => s.id === "m21");
  assert.ok(marathonQuinn, "marathon m21 Quinn create exists");
  const mRaw = marathonQuinn.rawModelJson as { observations?: Array<{ evidence?: string; statement?: string }> };
  const mEvidence =
    (typeof mRaw.observations?.[0]?.evidence === "string" && mRaw.observations[0].evidence.trim()) ||
    (typeof mRaw.observations?.[0]?.statement === "string" ? mRaw.observations[0].statement.trim() : "");
  assert.ok(
    evidenceQuotedInTranscript(marathonQuinn.transcript, mEvidence),
    "marathon Quinn evidence must remain a transcript quote so the midway create stays legal",
  );
  assert.equal(MARATHON_MIDWAY_PERSON, "Quinn Adler");

  console.log("ok  harbourline h1 quoted evidence creates Quinn Adler");
  console.log("ok  marathon m21 Quinn evidence remains a Capture quote");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
