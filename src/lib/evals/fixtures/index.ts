import { SAMPLE_BENCHMARK } from "@/lib/evals/fixtures/sample-world";
import type {
  EvalBenchmarkManifest,
  EvalCaseFixture,
  EvalDimension,
  EvalWorldFixture,
} from "@/lib/evals/types";

/** Registry of in-repo benchmarks. Add real worlds here later. */
const BENCHMARKS: EvalBenchmarkManifest[] = [SAMPLE_BENCHMARK];

export function listBenchmarks(): EvalBenchmarkManifest[] {
  return BENCHMARKS;
}

export function getActiveBenchmark(): EvalBenchmarkManifest {
  return SAMPLE_BENCHMARK;
}

export function getWorld(worldId: string): EvalWorldFixture | null {
  for (const b of BENCHMARKS) {
    const w = b.worlds.find((x) => x.id === worldId);
    if (w) return w;
  }
  return null;
}

export function getCase(caseId: string): EvalCaseFixture | null {
  for (const b of BENCHMARKS) {
    for (const w of b.worlds) {
      const c = w.cases.find((x) => x.id === caseId);
      if (c) return c;
    }
  }
  return null;
}

export function listAllCases(opts?: {
  worldIds?: string[];
  categories?: EvalDimension[];
}): EvalCaseFixture[] {
  const worlds = getActiveBenchmark().worlds.filter((w) =>
    opts?.worldIds?.length ? opts.worldIds.includes(w.id) : true,
  );
  const cases = worlds.flatMap((w) => w.cases);
  if (!opts?.categories?.length) return cases;
  return cases.filter((c) =>
    c.categories.some((cat) => opts.categories!.includes(cat)),
  );
}

export function getFixtureVersion(): { version: string; label: string } {
  const b = getActiveBenchmark();
  return { version: b.version, label: b.label };
}
