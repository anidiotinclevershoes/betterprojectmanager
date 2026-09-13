/**
 * Family G — projections must not present resolved canonical domain
 * truth as current open state. Historical Knowledge prose may remain.
 *
 * Do not invent general Knowledge supersede / retire semantics.
 *
 * Run: npx tsx scripts/verify-projection-authority.ts
 */
import assert from "node:assert/strict";
import { searchAuthoritativeProject } from "../src/lib/knowledge-centre/search-authority";
import { buildOpenRiskRows } from "../src/lib/knowledge-centre/ocean-frames";
import type { MissionState } from "../src/lib/types";

const PROJECT = "proj-riverside";
const DDA = "risk-dda";

function state(): MissionState {
  return {
    projects: [
      {
        id: PROJECT,
        name: "Riverside",
        code: "RCH",
        summary: "",
        kind: "delivery",
        currentFocus: "",
        stakeholders: [],
      },
    ],
    risks: [
      {
        id: DDA,
        projectId: PROJECT,
        title: "Outstanding DDA access ramp detail",
        status: "resolved",
        source: "import",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    todos: [],
    timeline: [],
    knowledge: [
      {
        projectId: PROJECT,
        updatedAt: "2026-09-01T00:00:00.000Z",
        sections: {
          now: ["The DDA access ramp detail is still outstanding."],
          risks: ["The DDA access ramp detail is still outstanding."],
          people: [],
          decisions: [],
          dates: [],
        },
        structured: [],
      },
    ],
    history: [],
    recommendations: [],
    memories: [],
    meetings: [],
  } as unknown as MissionState;
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

check("KC Risks frame omits resolved domain risk and leftover risk prose", () => {
  const rows = buildOpenRiskRows(state(), PROJECT);
  assert.equal(rows.length, 0);
});

check("Search does not present a resolved domain risk as current", () => {
  const hits = searchAuthoritativeProject(state(), PROJECT, "DDA access ramp");
  assert.equal(
    hits.filter((h) => h.sectionLabel === "Risks & blockers").length,
    0,
  );
});

console.log(`\n${passed} checks passed`);
