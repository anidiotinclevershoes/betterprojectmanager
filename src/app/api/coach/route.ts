import { isOpenAIConfigured } from "@/lib/openai";
import { streamPmCoaching, type CoachScope } from "@/lib/pm-coach";
import type { MissionState } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  scope: CoachScope;
  state: MissionState;
};

export async function POST(request: Request) {
  try {
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
          for await (const event of streamPmCoaching(body.state, body.scope)) {
            send(event);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Coach request failed";
          send({ type: "error", error: message });
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
    const message =
      error instanceof Error ? error.message : "Coach request failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
