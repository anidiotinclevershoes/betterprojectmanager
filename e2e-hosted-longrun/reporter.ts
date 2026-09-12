import * as fs from "node:fs";
import * as path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

const OUTPUT_DIR = path.join(process.cwd(), "test-results", "hosted-longrun");

class LongrunReporter implements Reporter {
  private startedAt = Date.now();

  onTestEnd(test: TestCase, result: TestResult): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "playwright-result.json"),
      JSON.stringify(
        {
          title: test.title,
          status: result.status,
          duration: result.duration,
          error: result.error?.message?.split("\n")[0] || null,
        },
        null,
        2,
      ),
    );
  }

  onEnd(): void {
    const matrixPath = path.join(OUTPUT_DIR, "matrix.md");
    if (fs.existsSync(matrixPath)) {
      // eslint-disable-next-line no-console
      console.log(`\nLong-run matrix: ${matrixPath}\n`);
      // eslint-disable-next-line no-console
      console.log(fs.readFileSync(matrixPath, "utf8"));
    }
    // eslint-disable-next-line no-console
    console.log(`Long-run wall time ${Math.round((Date.now() - this.startedAt) / 1000)}s`);
  }
}

export default LongrunReporter;
