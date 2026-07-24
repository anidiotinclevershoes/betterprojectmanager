"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/DashboardChrome";
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
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Capture"
        title="Tell me what changed"
        description="Drop a conversation, voice note or meeting scrap. I analyse it immediately for risks, waits, decisions and leadership moves."
      />

      <Panel title="New capture">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              What happened?
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              placeholder="e.g. Elena said the payments pipeline failed two builds this morning. Marcus still hasn't confirmed hypercare cover."
              className="mt-2 w-full resize-y rounded-lg border border-line bg-canvas/40 px-3 py-2.5 text-sm leading-relaxed outline-none ring-teal/30 placeholder:text-ink-soft/50 focus:ring-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Project
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/30"
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
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
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/30"
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
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper"
          >
            Analyse and coach me
          </button>
        </form>
      </Panel>

      {result ? (
        <Panel title={`Filed: ${result.memory.title}`} className="mt-5">
          <ul className="space-y-1.5 text-sm text-ink">
            {result.insights.map((insight) => (
              <li key={insight}>• {insight}</li>
            ))}
          </ul>
          {result.assumptions.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Assumptions
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-2">
            {result.recommendations.map((rec) => (
              <RecommendationItem
                key={rec.id}
                recommendation={rec}
                compact
                onDone={() => setRecommendationStatus(rec.id, "done")}
                onDismiss={() => setRecommendationStatus(rec.id, "dismissed")}
              />
            ))}
          </div>
          <Link
            href={projectId ? `/projects/${projectId}` : "/"}
            className="mt-2 inline-block text-sm font-medium text-teal hover:underline"
          >
            Back to dashboard →
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
