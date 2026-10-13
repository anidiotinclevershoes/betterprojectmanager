import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { extractProjectChangesWithLuna } from "@/lib/shared-organise/extract";
import { sharedOrganiseTrialAllowed } from "@/lib/shared-organise/trial-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const SOURCE_LIMIT = 4_000;
const BLOCK_LIMIT = 24_000;

function publicError(detail: string) {
  return detail.replace(/sk-[A-Za-z0-9_-]+/g, "sk-redacted").slice(0, 180);
}

/**
 * One Luna call for the paired prompt trial. Does not write project truth
 * and does not change which prompt Capture uses.
 */
export async function POST(request: Request) {
  if (!sharedOrganiseTrialAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const gate = await requireAiCaller("capture");
  if (!gate.ok) return gate.response;

  let body: { version?: unknown; source?: unknown; projectBlock?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  const version = body.version === "v5" ? "v5" : body.version === "v4" ? "v4" : null;
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const projectBlock = typeof body.projectBlock === "string" ? body.projectBlock : "";
  if (!version || !source || !projectBlock) {
    return NextResponse.json({ error: "version, source, and projectBlock are required." }, { status: 400 });
  }
  if (source.length > SOURCE_LIMIT || projectBlock.length > BLOCK_LIMIT) {
    return NextResponse.json({ error: "Trial input is too long." }, { status: 400 });
  }

  const started = Date.now();
  try {
    const extracted = await extractProjectChangesWithLuna({
      transcript: source,
      projectBlock,
      prompt: version,
    });
    return NextResponse.json({
      ok: true,
      json: extracted.rawModelJson,
      promptVersion: extracted.promptVersion,
      model: extracted.responseModel,
      promptTokens: extracted.providerUsage?.prompt_tokens ?? null,
      completionTokens: extracted.providerUsage?.completion_tokens ?? null,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trial call failed";
    const status = message.includes("401") || message.includes("Incorrect API key") ? 401 : 502;
    return NextResponse.json({ error: publicError(message) }, { status });
  }
}
