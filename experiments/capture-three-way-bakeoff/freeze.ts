import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { buildFrozenManifest } from "./corpus";

const here = dirname(fileURLToPath(import.meta.url));

function main() {
  const manifest = buildFrozenManifest();
  mkdirSync(here, { recursive: true });
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const out = join(here, "FROZEN_CORPUS.json");
  writeFileSync(out, json);
  const sha = createHash("sha256").update(json).digest("hex");
  writeFileSync(join(here, "FROZEN_CORPUS.sha256"), `${sha}\n`);

  const counts: Record<string, number> = {};
  const sources: Record<string, number> = {};
  for (const row of manifest.cases) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
    sources[row.expectedSource] = (sources[row.expectedSource] ?? 0) + 1;
  }
  const md = [
    "# Frozen three-way bake-off corpus",
    "",
    "Frozen **before** any Current / Simplification / AI-first live run.",
    "Do not retune cases, expected outcomes, prompts, or models after seeing outputs.",
    "",
    `- Cases: **${manifest.cases.length}**`,
    `- Stage 2 subset: **${manifest.stage2Ids.length}**`,
    `- Stage 3 subset: **${manifest.stage3Ids.length}**`,
    `- Blind packet: **${manifest.blindIds.length}**`,
    `- SHA-256: \`${sha}\``,
    "",
    "## Pins",
    "",
    `- Current: \`${manifest.pins.current}\``,
    `- Simplification: \`${manifest.pins.simplification}\``,
    `- AI-first Gate 1 v2: \`${manifest.pins.aiFirst}\``,
    "",
    "## Category distribution",
    "",
    ...Object.entries(counts).map(([k, n]) => `- ${k}: ${n}`),
    "",
    "## Expected-outcome sources",
    "",
    ...Object.entries(sources).map(([k, n]) => `- ${k}: ${n}`),
    "",
    "## Cases",
    "",
    "| id | category | source | facts | stage2 | stage3 | historical |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...manifest.cases.map(
      (row) =>
        `| ${row.id} | ${row.category} | ${row.expectedSource} | ${row.expected.length} | ${row.stage2 ? "yes" : ""} | ${row.stage3 ? "yes" : ""} | ${row.historical ? "yes" : ""} |`,
    ),
    "",
  ].join("\n");
  writeFileSync(join(here, "FROZEN_CORPUS.md"), md);
  console.log(`froze ${manifest.cases.length} cases sha=${sha}`);
}

main();
