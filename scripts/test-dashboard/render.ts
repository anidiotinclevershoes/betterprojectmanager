import { serializeDashboardState } from "./history";
import {
  DASHBOARD_ISSUE_TITLE,
  WORLD_IDS,
  WORLD_LABEL,
  type CollectedEvidence,
  type DashboardState,
  type ModelRow,
  type SuiteResult,
  type WorldId,
  type WorldSuite,
} from "./schema";
import { redactSecrets } from "./secrets";

export function escapeMdCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return redactSecrets(String(value))
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .replace(/-->/g, "→");
}

export function outcomeCell(value: SuiteResult | null | undefined): string {
  if (value === "pass") return "✅";
  if (value === "fail") return "❌";
  if (value === "warn") return "⚠️";
  if (value === "skip") return "⏭️";
  return "—";
}

export function resultCell(value: SuiteResult | null | undefined): string {
  if (value === "pass") return "✅ PASS";
  if (value === "fail") return "❌ FAIL";
  if (value === "warn") return "⚠️ CAUGHT";
  if (value === "skip") return "⏭️ SKIP";
  return "—";
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (digits === 0) return String(Math.round(value));
  return value.toFixed(digits);
}

function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `$${value.toFixed(4)}`;
}

function ms(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function shaCell(sha: string): string {
  return `\`${escapeMdCell(sha.slice(0, 7))}\``;
}

function prCell(pr: number | null): string {
  return pr ? `#${pr}` : "—";
}

export function modelLabel(row: Pick<ModelRow, "provider" | "model">): string {
  return `${row.provider} / ${row.model}`;
}

function scorerLabel(row: Pick<ModelRow, "scorerVersion">): string {
  return row.scorerVersion?.trim() || "capture-v2-eval-scorer-v1";
}

export function latestModels(models: ModelRow[]): ModelRow[] {
  const latest = new Map<string, ModelRow>();
  for (const row of models) {
    const key = `${row.provider}\0${row.model}\0${scorerLabel(row)}`;
    const existing = latest.get(key);
    if (!existing || row.timestamp > existing.timestamp) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => {
    const byModel = modelLabel(a).localeCompare(modelLabel(b));
    if (byModel !== 0) return byModel;
    return scorerLabel(a).localeCompare(scorerLabel(b));
  });
}

function worldName(world: WorldId): string {
  return WORLD_LABEL[world];
}

function glanceRegression(state: DashboardState): string {
  const latest = state.regressionRows[0];
  if (!latest) return "No regression evidence recorded yet.";
  const label = `${prCell(latest.prNumber)} / ${shaCell(latest.sha)}`;
  return `${resultCell(latest.overall)} (${label})`;
}

function glanceLumeFailures(models: ModelRow[]): string {
  if (models.length === 0) return "—";
  const total = models.reduce((sum, row) => sum + (row.lumeFailures ?? 0), 0);
  return total > 0 ? `❌ ${total}` : "✅ 0";
}

function glanceCost(models: ModelRow[]): string {
  if (models.length === 0) return "—";
  const known = models.filter((row) => row.costUsd !== null);
  if (known.length === 0) return "—";
  return usd(known.reduce((sum, row) => sum + (row.costUsd ?? 0), 0));
}

function regressionTrend(rows: DashboardState["regressionRows"]): string {
  if (rows.length < 2) return "—";
  const [latest, previous] = rows;
  if (latest.overall === "fail" && previous.overall === "pass") {
    return "❌ worsened vs previous recorded run";
  }
  if (latest.overall === "pass" && previous.overall === "fail") {
    return "✅ recovered vs previous recorded run";
  }
  return "No change in overall pass/fail vs previous recorded run";
}

function metricLines(row: ModelRow): string[] {
  return [
    `- **Provider:** ${escapeMdCell(row.provider)}`,
    `- **Model:** ${escapeMdCell(row.model)}`,
    `- **Corpus:** ${escapeMdCell(row.corpusVersion)}`,
    `- **Scorer:** ${escapeMdCell(scorerLabel(row))}`,
    `- **Cases:** ${num(row.caseCount)}`,
    `- **Recall:** ${pct(row.recall)}`,
    `- **False positives / false observations:** ${num(row.falsePositives)}`,
    `- **Domain accuracy:** ${pct(row.domainAccuracy)}`,
    `- **Existing-vs-new identity accuracy:** ${pct(row.existingVsNewAccuracy)}`,
    `- **Target-ID accuracy:** ${pct(row.targetIdAccuracy)}`,
    `- **Ambiguity handling:** ${pct(row.ambiguityHandling)}`,
    `- **No-change handling:** ${pct(row.noChangeHandling)}`,
    `- **Commentary handling:** ${pct(row.commentaryHandling)}`,
    `- **Stability:** ${pct(row.stability)}`,
    `- **MODEL FAILURE:** ${num(row.modelFailures)}`,
    `- **LUME CATCH:** ${num(row.lumeCatches)}`,
    `- **LUME FAILURE:** ${num(row.lumeFailures)}`,
    `- **Input tokens:** ${num(row.tokens.input)}`,
    `- **Output tokens:** ${num(row.tokens.output)}`,
    `- **Total tokens:** ${num(row.tokens.total)}`,
    `- **Latency:** ${ms(row.latencyMs)}`,
    `- **Approximate cost:** ${usd(row.costUsd)}`,
    `- **Result:** ${resultCell(row.result)}`,
  ];
}

function worldTable(worlds: Partial<Record<WorldId, WorldSuite>>): string[] {
  const lines = [
    `| World | Cases | Recall | MODEL FAILURE | LUME CATCH | LUME FAILURE |`,
    `|---|---:|---:|---:|---:|---:|`,
  ];
  for (const world of WORLD_IDS) {
    const row = worlds[world];
    if (!row) continue;
    lines.push(
      `| ${worldName(world)} | ${num(row.caseCount)} | ${pct(row.recall)} | ${num(row.modelFailures)} | ${num(row.lumeCatches)} | ${num(row.lumeFailures)} |`,
    );
  }
  return lines;
}

export function renderJobSummary(evidence: CollectedEvidence): string {
  const lines: string[] = [];
  lines.push(`# Lume test evidence`);
  lines.push("");
  lines.push(`- **PR:** ${prCell(evidence.prNumber)}`);
  lines.push(`- **Branch:** \`${escapeMdCell(evidence.branch ?? "unknown")}\``);
  lines.push(`- **Commit:** \`${escapeMdCell(evidence.sha)}\``);
  lines.push(`- **Run time:** ${escapeMdCell(evidence.timestamp)}`);
  lines.push(`- **Overall:** ${resultCell(evidence.overall)}`);
  if (evidence.workflowUrl) {
    lines.push(`- **Workflow:** ${evidence.workflowUrl}`);
  }
  lines.push("");
  lines.push(`## Regression`);
  lines.push("");
  lines.push(`| Check | Result |`);
  lines.push(`|---|---|`);
  lines.push(`| Typecheck | ${outcomeCell(evidence.typecheck)} |`);
  lines.push(`| npm test | ${outcomeCell(evidence.npmTest)} |`);
  lines.push(`| Frozen Playwright | ${outcomeCell(evidence.playwright)} |`);
  lines.push(`| Stacked Capture | ${outcomeCell(evidence.stacked)} |`);
  lines.push(`| Candyland | ${outcomeCell(evidence.worlds.candyland.result)} |`);
  lines.push(`| Toyworld | ${outcomeCell(evidence.worlds.toyworld.result)} |`);
  lines.push(`| GamingStudio5000 | ${outcomeCell(evidence.worlds.gamingstudio5000.result)} |`);
  lines.push(`| Overall | ${resultCell(evidence.overall)} |`);
  lines.push("");
  lines.push(`### Worlds`);
  lines.push("");
  lines.push(`| World | Stacked | Lume failures | Writes | Needs you |`);
  lines.push(`|---|---|---:|---:|---:|`);
  for (const world of WORLD_IDS) {
    const row = evidence.worlds[world];
    lines.push(
      `| ${worldName(world)} | ${outcomeCell(row.result)} | ${num(row.lumeFailures)} | ${num(row.writeCount)} | ${num(row.needsYouCount)} |`,
    );
  }
  lines.push("");

  if (evidence.modelRows.length === 0) {
    lines.push(`## Live model benchmark`);
    lines.push("");
    lines.push(`No live Capture V2 benchmark has been recorded for this run.`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`## Live model benchmark`);
  lines.push("");
  for (const row of evidence.modelRows) {
    lines.push(`### ${escapeMdCell(modelLabel(row))}`);
    lines.push("");
    lines.push(...metricLines(row));
    lines.push("");
    if (Object.keys(row.worlds).length > 0) {
      lines.push(...worldTable(row.worlds));
      lines.push("");
    }
  }

  if (evidence.importantFailures.length > 0) {
    lines.push(`## Important failures`);
    lines.push("");
    lines.push(`| Case | World | Expected | Actual | Classification |`);
    lines.push(`|---|---|---|---|---|`);
    for (const failure of evidence.importantFailures.slice(0, 20)) {
      lines.push(
        `| ${escapeMdCell(failure.caseId)} | ${escapeMdCell(failure.world)} | ${escapeMdCell(failure.expected)} | ${escapeMdCell(failure.actual)} | ${escapeMdCell(failure.classification)} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function renderIssueBody(state: DashboardState, updatedAt: string): string {
  const latest = latestModels(state.modelRows);
  const lines: string[] = [];
  lines.push(`# ${DASHBOARD_ISSUE_TITLE}`);
  lines.push("");
  lines.push(`Last updated: ${escapeMdCell(updatedAt)}`);
  lines.push("");
  lines.push(
    `This is the product-owner comparison page for regression and live model evidence. Detailed payloads stay in workflow artifacts — not in this issue.`,
  );
  lines.push("");
  lines.push(`## At a glance`);
  lines.push("");
  lines.push(`| Question | Answer |`);
  lines.push(`|---|---|`);
  lines.push(`| Is the latest recorded run safe? | ${glanceRegression(state)} |`);
  lines.push(
    `| Live models recorded | ${latest.length === 0 ? "No live Capture V2 benchmark has been recorded yet." : latest.map((row) => escapeMdCell(modelLabel(row))).join(", ")} |`,
  );
  lines.push(`| Lume failures in latest model runs | ${glanceLumeFailures(latest)} |`);
  lines.push(`| Regression vs previous recorded run | ${regressionTrend(state.regressionRows)} |`);
  lines.push(`| Latest benchmark cost | ${glanceCost(latest)} |`);
  lines.push("");
  lines.push(`## Current Safety Status`);
  lines.push("");
  if (state.regressionRows.length === 0) {
    lines.push(`No regression evidence has been recorded yet.`);
  } else {
    lines.push(`| PR / SHA | Core Regression | Frozen E2E | Stacked Capture | Overall |`);
    lines.push(`|---|---|---|---|---|`);
    for (const row of state.regressionRows) {
      const label = `${prCell(row.prNumber)} / ${shaCell(row.sha)}`;
      const linked = row.workflowUrl ? `[${label}](${row.workflowUrl})` : label;
      lines.push(
        `| ${linked} | ${outcomeCell(row.npmTest)} | ${outcomeCell(row.playwright)} | ${outcomeCell(row.stacked)} | ${resultCell(row.overall)} |`,
      );
    }
  }
  lines.push("");
  lines.push(`## Latest Model Comparison`);
  lines.push("");
  if (latest.length === 0) {
    lines.push(`No live Capture V2 benchmark has been recorded yet.`);
  } else {
    lines.push(
      `Compare rows directly. This dashboard does not invent a single winner score.`,
    );
    lines.push("");
    lines.push(
      `| Model | Scorer | Recall | False Positives | Lume Catches | Lume Failures | Tokens | Cost | Latency | Result |`,
    );
    lines.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---|`);
    for (const row of latest) {
      lines.push(
        `| ${escapeMdCell(modelLabel(row))} | ${escapeMdCell(scorerLabel(row))} | ${pct(row.recall)} | ${num(row.falsePositives)} | ${num(row.lumeCatches)} | ${num(row.lumeFailures)} | ${num(row.tokens.total)} | ${usd(row.costUsd)} | ${ms(row.latencyMs)} | ${resultCell(row.result)} |`,
      );
    }
  }
  lines.push("");
  lines.push(`## By World`);
  lines.push("");
  renderWorldSection(lines, state, latest);
  lines.push("");
  lines.push(`## Model History by PR / Commit`);
  lines.push("");
  if (state.modelRows.length === 0) {
    lines.push(`No live Capture V2 benchmark has been recorded yet.`);
  } else {
    lines.push(`| PR | SHA | Model | Scorer | Recall | Lume Failures | Cost | Result |`);
    lines.push(`|---|---|---|---|---:|---:|---:|---|`);
    for (const row of state.modelRows) {
      lines.push(
        `| ${prCell(row.prNumber)} | ${shaCell(row.sha)} | ${escapeMdCell(modelLabel(row))} | ${escapeMdCell(scorerLabel(row))} | ${pct(row.recall)} | ${num(row.lumeFailures)} | ${usd(row.costUsd)} | ${resultCell(row.result)} |`,
      );
    }
  }
  lines.push("");
  lines.push(`## Important Failures`);
  lines.push("");
  if (state.importantFailures.length === 0) {
    lines.push(
      `No classified MODEL FAILURE / LUME CATCH / LUME FAILURE rows in recent runs.`,
    );
  } else {
    lines.push(`| Case | World | Expected | Actual | Classification | Run |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const failure of state.importantFailures) {
      const run = failure.workflowUrl
        ? `[${shaCell(failure.sha)}](${failure.workflowUrl})`
        : shaCell(failure.sha);
      lines.push(
        `| ${escapeMdCell(failure.caseId)} | ${escapeMdCell(failure.world)} | ${escapeMdCell(failure.expected)} | ${escapeMdCell(failure.actual)} | ${escapeMdCell(failure.classification)} | ${run} |`,
      );
    }
  }
  lines.push("");
  lines.push(`---`);
  lines.push("");
  lines.push(
    `Legend: ✅ pass/good · ⚠️ warning / caught · ❌ failure · — not available.`,
  );
  lines.push(
    `**MODEL FAILURE** = the model was wrong. **LUME CATCH** = Lume stopped that wrong output from becoming truth. **LUME FAILURE** = Lume allowed a wrong output to become truth.`,
  );
  lines.push(
    `Stability is shown as — because the Capture V2 harness does not emit a stability metric.`,
  );
  lines.push("");
  return lines.join("\n");
}

function renderWorldSection(
  lines: string[],
  state: DashboardState,
  latest: ModelRow[],
): void {
  const latestRegression = state.regressionRows[0];

  lines.push(`### Stacked Capture (latest regression)`);
  lines.push("");
  if (
    !latestRegression ||
    WORLD_IDS.every((world) => latestRegression.worlds[world].result === "unknown")
  ) {
    lines.push(`No stacked Capture world evidence in the latest regression row.`);
  } else {
    lines.push(`| World | Result | Lume failures | Writes | Needs you |`);
    lines.push(`|---|---|---:|---:|---:|`);
    for (const world of WORLD_IDS) {
      const row = latestRegression.worlds[world];
      lines.push(
        `| ${worldName(world)} | ${outcomeCell(row.result)} | ${num(row.lumeFailures)} | ${num(row.writeCount)} | ${num(row.needsYouCount)} |`,
      );
    }
  }

  lines.push("");
  lines.push(`### Live benchmark (latest per model)`);
  lines.push("");
  if (latest.length === 0) {
    lines.push(`No live Capture V2 benchmark has been recorded yet.`);
    return;
  }

  lines.push(
    `| Model | Scorer | World | Cases | Recall | MODEL FAILURE | LUME CATCH | LUME FAILURE |`,
  );
  lines.push(`|---|---|---|---:|---:|---:|---:|---:|`);
  for (const row of latest) {
    const present = WORLD_IDS.filter((world) => row.worlds[world]);
    if (present.length === 0) {
      lines.push(
        `| ${escapeMdCell(modelLabel(row))} | ${escapeMdCell(scorerLabel(row))} | — | ${num(row.caseCount)} | ${pct(row.recall)} | ${num(row.modelFailures)} | ${num(row.lumeCatches)} | ${num(row.lumeFailures)} |`,
      );
      continue;
    }
    for (const world of present) {
      const slice = row.worlds[world];
      if (!slice) continue;
      lines.push(
        `| ${escapeMdCell(modelLabel(row))} | ${escapeMdCell(scorerLabel(row))} | ${worldName(world)} | ${num(slice.caseCount)} | ${pct(slice.recall)} | ${num(slice.modelFailures)} | ${num(slice.lumeCatches)} | ${num(slice.lumeFailures)} |`,
      );
    }
  }
}

export function composeIssueBody(state: DashboardState): string {
  return `${renderIssueBody(state, state.updatedAt)}${serializeDashboardState(state)}`;
}
