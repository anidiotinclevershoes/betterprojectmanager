import { isOpenAIConfigured } from "@/lib/openai";
import { streamPmCoaching, type CoachScope } from "@/lib/pm-coach";
import type { MissionState } from "@/lib/types";
import { requireAiCaller } from "@/lib/ai-gate";
import { publicAiFailureMessage } from "@/lib/ai-public-error";
import { isProductionRuntime } from "@/lib/runtime-config";

export const runtime = "nodejs";

type Body = {
  scope: CoachScope;
  state: MissionState;
};

export async function POST(request: Request) {
  try {
    const gate = await requireAiCaller("coach");
    if (!gate.ok) return gate.response;

    if (isProductionRuntime() && !isOpenAIConfigured()) {
      return new Response(
        JSON.stringify({ error: "AI is not configured for this environment." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = (await request.json()) as Body;
    if (!body?.state || !body?.scope) {
      return new Response(JSON.stringify({ error: "Missing scope or state." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };
        try {
          send({
            type: "ready",
            openaiConfigured: isOpenAIConfigured(),
          });
          for await (const event of streamPmCoaching(
            body.state,
            body.scope,
            gate.displayName,
          )) {
            send(event);
          }
        } catch (error) {
          const { publicMessage } = publicAiFailureMessage(
            error,
            "Coach request failed",
          );
          send({ type: "error", error: publicMessage });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const { publicMessage } = publicAiFailureMessage(
      error,
      "Coach request failed",
    );
    return new Response(JSON.stringify({ error: publicMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
