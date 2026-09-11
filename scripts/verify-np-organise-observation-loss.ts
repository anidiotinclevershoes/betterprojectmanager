/**
 * D-052 — New Project Organise observation loss.
 *
 * Hosted reproduction (PR #155 Preview):
 *   input: "bob is the ba" / "mike handles the legacy builds"
 *   POST /api/new-project 200
 *   observationCount 2, envelopeMalformed false
 *   HTTP: empty draft + provisionalItems []
 *
 * Traces the real production path:
 *   shared extractor output fixture
 *   → parseObservationEnvelope
 *   → validateObservations
 *   → parseNewProjectV2Envelope
 *   → draftFromProvisional
 *   → POST /api/new-project response
 *
 * Does not call live OpenAI. Does not retune prompts/models.
 * Does not change the adapter (fix waits for approval).
 *
 * Run: npx tsx scripts/verify-np-organise-observation-loss.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST as postNewProject } from "../src/app/api/new-project/route";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import {
  parseObservationEnvelope,
  validateObservations,
} from "../src/lib/capture-v2/validate";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "../src/lib/new-project-v2";

const ROOT = process.cwd();
const NARRATIVE = "bob is the ba\n\nmike handles the legacy builds";

let passed = 0;
const skipped: string[] = [];

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`✓ ${name}`);
  });
}

function knownGap(name: string, reason: string) {
  skipped.push(`${name} — ${reason}`);
  console.log(`○ SKIP (known gap): ${name}`);
  console.log(`  ${reason}`);
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function observationCount(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const list = (raw as { observations?: unknown }).observations;
  return Array.isArray(list) ? list.length : 0;
}

function person(over: Record<string, unknown>) {
  return {
    statement: "placeholder",
    evidence: "placeholder",
    domain: "person",
    disposition: "create_new",
    truthIntent: "current",
    proposedValues: {},
    ...over,
  };
}

/** Schema-valid name-only people — already legal New Project truth. */
const VALID_NAME_ONLY = {
  observations: [
    person({
      id: "obs-bob",
      statement: "bob is the ba",
      evidence: "bob is the ba",
      proposedValues: { name: "bob" },
    }),
    person({
      id: "obs-mike",
      statement: "mike handles the legacy builds",
      evidence: "mike handles the legacy builds",
      proposedValues: { name: "mike" },
    }),
  ],
};

/** Weak responsibility structure, names still present. */
const WEAK_RESPONSIBILITY = {
  observations: [
    person({
      id: "obs-bob",
      statement: "bob is the ba",
      evidence: "bob is the ba",
      domain: "responsibility",
      proposedValues: { personName: "bob" },
    }),
    person({
      id: "obs-mike",
      statement: "mike handles the legacy builds",
      evidence: "mike handles the legacy builds",
      domain: "responsibility",
      proposedValues: { personName: "mike" },
    }),
  ],
};

/** Invented target ids on unscoped New Project — records are always []. */
const FOREIGN_ID = {
  observations: [
    person({
      id: "obs-bob",
      statement: "bob is the ba",
      evidence: "bob is the ba",
      candidateTargetId: "person-bob",
      proposedValues: { name: "bob" },
    }),
    person({
      id: "obs-mike",
      statement: "mike handles the legacy builds",
      evidence: "mike handles the legacy builds",
      domain: "responsibility",
      candidateTargetId: "person-mike",
      proposedValues: { personName: "mike" },
    }),
  ],
};

const MISSING_TRUTH_INTENT = {
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
};

const UNKNOWN_DISPOSITION = {
  observations: [
    person({
      id: "obs-bob",
      statement: "bob is the ba",
      evidence: "bob is the ba",
      disposition: "create",
      proposedValues: { name: "bob" },
    }),
    person({
      id: "obs-mike",
      statement: "mike handles the legacy builds",
      evidence: "mike handles the legacy builds",
      disposition: "create",
      proposedValues: { name: "mike" },
    }),
  ],
};

function trace(raw: unknown) {
  const parsedEnvelope = parseObservationEnvelope(raw);
  const envelopeMalformed = parsedEnvelope.issues.some(
    (issue) => issue.code === "malformed",
  );
  const validation = validateObservations(parsedEnvelope.observations, [], null);
  const parsed = parseNewProjectV2Envelope(raw);
  const draft = draftFromProvisional({
    sourceNarrative: NARRATIVE,
    sourceMode: "paste",
    project: parsed.project,
    items: parsed.items,
  });
  return {
    observationCount: observationCount(raw),
    envelopeMalformed,
    acceptedIds: validation.observations.map((row) => row.id),
    rejectedIds: validation.rejected.map((row) => row.id),
    rejectCodes: validation.issues.map((issue) => issue.code),
    rejectedDomains: validation.rejected.map((row) => row.domain),
    provisionalCount: parsed.items.length,
    draftNames: (draft.stakeholders ?? []).map((row) => row.name),
    draftNeedsReview: (draft.stakeholders ?? []).map((row) => row.needsReview),
    needsYou: needsYouFromDraft(draft).map((row) => row.question),
    draft,
    parsed,
    validation,
  };
}

function withMockedOpenAI(raw: unknown) {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (!url.includes("api.openai.com")) {
      assert.ok(orig, "unexpected non-OpenAI fetch with no original");
      return orig!(input, init);
    }
    calls.push(String(init?.body ?? ""));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        model: "gpt-4o-mini-2024-07-18",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = orig;
    },
  };
}

