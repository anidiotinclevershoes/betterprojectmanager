import { NextResponse } from "next/server";
import { isOpenAIConfigured, transcribeWithWhisper } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        error:
          "OpenAI is not configured. Add OPENAI_API_KEY to .env.local (from https://platform.openai.com/api-keys).",
      },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!audio || typeof audio === "string") {
      return NextResponse.json(
        { error: "Missing audio file field 'audio'." },
        { status: 400 },
      );
    }

    const filename =
      "name" in audio && typeof audio.name === "string" && audio.name
        ? audio.name
        : "capture.webm";

    const text = await transcribeWithWhisper(audio, filename);
    return NextResponse.json({ text, provider: "openai-whisper" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
