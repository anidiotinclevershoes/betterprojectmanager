import { NextResponse } from "next/server";
import {
  buildCaptureContext,
  buildCaptureContextManifest,
  logCaptureContextDiagnostic,
} from "@/lib/capture/context";
import {
  fixtureToMissionState,
  getGoldenScenario,
  listGoldenScenarios,
  presentGoldenResult,
  scoreGoldenResult,
} from "@/lib/dev/golden";
import { logPromptAssemblyDiagnostic } from "@/ai/domain";
import {
  buildCapturePromptAssembly,
  buildCaptureResultFromAi,
  isOpenAIConfigured,
  localCaptureFallback,
  tidyAndCoachWithOpenAI,
} from "@/lib/openai";
import type { CaptureInput, MissionState } from "@/lib/types";

export const runtime = "nodejs";

function denyUnlessDev() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Golden Test is only available in development." },
      { status: 404 },
    );
  }
  return null;
}

export async function GET() {
  const denied = denyUnlessDev();
  if (denied) return denied;
  return NextResponse.json({
    scenarios: listGoldenScenarios().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      available: s.available,
    })),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiConfigured: isOpenAIConfigured(),
  });
}

type Body = {
  scenarioId?: string;
  content?: string;
};

/**
 * Runs the same Capture analysis pipeline as /api/capture,
 * using an in-memory Golden fixture (never persisted).
 */
export async function POST(request: Request) {
  const denied = denyUnlessDev();
  if (denied) return denied;

  const started = Date.now();
  try {
    const body = (await request.json()) as Body;
    const scenario = getGoldenScenario(body.scenarioId || "website-refresh");
    if (!scenario || !scenario.available) {
      return NextResponse.json(
        { error: "Unknown or unavailable Golden scenario." },
        { status: 400 },
      );
    }

    const content = (body.content ?? scenario.defaultCapture).trim();
    if (!content) {
      return NextResponse.json(
        { error: "Capture content is required." },
        { status: 400 },
      );
    }

    const fixtureState = fixtureToMissionState(scenario);
    const state: MissionState = {
      projects: fixtureState.projects,
      todos: fixtureState.todos,
      meetings: fixtureState.meetings,
      releases: fixtureState.releases,
      knowledge: fixtureState.knowledge,
      timeline: fixtureState.timeline,
      recommendations: fixtureState.recommendations,
      history: fixtureState.history,
      memories: fixtureState.memories ?? [],
    };
    const projectId = scenario.project.id;
    const analysisRequestId = `golden-${Date.now().toString(36)}`;

    const input: CaptureInput = {
      content,
      projectId,
      sourceType: "note",
    };

    const captureContext = buildCaptureContext({
      projectId,
      captureText: content,
      state,
    });
    const contextManifest = buildCaptureContextManifest(
      captureContext,
      analysisRequestId,
    );
    logCaptureContextDiagnostic(contextManifest);

    const existingKnowledge =
      state.knowledge.find((k) => k.projectId === projectId) ?? null;
    const existingTimeline = state.timeline.filter(
      (t) => t.projectId === projectId,
    );
    const openTodos = state.todos
      .filter((t) => !t.done)
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        dueAt: t.dueAt,
      }));

    let promptAssembly = buildCapturePromptAssembly({
      rawText: content,
      projectId,
      sourceType: "note",
      projects: state.projects,
      existingKnowledge,
      existingTimeline,
      openTodos,
      captureContext,
    });
    logPromptAssemblyDiagnostic(promptAssembly);

    let result;
    const openaiConfigured = isOpenAIConfigured();
    let notice: string | undefined;

    if (!openaiConfigured) {
      result = localCaptureFallback(input, state);
      notice =
        "OPENAI_API_KEY not set — used local Capture fallback (same as production).";
    } else {
      const { ai, promptAssembly: assembled } = await tidyAndCoachWithOpenAI({
        rawText: content,
        projectId,
        sourceType: "note",
        projects: state.projects,
        existingKnowledge,
        existingTimeline,
        openTodos,
        captureContext,
      });
      promptAssembly = assembled;
      result = buildCaptureResultFromAi({
        rawText: content,
        projectId,
        sourceType: "note",
        ai,
      });
    }

    const enrichedManifest = {
      ...contextManifest,
      promptAssembly: {
        sections: promptAssembly.sections.map((s) => ({
          id: s.id,
          label: s.label,
          present: true,
        })),
        approximateCharacters: promptAssembly.diagnostics.approximateCharacters,
        estimatedTokens: promptAssembly.diagnostics.estimatedTokens,
        contextRecordCount: promptAssembly.diagnostics.contextRecordCount,
        dictionaryEntryCount: promptAssembly.diagnostics.dictionaryEntryCount,
      },
    };

    const presentation = presentGoldenResult(scenario, result, content);
    const score = scoreGoldenResult(scenario, result);
    const elapsedMs = Date.now() - started;

    return NextResponse.json({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      result,
      presentation,
      score,
      contextManifest: enrichedManifest,
      diagnostics: {
        promptSize: promptAssembly.diagnostics.approximateCharacters,
        estimatedTokens: promptAssembly.diagnostics.estimatedTokens,
        contextRecordCount: promptAssembly.diagnostics.contextRecordCount,
        dictionaryEntryCount: promptAssembly.diagnostics.dictionaryEntryCount,
        promptSections: promptAssembly.sections.map((s) => s.label),
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        elapsedMs,
        openaiConfigured,
        provider: result.provider,
        requestId: analysisRequestId,
      },
      // Raw prompt only when explicitly requested by the UI expand control.
      promptText: promptAssembly.text,
      notice,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Golden Test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
