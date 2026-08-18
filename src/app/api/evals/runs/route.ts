import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { listEvalRuns } from "@/lib/evals/store";
import { runBenchmark } from "@/lib/evals/runner";
import type { EvalDimension } from "@/lib/evals/types";
import { EVAL_DIMENSIONS } from "@/lib/evals/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);
  const runs = await listEvalRuns(100);
  // List endpoint: strip heavy case payloads for safety/size; detail route returns full.
  const slim = runs.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    label: r.label,
    status: r.status,
    gitCommit: r.gitCommit,
    lumeVersion: r.lumeVersion,
    fixtureVersion: r.fixtureVersion,
    fixtureLabel: r.fixtureLabel,
    lumeModel: r.lumeModel,
    baselineModel: r.baselineModel,
    createdByEmail: r.createdByEmail,
    summary: r.summary,
    caseCount: r.cases.length,
  }));
  return NextResponse.json({ runs: slim });
}

export async function POST(request: Request) {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    worldIds?: string[];
    categories?: string[];
    notes?: string;
  };

  const categories = (body.categories ?? []).filter((c): c is EvalDimension =>
    (EVAL_DIMENSIONS as readonly string[]).includes(c),
  );

  try {
    const run = await runBenchmark({
      label: body.label,
      createdByEmail: access.email,
      worldIds: body.worldIds?.length ? body.worldIds : undefined,
      categories: categories.length ? categories : undefined,
      notes: body.notes,
    });
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Benchmark run failed",
      },
      { status: 500 },
    );
  }
}
