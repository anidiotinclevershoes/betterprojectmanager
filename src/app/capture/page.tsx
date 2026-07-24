"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { RecommendationItem } from "@/components/RecommendationItem";
import { useMission } from "@/lib/store";
import type { CaptureResult } from "@/lib/types";

export default function CapturePage() {
  const { state, capture, setRecommendationStatus } = useMission();
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? "");
  const [sourceType, setSourceType] = useState<
    "note" | "voice_note" | "conversation" | "meeting_note"
  >("conversation");
  const [result, setResult] = useState<CaptureResult | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const next = capture({
      content,
      projectId: projectId || undefined,
      sourceType,
    });
    setResult(next);
    setContent("");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        Capture
      </p>
      <h1 className="brand-mark mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
        Tell me what changed
      </h1>
      <p className="coach-voice mt-4 text-xl leading-relaxed text-ink-soft">
        Drop a conversation, voice note, meeting scrap or half-formed worry. I
        will analyse it immediately — risks, waits, decisions, conversations you
        should have.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
            What happened?
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="e.g. Elena said the payments pipeline failed two builds this morning. Marcus still hasn't confirmed hypercare cover. Priya will ask about billing regression at CAB."
            className="mt-2 w-full resize-y rounded-md border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-teal/30 placeholder:text-ink-soft/50 focus:ring-2"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Project
            </span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="">Unlinked</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Source
            </span>
            <select
              value={sourceType}
              onChange={(e) =>
                setSourceType(
                  e.target.value as
                    | "note"
                    | "voice_note"
                    | "conversation"
                    | "meeting_note",
                )
              }
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="conversation">Conversation</option>
              <option value="meeting_note">Meeting note</option>
              <option value="voice_note">Voice note</option>
              <option value="note">Note</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink/90"
        >
          Analyse and coach me
        </button>
      </form>

      {result ? (
        <section className="mt-14 border-t border-line pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
            Immediate analysis
          </p>
          <h2 className="brand-mark mt-2 text-2xl font-bold">
            Filed to memory: {result.memory.title}
          </h2>

          <ul className="mt-5 space-y-2">
            {result.insights.map((insight) => (
              <li key={insight} className="text-sm leading-relaxed text-ink">
                • {insight}
              </li>
            ))}
          </ul>

          {result.assumptions.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Assumptions (not blockers)
              </p>
              <ul className="mt-2 space-y-2">
                {result.assumptions.map((a) => (
                  <li
                    key={a}
                    className="coach-voice text-[15px] leading-relaxed text-ink-soft"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            {result.recommendations.map((rec) => (
              <RecommendationItem
                key={rec.id}
                recommendation={rec}
                onDone={() => setRecommendationStatus(rec.id, "done")}
                onDismiss={() => setRecommendationStatus(rec.id, "dismissed")}
              />
            ))}
          </div>

          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-teal underline-offset-4 hover:underline"
          >
            See full brief →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
