import React from "react";
import { KnowledgeProvider, useKnowledge } from "./contexts/KnowledgeContext";
import { useScreenInit } from "./useScreenInit.js";
import {
  entities,
  positionIds,
  riskIds,
  todoIds,
  peopleIds,
  decisionIds,
  dateIds,
  waitingIds,
  timelineIds,
} from "./data/project";
import { Sidebar } from "./components/Sidebar";
import { ProjectHeader } from "./components/ProjectHeader";
import { FrameShell } from "./components/FrameShell";
import { KnowledgeItemCard } from "./components/KnowledgeItemCard";
import { Inspector } from "./components/Inspector";
import { relativeSuffix } from "./utils/dates";

function MeetingPrep() {
  const { open, currentId } = useKnowledge();
  const selected = currentId === "m-forum";
  return (
    <button
      type="button"
      onClick={() => open("m-forum")}
      className={`ocean-knowledge-item w-full rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-3 text-left transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-white/[0.04]${
        selected ? " is-selected" : ""
      }`}
    >
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Next important meeting
      </p>
      <p className="mt-2 text-[0.88rem] font-medium">Release 9 CAB readiness forum</p>
      <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">ATLAS · in 2 days</p>
      <span className="mt-2 inline-block rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[0.68rem] text-[var(--warning)]">
        Needs preparation
      </span>
    </button>
  );
}

function TimelineRow({ id, past }: { id: string; past?: boolean }) {
  const { open, currentId, dateOf, get } = useKnowledge();
  const selected = currentId === id;
  const iso = dateOf(id) as string;
  return (
    <button
      type="button"
      onClick={() => open(id)}
      className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-[0.8rem] transition-colors duration-150 ${
        selected
          ? "border-[rgba(108,140,255,0.5)] bg-[rgba(108,140,255,0.1)]"
          : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-white/[0.03]"
      }`}
    >
      <span className={past ? "text-[var(--text-secondary)]" : "font-medium"}>
        {get(id)?.name}
      </span>
      <span className="text-[var(--text-muted)]">{relativeSuffix(iso)}</span>
    </button>
  );
}

function KnowledgeCentre() {
  const { trustOf } = useKnowledge();

  const needsYouCount = Object.keys(entities).filter(
    (id) => trustOf(id) === "needs-you",
  ).length;

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-app)_92%,transparent)] px-5 py-3 backdrop-blur">
          <div />
          <div className="flex items-center gap-2 border-l border-[var(--border-subtle)] pl-2 text-[0.75rem] text-[var(--text-secondary)]">
            <span>Tom</span>
            <button
              type="button"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[0.75rem] text-[var(--text-secondary)]"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-4 pb-8">
          {/* Level 1 — the Ocean knowledge grid. Never resized by the inspector. */}
          <div className="flex min-w-0 flex-col gap-4">
              <ProjectHeader needsYouCount={needsYouCount} />

              <div className="flex flex-col gap-4">
                {/* Operational row — actionable work first */}
                <div className="grid min-h-[26rem] grid-cols-2 gap-3.5">
                  <FrameShell title="To Do" accent="todo">
                    {todoIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} showDate />
                    ))}
                  </FrameShell>

                  <FrameShell title="Risks & blockers" accent="risks">
                    {riskIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} showDot />
                    ))}
                  </FrameShell>
                </div>

                <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
                  <FrameShell title="Current position" accent="position">
                    {positionIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} />
                    ))}
                  </FrameShell>

                  <FrameShell title="People & context" accent="people">
                    {peopleIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} showPerson />
                    ))}
                  </FrameShell>

                  <FrameShell title="Dependencies" accent="deps">
                    <p className="m-0 text-[0.85rem] text-[var(--text-muted)]">
                      No structured dependencies yet.
                    </p>
                  </FrameShell>

                  <FrameShell title="Decisions" accent="decisions">
                    {decisionIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} />
                    ))}
                  </FrameShell>

                  <FrameShell title="Important dates" accent="dates">
                    {dateIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} showDate />
                    ))}
                  </FrameShell>

                  <FrameShell title="Waiting & open loops" accent="waiting">
                    {waitingIds.map((id) => (
                      <KnowledgeItemCard key={id} id={id} />
                    ))}
                  </FrameShell>

                  <FrameShell title="Meeting Prep" accent="meeting">
                    <MeetingPrep />
                  </FrameShell>

                  <FrameShell title="Timeline" accent="timeline">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded border border-[var(--border-subtle)] px-2 py-1.5 text-[0.8rem]">
                        <span className="text-[var(--text-secondary)]">Merge window closed</span>
                        <span className="text-[var(--text-muted)]">10d ago</span>
                      </div>
                      {timelineIds.map((id) => (
                        <TimelineRow key={id} id={id} />
                      ))}
                    </div>
                  </FrameShell>
                </div>
              </div>
          </div>
        </main>
      </div>

      {/* Level 2 — the contextual object inspector, layered over the workspace */}
      <Inspector />
    </div>
  );
}

export function App() {
  const screenInit = useScreenInit() as { trail?: string[]; expanded?: boolean } | undefined;
  const initialTrail = Array.isArray(screenInit?.trail) ? screenInit.trail : [];

  return (
    <KnowledgeProvider initialTrail={initialTrail} initialExpanded={!!screenInit?.expanded}>
      <KnowledgeCentre />
    </KnowledgeProvider>
  );
}

export default App;
