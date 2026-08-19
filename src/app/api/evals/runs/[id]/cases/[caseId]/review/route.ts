import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { getEvalRun, updateEvalRun } from "@/lib/evals/store";
import { finaliseSummaryWithBaseline } from "@/lib/evals/compare";
import type { HardFailureType, ManualVerdict } from "@/lib/evals/types";

export const runtime = "nodejs";

const VERDICTS: ManualVerdict[] = [
  "pass",
  "partial",
  "fail",
  "trust_failure",
  "critical_intelligence_failure",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);
  const { id, caseId } = await context.params;
  const run = await getEvalRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    verdict?: ManualVerdict;
    notes?: string;
  };
  if (!body.verdict || !VERDICTS.includes(body.verdict)) {
    return NextResponse.json({ error: "Invalid verdict." }, { status: 400 });
  }

  const idx = run.cases.findIndex((c) => c.caseId === caseId);
  if (idx < 0) {
    return NextResponse.json({ error: "Case not found in run." }, { status: 404 });
  }

  const prev = run.cases[idx]!;
  const hardFailures: HardFailureType[] = [...prev.hardFailures];
  if (
    body.verdict === "trust_failure" &&
    !hardFailures.includes("trust_failure")
  ) {
    hardFailures.push("trust_failure");
  }
  if (
    body.verdict === "critical_intelligence_failure" &&
    !hardFailures.includes("critical_intelligence_failure")
  ) {
    hardFailures.push("critical_intelligence_failure");
  }

  const nextCases = [...run.cases];
  nextCases[idx] = {
    ...prev,
    hardFailures,
    // Model output unchanged — only annotation.
    manual: {
      verdict: body.verdict,
      notes: body.notes?.trim() || "",
      reviewedBy: access.email,
      reviewedAt: new Date().toISOString(),
    },
  };

  const updated = await updateEvalRun({
    ...run,
    cases: nextCases,
    summary: finaliseSummaryWithBaseline(nextCases),
  });

  return NextResponse.json({ run: updated, case: nextCases[idx] });
}
