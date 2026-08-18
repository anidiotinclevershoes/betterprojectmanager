/**
 * Official Lume Intelligence Benchmark v1.
 * Separate from harness sample worlds — do not mix scores.
 */
import type { EvalBenchmarkManifest } from "@/lib/evals/types";
import { WORLD_A_MERIDIAN } from "@/lib/evals/fixtures/v1-world-a-meridian";
import { WORLD_B_NORTHLINE } from "@/lib/evals/fixtures/v1-world-b-northline";
import { WORLD_C_HARBOR } from "@/lib/evals/fixtures/v1-world-c-harbor";
import { WORLD_D_CASCADE } from "@/lib/evals/fixtures/v1-world-d-cascade";
import { WORLD_E_QUIET } from "@/lib/evals/fixtures/v1-world-e-quiet";

export const V1_INTELLIGENCE_BENCHMARK: EvalBenchmarkManifest = {
  version: "lume-intelligence-benchmark-v1",
  label: "V1 Intelligence Benchmark (Pre-Intelligence-Changes baseline suite)",
  kind: "official",
  worlds: [
    WORLD_A_MERIDIAN,
    WORLD_B_NORTHLINE,
    WORLD_C_HARBOR,
    WORLD_D_CASCADE,
    WORLD_E_QUIET,
  ],
};

export const OFFICIAL_BENCHMARK_DEFAULT_LABEL = "Pre-Intelligence-Changes v1";
