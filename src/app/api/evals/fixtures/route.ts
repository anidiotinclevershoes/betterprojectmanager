import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { getActiveBenchmark, getWorld, listBenchmarks } from "@/lib/evals/fixtures";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);

  const url = new URL(request.url);
  const worldId = url.searchParams.get("worldId");
  if (worldId) {
    const world = getWorld(worldId);
    if (!world) {
      return NextResponse.json({ error: "World not found." }, { status: 404 });
    }
    return NextResponse.json({ world });
  }

  return NextResponse.json({
    benchmarks: listBenchmarks().map((b) => ({
      version: b.version,
      label: b.label,
      worldCount: b.worlds.length,
      caseCount: b.worlds.reduce((n, w) => n + w.cases.length, 0),
    })),
    active: getActiveBenchmark(),
  });
}
