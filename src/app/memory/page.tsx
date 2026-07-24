"use client";

import { useMemo, useState, type FormEvent } from "react";
import { answerMemoryQuestion, searchMemory } from "@/lib/coach";
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

  const results = useMemo(
    () => searchMemory(state, query),
    [state, query],
  );

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
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        Institutional memory
      </p>
      <h1 className="brand-mark mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
        Remember what the project forgets
      </h1>
      <p className="coach-voice mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
        Conversations, decisions, risks, stakeholder preferences, release
        history and lessons learned — still answerable months later.
      </p>

      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAnswer(null);
          }}
          placeholder="Ask your second brain…"
          className="w-full flex-1 rounded-md border border-line bg-paper px-4 py-3 text-[15px] outline-none ring-teal/30 focus:ring-2"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper"
        >
          Ask
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="rounded-md border border-line bg-mist/50 px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-teal hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>

      {answer ? (
        <section className="mt-10 border-t border-line pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">
            Answer from memory
          </p>
          <p className="coach-voice mt-4 max-w-3xl text-xl leading-relaxed text-ink">
            {answer.answer}
          </p>
        </section>
      ) : null}

      <section className="mt-12 border-t border-line pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
          {results.length} memories
        </p>
        <div className="mt-6 space-y-0 divide-y divide-line">
          {results.map((memory) => (
            <MemoryRow key={memory.id} memory={memory} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MemoryRow({ memory }: { memory: MemoryEntry }) {
  return (
    <article className="py-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        <span className="rounded bg-mist-deep px-2 py-1 text-ink">
          {memory.type.replaceAll("_", " ")}
        </span>
        <span>
          {new Date(memory.occurredAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        {memory.people?.length ? <span>· {memory.people.join(", ")}</span> : null}
      </div>
      <h2 className="brand-mark mt-2 text-xl font-bold">{memory.title}</h2>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-soft">
        {memory.content}
      </p>
      {memory.tags.length > 0 ? (
        <p className="mt-3 text-xs text-teal">{memory.tags.join(" · ")}</p>
      ) : null}
    </article>
  );
}
