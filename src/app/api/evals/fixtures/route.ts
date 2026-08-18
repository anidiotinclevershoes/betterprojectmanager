import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import {
  getActiveBenchmark,
  getBenchmark,
  getWorld,
  listBenchmarks,
  summarizeBenchmark,
} from "@/lib/evals/fixtures";

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

  const requested = url.searchParams.get("benchmarkVersion");
  const active =
    getBenchmark(requested) ?? getActiveBenchmark();

  return NextResponse.json({
    benchmarks: listBenchmarks().map((b) => summarizeBenchmark(b)),
    active,
    activeSummary: summarizeBenchmark(active),
  });
}
