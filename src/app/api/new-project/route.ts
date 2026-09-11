import { NextResponse } from "next/server";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import {
  extractProvenanceBase,
  logIntelligenceProvenance,
} from "@/lib/capture-v2/provenance";
import { NEW_PROJECT_ADAPTER_PATH } from "@/lib/capture-v2/prompt";
import { isOpenAIConfigured } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
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
  const startedAt = Date.now();
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
      logIntelligenceProvenance("new-project.openai_missing", {
        ...extractProvenanceBase(),
        path: NEW_PROJECT_ADAPTER_PATH,
        userId: gate.userId,
        provider: "none",
        requestedModel: resolveOpenAIChatModel(),
        responseModel: null,
        fallback: false,
        fallbackReason: "unconfigured_ai_no_local_fallback",
        elapsedMs: Date.now() - startedAt,
        observationCount: 0,
        usagePrompt: null,
        usageCompletion: null,
        usageTotal: null,
      });
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
      logIntelligenceProvenance("new-project.envelope_malformed", {
        ...extractProvenanceBase(),
        path: NEW_PROJECT_ADAPTER_PATH,
        userId: gate.userId,
        provider: extracted.provider,
        requestedModel: extracted.requestedModel,
        responseModel: extracted.responseModel,
        fallback: false,
        fallbackReason: null,
        elapsedMs: Date.now() - startedAt,
        observationCount: extracted.observationCount,
        usagePrompt: extracted.providerUsage?.prompt_tokens ?? null,
        usageCompletion: extracted.providerUsage?.completion_tokens ?? null,
        usageTotal: extracted.providerUsage?.total_tokens ?? null,
        envelopeMalformed: true,
      });
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

    logIntelligenceProvenance("new-project.v2_organised", {
      ...extractProvenanceBase(),
      path: NEW_PROJECT_ADAPTER_PATH,
      userId: gate.userId,
      provider: extracted.provider,
      requestedModel: extracted.requestedModel,
      responseModel: extracted.responseModel,
      fallback: false,
      fallbackReason: null,
      elapsedMs: Date.now() - startedAt,
      observationCount: extracted.observationCount,
      usagePrompt: extracted.providerUsage?.prompt_tokens ?? null,
      usageCompletion: extracted.providerUsage?.completion_tokens ?? null,
      usageTotal: extracted.providerUsage?.total_tokens ?? null,
      envelopeMalformed: false,
    });

    return NextResponse.json({
      draft,
      provisionalItems: parsed.items,
      projectSeed: parsed.project,
      provider: "openai" as const,
      openaiConfigured: true,
      pipeline: "v2" as const,
      provenance: {
        provider: extracted.provider,
        requestedModel: extracted.requestedModel,
        responseModel: extracted.responseModel,
        promptId: extracted.promptId,
        promptVersion: extracted.promptVersion,
        path: NEW_PROJECT_ADAPTER_PATH,
        fallback: false,
      },
    });
  } catch (error) {
    const { publicMessage } = publicAiFailureMessage(
      error,
      "Could not assemble project",
    );
    return NextResponse.json({ error: publicMessage }, { status: 500 });
  }
}
