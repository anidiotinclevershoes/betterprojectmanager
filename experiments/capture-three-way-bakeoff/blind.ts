/**
 * Blind human-review packet. Mapping stored separately and not inlined.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContenderId, ContenderRun, FrozenManifest } from "./types";

const here = dirname(fileURLToPath(import.meta.url));

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function renderItems(run: ContenderRun | undefined): string {
  if (!run) return "_no run_";
  if (!run.ok) return `ERROR: ${run.error}`;
  return [
    "```json",
    JSON.stringify(run.normalized, null, 2),
    "```",
  ].join("\n");
}

function main() {
  const manifest = JSON.parse(
    readFileSync(join(here, "FROZEN_CORPUS.json"), "utf8"),
  ) as FrozenManifest;
  const stage1 = existsSync(join(here, "results/stage1/runs.json"))
    ? (JSON.parse(readFileSync(join(here, "results/stage1/runs.json"), "utf8")) as ContenderRun[])
    : [];
  const byCase = new Map<string, Map<ContenderId, ContenderRun>>();
  for (const run of stage1) {
    if (run.repeatIndex !== 1) continue;
    if (!byCase.has(run.caseId)) byCase.set(run.caseId, new Map());
    byCase.get(run.caseId)!.set(run.contender, run);
  }

  const mapping: Record<string, Record<"X" | "Y" | "Z", ContenderId>> = {};
  const labels = ["X", "Y", "Z"] as const;
  const packet: string[] = [
    "# Blind human comparison packet",
    "",
    "Do not infer which system is which from this packet.",
    "Judge each case on understanding, trust, unnecessary help, guessing, and missed information.",
    "",
  ];

  for (const [index, id] of manifest.blindIds.entries()) {
    const frozen = manifest.cases.find((row) => row.id === id);
    if (!frozen) continue;
    const order = seededShuffle(
      ["current", "simplification", "ai-first"] as ContenderId[],
      20260914 + index * 97,
    );
    mapping[id] = { X: order[0], Y: order[1], Z: order[2] };
    const runs = byCase.get(id);
    packet.push(`## Case ${index + 1}: ${frozen.title}`);
    packet.push("");
    packet.push(`Internal id (for facilitators only after review): \`${id}\``);
    packet.push("");
    packet.push("### RAW CAPTURE");
    packet.push("");
    packet.push("```text");
    packet.push(frozen.captureText);
    packet.push("```");
    packet.push("");
    packet.push("### CANONICAL PROJECT CONTEXT");
    packet.push("");
    packet.push("```json");
    packet.push(
      JSON.stringify(
        {
          projectId: frozen.projectId,
          people: frozen.world.projects.find((p) => p.id === frozen.projectId)?.stakeholders,
          risks: frozen.world.risks.filter((r) => r.projectId === frozen.projectId),
          todos: frozen.world.todos.filter((t) => t.projectId === frozen.projectId),
          dates: frozen.world.timeline.filter((t) => t.projectId === frozen.projectId),
        },
        null,
        2,
      ),
    );
    packet.push("```");
    packet.push("");
    packet.push("### EXPECTED MATERIAL FACTS");
    packet.push("");
    for (const fact of frozen.expected) {
      packet.push(
        `- ${fact.meaning} (${fact.expectedDisposition.join("|")}; target=${fact.targetId ?? "new/unbound"}; ambiguity=${fact.genuineAmbiguity ? "yes" : "no"})`,
      );
    }
    packet.push("");
    for (const label of labels) {
      packet.push(`### SYSTEM ${label}`);
      packet.push("");
      packet.push(renderItems(runs?.get(mapping[id][label])));
      packet.push("");
    }
  }

  writeFileSync(join(here, "BLIND_PACKET.md"), `${packet.join("\n")}\n`);
  writeFileSync(join(here, "BLIND_MAPPING.json"), `${JSON.stringify(mapping, null, 2)}\n`);
  console.log(`wrote blind packet for ${Object.keys(mapping).length} cases`);
}

main();
