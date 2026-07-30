import { NextResponse } from "next/server";
import {
  clearCockpitStore,
  ensureCockpitSeedHistory,
  isCockpitEnabled,
  readCockpitStore,
} from "@/lib/dev/cockpit";

export const runtime = "nodejs";

function deny() {
  if (!isCockpitEnabled()) {
    return NextResponse.json(
      { error: "AI Cockpit is only available in development." },
      { status: 404 },
    );
  }
  return null;
}

export async function GET() {
  const denied = deny();
  if (denied) return denied;
  const store = ensureCockpitSeedHistory();
  return NextResponse.json({
    updatedAt: store.updatedAt,
    runs: store.runs,
    metricSources: {
      promptTokens:
        "OpenAI usage.prompt_tokens when present; otherwise js-tiktoken cl100k_base on the measured prompt (+ system when measured)",
      completionTokens:
        "OpenAI usage.completion_tokens when present; otherwise js-tiktoken on the response body; otherwise Unavailable",
      composition:
        "js-tiktoken token counts of prompt sections and context buckets",
      elapsedMs: "Date.now() wall clock around Capture execution",
      findingsOperations: "Counts from validated CaptureResult findings/ops",
    },
  });
}

export async function DELETE() {
  const denied = deny();
  if (denied) return denied;
  clearCockpitStore();
  return NextResponse.json({ ok: true, store: readCockpitStore() });
}

export async function POST(request: Request) {
  const denied = deny();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  };
  if (body.action === "reseed") {
    clearCockpitStore();
    const store = ensureCockpitSeedHistory();
    return NextResponse.json({ ok: true, runs: store.runs.length });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
