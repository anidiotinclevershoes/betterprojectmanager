/**
 * Narrow property tests for Capture V2 + Phase 3B invariants.
 *
 * fast-check is used only here. Existing tsx verify scripts are retained.
 * This is not a framework migration.
 *
 * Run: npx tsx scripts/verify-capture-v2-invariants.ts
 */
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  parseObservationEnvelope,
  resolveObservations,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import {
  CANDYLAND_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";

const PARAMS = { numRuns: 40 };

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function resolveCandy(
  observations: CaptureObservationV2[],
  world = experimentalApplyWorld(),
) {
  return resolveObservations({
    observations,
    world,
    transcript: observations.map((o) => o.statement).join(" "),
    captureEntryProjectId: CANDYLAND_ID,
  });
}

function main() {
  const world = experimentalApplyWorld();
  const records = contextRecordsFromWorld(world, CANDYLAND_ID);

  check("foreign-project IDs never produce legal mutations", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "risk-console",
          "risk-packaging",
          "person-brick",
          "person-pixel",
          "todo-track",
          "ms-cert",
          "ms-freeze",
        ),
        (foreignId) => {
          const validated = validateObservations(
            [
              {
                id: "obs-foreign",
                statement: "update foreign record",
                evidence: "update foreign record",
                domain: "risk",
                disposition: "update_existing",
                candidateTargetId: foreignId,
              },
            ],
            records,
            CANDYLAND_ID,
          );
          assert.equal(validated.observations.length, 0);
          const resolved = resolveCandy(validated.observations);
          assert.ok(resolved.every((row) => row.decision.kind !== "write"));
        },
      ),
      PARAMS,
    );
  });

  check("unknown domain never silently becomes CREATE", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 24 }), (domain) => {
        fc.pre(
          ![
            "person",
            "responsibility",
            "risk",
            "milestone",
            "todo",
            "availability",
            "knowledge",
            "decision",
            "commentary",
            "unknown",
          ].includes(domain),
        );
        const validated = validateObservations(
          [
            {
              id: "obs-unknown",
              statement: "something happened",
              evidence: "something happened",
              domain,
              disposition: "create_new",
              proposedValues: { title: "invented" },
            },
          ],
          records,
          CANDYLAND_ID,
        );
        assert.equal(validated.observations.length, 0);
        const resolved = resolveCandy(validated.observations);
        assert.ok(
          resolved.every(
            (row) =>
              row.decision.kind !== "write" ||
              (row.decision.kind === "write" &&
                !row.decision.operation.type.startsWith("create_")),
          ),
        );
      }),
      PARAMS,
    );
  });

  check("rejected observation never becomes Apply Ready", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9a-f]{8,24}$/), (id) => {
        const raw = {
          observations: [
            {
              id: "obs-rej",
              statement: "touch a record",
              evidence: "touch a record",
              domain: "risk",
              disposition: "update_existing",
              candidateTargetId: `foreign-${id}`,
            },
          ],
        };
        const parsed = parseObservationEnvelope(raw);
        const validated = validateObservations(
          parsed.observations,
          records,
          CANDYLAND_ID,
        );
        const resolved = resolveCandy(validated.observations);
        const rejectedIds = new Set(validated.rejected.map((o) => o.id));
        for (const row of resolved) {
          if (rejectedIds.has(row.observation.id)) {
            assert.notEqual(row.decision.kind, "write");
          }
        }
        assert.ok(validated.rejected.length >= 1);
      }),
      PARAMS,
    );
  });

  check("Needs you (ambiguous) never becomes CREATE", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("person", "responsibility", "risk", "milestone"),
        (domain) => {
          const resolved = resolveCandy([
            {
              id: "obs-amb",
              statement: "unclear ownership",
              evidence: "unclear ownership",
              domain,
              disposition: "ambiguous",
              projectId: CANDYLAND_ID,
              candidateTargetId: null,
              candidateTargetTitle: null,
              mergeWithObservationId: null,
              proposedValues: { ownershipSemantics: "ambiguous" },
              commentary: "cannot decide",
              modelConfidence: null,
            },
          ]);
          assert.equal(resolved[0]?.decision.kind, "needs_you");
        },
      ),
      PARAMS,
    );
  });

  check("reordering unrelated project objects does not change target identity", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (seed) => {
        const world = experimentalApplyWorld();
        const rotate = <T>(items: T[]): T[] => {
          if (items.length < 2) return items;
          const n = seed % items.length;
          return [...items.slice(n), ...items.slice(0, n)];
        };
        const reordered = {
          ...world,
          projectIds: new Set(world.projectIds),
          projects: rotate(world.projects).map((p) => ({
            ...p,
            stakeholders: rotate(p.stakeholders),
          })),
          risks: rotate(world.risks),
          todos: rotate(world.todos),
          timeline: rotate(world.timeline),
        };
        const reorderedRecords = contextRecordsFromWorld(reordered, CANDYLAND_ID);
        const validated = validateObservations(
          [
            {
              id: "obs-id",
              statement: "Gumdrop Bridge icing is resolved",
              evidence: "Gumdrop Bridge icing is resolved",
              domain: "risk",
              disposition: "update_existing",
              candidateTargetId: "risk-bridge",
              proposedValues: { status: "resolved" },
            },
          ],
          reorderedRecords,
          CANDYLAND_ID,
        );
        assert.equal(validated.observations[0]?.candidateTargetId, "risk-bridge");
        const resolved = resolveCandy(validated.observations, reordered);
        assert.equal(resolved[0]?.decision.kind, "write");
        if (resolved[0]?.decision.kind === "write") {
          assert.equal(resolved[0].decision.domain, "risk");
          if (resolved[0].decision.operation.type === "update_risk_status") {
            assert.equal(resolved[0].decision.operation.riskId, "risk-bridge");
            assert.equal(resolved[0].decision.operation.projectId, CANDYLAND_ID);
          }
        }
      }),
      PARAMS,
    );
  });

  check("arbitrary foreign IDs do not retarget project scope", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9_-]{6,20}$/),
        (foreignId) => {
          fc.pre(!records.some((r) => r.id === foreignId));
          const validated = validateObservations(
            [
              {
                id: "obs-arb",
                statement: "retarget",
                evidence: "retarget",
                domain: "todo",
                disposition: "update_existing",
                projectId: "proj-other-world",
                candidateTargetId: foreignId,
              },
            ],
            records,
            CANDYLAND_ID,
          );
          assert.equal(validated.observations.length, 0);
          assert.ok(
            validated.issues.some(
              (i) =>
                i.code === "foreign_id" || i.code === "cross_project_id",
            ),
          );
        },
      ),
      PARAMS,
    );
  });

  check("duplicate observation delivery does not create duplicate durable intent", () => {
    const resolved = resolveCandy([
      {
        id: "obs-1",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved",
        domain: "risk",
        disposition: "update_existing",
        projectId: CANDYLAND_ID,
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        mergeWithObservationId: null,
        proposedValues: { status: "resolved" },
        commentary: null,
        modelConfidence: null,
      },
      {
        id: "obs-2",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved",
        domain: "risk",
        disposition: "merge",
        projectId: CANDYLAND_ID,
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        mergeWithObservationId: "obs-1",
        proposedValues: null,
        commentary: null,
        modelConfidence: null,
      },
    ]);
    const writes = resolved.filter((row) => row.decision.kind === "write");
    assert.equal(writes.length, 1);
    assert.equal(resolved[1]?.decision.kind, "no_change");
  });

  check("a valid Person UUID never raises incomplete textual identity to Apply Ready", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("Jordan", "Riley", "Casey", "Avery", "Quinn"),
        fc.constantFrom("Hale", "Patel", "Ng", "Brooks", "Frost"),
        fc.constantFrom("Ash", "Okada", "Singh", "Vale", "Cole"),
        fc.constantFrom("person", "availability", "responsibility"),
        fc.integer({ min: 0, max: 2 }),
        (first, lastA, lastB, domain, extra) => {
          fc.pre(lastA !== lastB);
          const people = [
            { id: "p-a", name: `${first} ${lastA}`, role: "A" },
            { id: "p-b", name: `${first} ${lastB}`, role: "B" },
          ];
          for (let i = 0; i < extra; i += 1) {
            people.push({
              id: `p-x${i}`,
              name: `Morgan Extra${i}`,
              role: "X",
            });
          }
          const baseWorld = experimentalApplyWorld();
          const world: CaptureApplyWorld = {
            ...baseWorld,
            projects: baseWorld.projects.map((p) =>
              p.id === CANDYLAND_ID ? { ...p, stakeholders: people } : p,
            ),
          };
          const transcript = `${first} from dispatch called.`;
          const proposed =
            domain === "availability"
              ? { awayFromIso: "2026-10-06" }
              : domain === "responsibility"
                ? {
                    personName: people[0]!.name,
                    scope: "dispatch",
                    ownershipSemantics: "share",
                  }
                : { name: people[0]!.name };
          const base = {
            id: "obs-id-cert",
            statement: transcript,
            evidence: transcript,
            domain,
            disposition: "update_existing" as const,
            projectId: CANDYLAND_ID,
            candidateTargetTitle: people[0]!.name,
            proposedValues: proposed,
            commentary: null,
            modelConfidence: null,
          };
          const without = resolveObservations({
            observations: [{ ...base, candidateTargetId: null }],
            world,
            transcript,
            captureEntryProjectId: CANDYLAND_ID,
          });
          const withA = resolveObservations({
            observations: [{ ...base, candidateTargetId: "p-a" }],
            world,
            transcript,
            captureEntryProjectId: CANDYLAND_ID,
          });
          const withB = resolveObservations({
            observations: [{ ...base, candidateTargetId: "p-b" }],
            world,
            transcript,
            captureEntryProjectId: CANDYLAND_ID,
          });
          assert.notEqual(without[0]?.decision.kind, "write");
          assert.notEqual(withA[0]?.decision.kind, "write");
          assert.notEqual(withB[0]?.decision.kind, "write");
          assert.equal(withA[0]?.decision.kind, without[0]?.decision.kind);
          assert.equal(withB[0]?.decision.kind, without[0]?.decision.kind);
        },
      ),
      PARAMS,
    );
  });

  check("malformed envelopes fail closed", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant("not json"),
          fc.constant(42),
          fc.constant({ hello: true }),
          fc.constant({ observations: "nope" }),
        ),
        (raw) => {
          const parsed = parseObservationEnvelope(raw);
          assert.equal(parsed.observations.length, 0);
          assert.ok(parsed.issues.some((i) => i.code === "malformed"));
        },
      ),
      PARAMS,
    );
  });

  console.log("\nCapture V2 invariant properties passed.");
}

main();
