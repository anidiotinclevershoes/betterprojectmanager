import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { getEvalRun } from "@/lib/evals/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);
  const { id } = await context.params;
  const run = await getEvalRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ run });
}
