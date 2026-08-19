"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel } from "@/components/DashboardChrome";
import { answerMemoryQuestion, searchMemory } from "@/lib/coach";
import { formatDate } from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { MemoryEntry } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "Why did we delay Release 8?",
  "What was Finance concerned about?",
  "When did CAB approve this?",
  "What decision did we make during the roadmap workshop?",
];

export default function MemoryPage() {
  const { state } = useMission();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    memories: MemoryEntry[];
  } | null>(null);

  const results = useMemo(() => searchMemory(state, query), [state, query]);

  function ask(question: string) {
    setQuery(question);
    setAnswer(answerMemoryQuestion(state, question));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setAnswer(answerMemoryQuestion(state, query));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge"
        description="Decisions, risks, stakeholders, patterns and preferences — still answerable months later."
      />

      <Panel title="Ask your second brain" className="mb-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAnswer(null);
            }}
            placeholder="Ask a question…"
            className="w-full flex-1 rounded-lg border border-line bg-canvas/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal/30"
          />
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper"
          >
            Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="rounded-md border border-line bg-paper px-2.5 py-1 text-left text-xs text-ink-soft hover:border-teal hover:text-ink"
            >
              {q}
            </button>
          ))}
        </div>
      </Panel>

      {answer ? (
        <Panel title="Answer from memory" className="mb-5">
          <p className="coach-voice text-lg leading-relaxed text-ink">
            {answer.answer}
          </p>
        </Panel>
      ) : null}

      <Panel title={`${results.length} memories`}>
        <div className="divide-y divide-line">
          {results.map((memory) => (
            <article key={memory.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <span className="rounded bg-mist-deep px-1.5 py-0.5 text-ink">
                  {memory.type.replaceAll("_", " ")}
                </span>
                <span>{formatDate(memory.occurredAt)}</span>
              </div>
              <h2 className="brand-mark mt-2 text-lg font-bold">
                {memory.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {memory.content}
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
