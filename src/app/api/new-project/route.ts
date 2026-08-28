import { NextResponse } from "next/server";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import { isOpenAIConfigured } from "@/lib/openai";
import { requireAiCaller } from "@/lib/ai-gate";
import { publicAiFailureMessage } from "@/lib/ai-public-error";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "@/lib/new-project-v2";

export const runtime = "nodejs";

/** Same unscoped block Capture uses when there is no current project. */
const UNSCOPED_PROJECT_BLOCK =
  "Current project: (unscoped)\nAuthoritative current records:\n(none)";

type Body = {
  /** Free-form Talk / Paste narrative — the only New Project understanding path. */
  content?: string;
  sourceMode?: "talk" | "paste";
  kind?: "delivery" | "release_ops";
};

export async function POST(request: Request) {
  try {
    const gate = await requireAiCaller("new-project");
    if (!gate.ok) return gate.response;

    const body = (await request.json()) as Body;

    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { error: "Provide a Talk or Paste narrative." },
        { status: 400 },
      );
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { error: "AI is not configured for this environment." },
        { status: 503 },
      );
    }

    const sourceMode = body.sourceMode === "talk" ? "talk" : "paste";
    const extracted = await extractObservationsWithOpenAI({
      transcript: body.content,
      projectBlock: UNSCOPED_PROJECT_BLOCK,
    });
    const parsed = parseNewProjectV2Envelope(extracted.rawModelJson);
    if (parsed.envelopeMalformed) {
      const { publicMessage } = publicAiFailureMessage(
        new Error("Malformed observation envelope"),
        "Could not assemble project",
      );
      return NextResponse.json({ error: publicMessage }, { status: 500 });
    }

    const draft = draftFromProvisional({
      sourceNarrative: body.content,
      sourceMode,
      project: parsed.project,
      items: parsed.items,
    });

    return NextResponse.json({
      draft,
      provisionalItems: parsed.items,
      projectSeed: parsed.project,
      provider: "openai" as const,
      openaiConfigured: true,
      pipeline: "v2" as const,
    });
  } catch (error) {
    const { publicMessage } = publicAiFailureMessage(
      error,
      "Could not assemble project",
    );
    return NextResponse.json({ error: publicMessage }, { status: 500 });
  }
}
