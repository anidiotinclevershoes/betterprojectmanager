import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { getEvalRun } from "@/lib/evals/store";
import { compareRuns } from "@/lib/evals/compare";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);

  const url = new URL(request.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) {
    return NextResponse.json(
      { error: "Query params a and b (run ids) are required." },
      { status: 400 },
    );
  }

  const [runA, runB] = await Promise.all([getEvalRun(a), getEvalRun(b)]);
  if (!runA || !runB) {
    return NextResponse.json(
      { error: "One or both runs were not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ comparison: compareRuns(runA, runB) });
}
