/**
 * Deterministic stacked Capture regression (no live AI).
 * Sequential frozen envelopes against evolving experimental worlds.
 *
 * Run: npx tsx scripts/verify-stacked-capture.ts
 */
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import { STACKED_STORIES } from "../src/lib/eval-capture-v2/stacked-stories";
import {
  reviewMatches,
  runStackedStory,
  snapshotProject,
} from "../src/lib/eval-capture-v2/stacked-runtime";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "../src/lib/experiments/worlds";

function names(list: Array<{ name: string }>): string[] {
  return list.map((row) => row.name).sort();
}

async function main() {
  const only = process.env.STACKED_STORY;
  const stories =
    !only || only === "all"
      ? STACKED_STORIES
      : STACKED_STORIES.filter((s) => s.id === only);
  assert.ok(stories.length > 0, `No stacked stories matched ${only ?? "all"}`);

  for (const story of stories) {
    const run = await runStackedStory(story);
    for (const step of run.steps) {
      const spec = story.steps.find((s) => s.id === step.stepId);
      assert.ok(spec, step.stepId);
      assert.equal(
        reviewMatches(spec.expectedReview, step.review),
        true,
        `${story.id}/${step.stepId} expected ${spec.expectedReview}, got ${step.review} (writes=${step.writeCount} needsYou=${step.needsYouCount})`,
      );
      assert.equal(
        step.lumeFailures,
        0,
        `${story.id}/${step.stepId} LUME FAILURE count ${step.lumeFailures}`,
      );
      if (spec.expectedReview === "needs_you") {
        assert.equal(step.writeCount, 0, `${step.stepId} must not write`);
        assert.ok(step.needsYouCount >= 1, `${step.stepId} must Needs you`);
      }
      if (spec.expectedReview === "no_change") {
        assert.equal(step.writeCount, 0, `${step.stepId} must not write`);
      }
    }

    const final = run.final;
    const candy = snapshotProject(run.state, CANDYLAND_ID);
    const toy = snapshotProject(run.state, TOYWORLD_ID);
    const game = snapshotProject(run.state, GAMING_ID);

    if (story.id === "candyland") {
      assert.equal(final.peopleCount, 2);
      assert.deepEqual(names(final.people), ["Fizz Caramel", "Pippa Gumdrop"]);
      assert.ok(final.people.some((p) => p.id === "person-gumdrop"));
      assert.ok(final.people.some((p) => p.id === "person-fizz"));
      const bridge = final.risks.find((r) => r.id === "risk-bridge");
      assert.ok(bridge);
      assert.equal(bridge?.status, "resolved");
      const parade = final.dates.find((d) => d.id === "ms-parade");
      assert.ok(parade?.startAt?.startsWith("2026-10-29"));
      assert.ok(final.availability.some((a) => a.personId === "person-fizz"));
      const banners = final.todos.find((t) =>
        t.title.toLowerCase().includes("candy-cane banners"),
      );
      assert.ok(banners);
      assert.equal(banners?.done, true);
      assert.equal(final.todos.filter((t) => t.title === "Prepare the jelly pack").length, 1);
      assert.equal(
        final.people.filter((p) => p.name === "Pippa Gumdrop").length,
        1,
      );
      assert.deepEqual(names(toy.people), names(run.seedSnapshots.toyworld.people));
      assert.deepEqual(names(game.people), names(run.seedSnapshots.gamingstudio5000.people));
      assert.deepEqual(
        toy.risks.map((r) => `${r.id}:${r.status}`),
        run.seedSnapshots.toyworld.risks.map((r) => `${r.id}:${r.status}`),
      );
      assert.deepEqual(
        game.risks.map((r) => `${r.id}:${r.status}`),
        run.seedSnapshots.gamingstudio5000.risks.map((r) => `${r.id}:${r.status}`),
      );
    }

    if (story.id === "toyworld") {
      assert.equal(final.people.filter((p) => p.name === "Velvet Sprocket").length, 1);
      assert.ok(final.people.some((p) => p.id === "person-brick"));
      assert.ok(final.people.some((p) => p.id === "person-buttons"));
      assert.equal(final.peopleCount, 3);
      assert.equal(final.risks.filter((r) => r.title === "Packaging delay").length, 1);
      const packaging = final.risks.find((r) => r.id === "risk-packaging");
      assert.equal(packaging?.status, "open");
      assert.deepEqual(names(candy.people), names(run.seedSnapshots.candyland.people));
      assert.deepEqual(names(game.people), names(run.seedSnapshots.gamingstudio5000.people));
      assert.ok(candy.risks.some((r) => r.id === "risk-bridge" && r.status === "open"));
      assert.ok(game.risks.some((r) => r.id === "risk-console" && r.status === "open"));
    }

    if (story.id === "gamingstudio5000") {
      assert.equal(final.people.filter((p) => p.name === "Pixel Ramos").length, 1);
      assert.equal(final.people.filter((p) => /nova quill/i.test(p.name)).length, 0);
      assert.ok(final.risks.some((r) => r.id === "risk-console" && r.status === "open"));
      assert.ok(final.risks.some((r) => /audio bus/i.test(r.title)));
      assert.ok(final.risks.some((r) => /shader/i.test(r.title)));
      assert.equal(final.risks.filter((r) => /chiptune/i.test(r.title)).length, 0);
      assert.deepEqual(names(candy.people), names(run.seedSnapshots.candyland.people));
      assert.deepEqual(names(toy.people), names(run.seedSnapshots.toyworld.people));
    }

    const outDir = join(process.cwd(), "test-results");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, `stacked-${story.id}.json`),
      JSON.stringify(
        {
          storyId: story.id,
          final,
          isolation: { candyland: candy, toyworld: toy, gamingstudio5000: game },
          steps: run.steps.map((s) => ({
            id: s.stepId,
            review: s.review,
            writeCount: s.writeCount,
            needsYouCount: s.needsYouCount,
            lumeFailures: s.lumeFailures,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`✓ stacked ${story.id} (${run.steps.length} steps)`);
  }

  assert.equal(experimentalMissionState().projects.length, 3);
  console.log("\nStacked Capture regression passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