async function organise(raw: unknown) {
  const mock = withMockedOpenAI(raw);
  try {
    const res = await postNewProject(
      new Request("http://lume.test/api/new-project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: NARRATIVE, sourceMode: "paste" }),
      }),
    );
    const body = (await res.json()) as {
      draft?: {
        stakeholders?: Array<{ name: string; needsReview?: boolean }>;
      };
      provisionalItems?: unknown[];
      error?: string;
    };
    return { status: res.status, body, calledOpenAI: mock.calls.length >= 1 };
  } finally {
    mock.restore();
  }
}

function emptyWorld() {
  return {
    projectIds: new Set<string>(),
    projects: [],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  };
}

async function main() {
  const prevAuth = process.env.LUME_AUTH;
  const prevKey = process.env.OPENAI_API_KEY;
  process.env.LUME_AUTH = "none";
  process.env.OPENAI_API_KEY = "sk-test-np-organise-observation-loss-key";

  try {
    await check("production path is extract → parseObservationEnvelope → draftFromProvisional", () => {
      const route = readSrc("src/app/api/new-project/route.ts");
      const parse = readSrc("src/lib/new-project-v2/parse.ts");
      assert.match(route, /extractObservationsWithOpenAI/);
      assert.match(route, /parseNewProjectV2Envelope/);
      assert.match(route, /draftFromProvisional/);
      assert.match(route, /provisionalItems: parsed\.items/);
      assert.match(parse, /parseObservationEnvelope/);
      assert.match(parse, /validateObservations\(parsed\.observations, \[\], null\)/);
      assert.match(parse, /validation\.observations\.map/);
      assert.doesNotMatch(parse, /validation\.rejected/);
    });

    await check("schema-valid name-only Person survives parse → draft and is complete", () => {
      const staged = trace(VALID_NAME_ONLY);
      assert.equal(staged.observationCount, 2);
      assert.equal(staged.envelopeMalformed, false);
      assert.deepEqual(staged.acceptedIds, ["obs-bob", "obs-mike"]);
      assert.equal(staged.provisionalCount, 2);
      assert.deepEqual(staged.draftNames, ["bob", "mike"]);
      assert.equal(staged.draftNeedsReview.every((flag) => flag === false), true);
      assert.equal(staged.needsYou.length, 0);
    });

    await check("weak responsibility structure still keeps the named people", () => {
      const staged = trace(WEAK_RESPONSIBILITY);
      assert.deepEqual(staged.acceptedIds, ["obs-bob", "obs-mike"]);
      assert.equal(staged.provisionalCount, 2);
      assert.deepEqual(staged.draftNames, ["bob", "mike"]);
    });

    await check("POST /api/new-project keeps schema-valid name-only people", async () => {
      const { status, body, calledOpenAI } = await organise(VALID_NAME_ONLY);
      assert.equal(calledOpenAI, true);
      assert.equal(status, 200, body.error);
      const names = (body.draft?.stakeholders ?? []).map((row) => row.name);
      assert.deepEqual(names, ["bob", "mike"]);
      assert.equal((body.provisionalItems ?? []).length, 2);
    });

    const lossEnvelopes: Array<{
      label: string;
      raw: unknown;
      code: string;
    }> = [
      { label: "invented candidateTargetId", raw: FOREIGN_ID, code: "foreign_id" },
      { label: "missing truthIntent", raw: MISSING_TRUTH_INTENT, code: "missing_truth_intent" },
      { label: "unknown disposition create", raw: UNKNOWN_DISPOSITION, code: "unknown_disposition" },
    ];

    for (const row of lossEnvelopes) {
      await check(
        `hosted empty-Organise signature: ${row.label} disappears at VALIDATE, not draftFromProvisional`,
        () => {
          const staged = trace(row.raw);
          assert.equal(staged.observationCount, 2);
          assert.equal(staged.envelopeMalformed, false);
          assert.equal(staged.acceptedIds.length, 0);
          assert.equal(staged.rejectedIds.length, 2);
          assert.ok(
            staged.rejectCodes.every((code) => code === row.code),
            `${row.label} codes ${staged.rejectCodes.join(",")} expected ${row.code}`,
          );
          assert.equal(
            staged.provisionalCount,
            0,
            "D-052 current: rejected observations never become provisionalItems",
          );
          assert.deepEqual(staged.draftNames, []);
        },
      );

      await check(
        `POST /api/new-project reproduces hosted empty draft for ${row.label}`,
        async () => {
          const { status, body, calledOpenAI } = await organise(row.raw);
          assert.equal(calledOpenAI, true);
          assert.equal(status, 200, body.error);
          assert.equal((body.provisionalItems ?? []).length, 0);
          assert.equal((body.draft?.stakeholders ?? []).length, 0);
        },
      );

      await check(`Capture keeps ${row.label} visible as rejected findings`, () => {
        const run = runCaptureV2FromModelJson({
          transcript: NARRATIVE,
          rawModelJson: row.raw,
          world: emptyWorld(),
          projectId: null,
        });
        assert.equal(run.validation.rejected.length, 2);
        assert.equal((run.result.findings ?? []).length, 2);
      });
    }

    knownGap(
      "D-052 named people in a valid envelope must survive Organise",
      "parseNewProjectV2Envelope maps only accepted observations. Wait for approval before changing anything beyond preserving already-valid name-only Person truth (that path already passes).",
    );
  } finally {
    if (prevAuth === undefined) delete process.env.LUME_AUTH;
    else process.env.LUME_AUTH = prevAuth;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  }

  console.log(
    `\nverify-np-organise-observation-loss: ${passed} passed, ${skipped.length} known gap`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
