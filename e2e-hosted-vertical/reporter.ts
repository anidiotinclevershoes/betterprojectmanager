import * as fs from "node:fs";
import * as path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import type { JourneyMatrixRow, VerticalBoundary } from "./types";

const OUTPUT_DIR = path.join(process.cwd(), "test-results", "hosted-vertical");

function annotation(test: TestCase, type: string): string | undefined {
  return test.annotations.find((item) => item.type === type)?.description;
}

function cell(value: string | undefined, fallback: JourneyMatrixRow["hostedApi"]): JourneyMatrixRow["hostedApi"] {
  if (value === "PASS" || value === "FAIL" || value === "BLOCKED" || value === "n/a") return value;
  return fallback;
}

class HostedVerticalReporter implements Reporter {
  private rows: JourneyMatrixRow[] = [];
  private startedAt = Date.now();

  onTestEnd(test: TestCase, result: TestResult): void {
    const journey = annotation(test, "journey") || test.title;
    const failed = result.status !== "passed";
    const boundary = (annotation(test, "boundary") ||
      (failed ? "UNKNOWN" : undefined)) as VerticalBoundary | undefined;
    this.rows.push({
      journey,
      vercelAccess: cell(annotation(test, "vercelAccess"), failed ? "FAIL" : "PASS"),
      lumeAuth: cell(annotation(test, "lumeAuth"), failed ? "FAIL" : "PASS"),
      hostedApi: cell(annotation(test, "hostedApi"), failed ? "FAIL" : "PASS"),
      liveOpenAi: cell(annotation(test, "liveOpenAi"), failed ? "FAIL" : "PASS"),
      uiInterpretation: cell(annotation(test, "uiInterpretation"), failed ? "FAIL" : "PASS"),
      review: cell(annotation(test, "review"), "n/a"),
      apply: cell(annotation(test, "apply"), "n/a"),
      reload: cell(annotation(test, "reload"), "n/a"),
      result: result.status === "skipped" || result.status === "interrupted" ? "BLOCKED" : failed ? "FAIL" : "PASS",
      earliestBoundary: boundary || (result.status === "skipped" || result.status === "interrupted" ? "AUTH" : undefined),
      classification: annotation(test, "classification") as JourneyMatrixRow["classification"],
      notes: annotation(test, "notes") || result.error?.message?.split("\n")[0],
    });
  }

  onEnd(): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const jsonPath = path.join(OUTPUT_DIR, "matrix.json");
    const mdPath = path.join(OUTPUT_DIR, "matrix.md");
    const elapsedMs = Date.now() - this.startedAt;
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ elapsedMs, rows: this.rows }, null, 2),
    );
    const header = [
      "| Journey | Vercel access | Lume auth | Hosted API | Live OpenAI | UI interpretation | Review | Apply | Reload/persistence | Result | Classification | Earliest boundary |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ];
    const lines = this.rows.map(
      (row) =>
        `| ${row.journey} | ${row.vercelAccess} | ${row.lumeAuth} | ${row.hostedApi} | ${row.liveOpenAi} | ${row.uiInterpretation} | ${row.review} | ${row.apply} | ${row.reload} | ${row.result} | ${row.classification || ""} | ${row.earliestBoundary || ""} |`,
    );
    fs.writeFileSync(
      mdPath,
      `# Hosted vertical journey matrix\n\nRuntime: ${Math.round(elapsedMs / 1000)}s\n\n${[...header, ...lines].join("\n")}\n`,
    );
    // eslint-disable-next-line no-console
    console.log(`\nHosted vertical matrix written to ${mdPath}\n`);
    // eslint-disable-next-line no-console
    console.log([...header, ...lines].join("\n"));
  }
}

export default HostedVerticalReporter;
