"use client";

import Link from "next/link";
import { RecommendationItem } from "@/components/RecommendationItem";
import { useMission } from "@/lib/store";
import { MISSION_TAGLINE } from "@/lib/mission";

const URGENCY_ORDER = { now: 0, today: 1, this_week: 2, watch: 3 } as const;

export default function TodayPage() {
  const { state, setRecommendationStatus, hydrated } = useMission();

  const active = state.recommendations
    .filter((r) => r.status === "active")
    .sort(
      (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency],
    );

  const nextMeeting = [...state.meetings]
    .filter((m) => m.phase === "upcoming")
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];

  const atRiskRelease = state.releases.find((r) =>
    r.stages.some((s) => s.status === "at_risk" || s.status === "blocked"),
  );

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 animate-pulse-soft rounded-full bg-teal/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-signal/15 blur-3xl" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-5 py-16 md:px-8 md:py-24">
          <p className="animate-rise text-xs font-semibold uppercase tracking-[0.22em] text-teal">
            AI Chief Project Officer
          </p>
          <h1 className="brand-mark animate-rise-delay-1 mt-4 max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-tight text-ink md:text-7xl lg:text-8xl">
            Mission Control
          </h1>
          <div className="animate-draw mt-6 h-px w-40 bg-signal" />
          <p className="coach-voice animate-rise-delay-2 mt-8 max-w-2xl text-2xl leading-snug text-ink md:text-3xl">
            Walk in prepared.
          </p>
          <p className="animate-rise-delay-2 mt-4 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
            {MISSION_TAGLINE}
          </p>
          <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
            <a
              href="#brief"
              className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink/90"
            >
              Open today&apos;s brief
            </a>
            <Link
              href="/capture"
              className="rounded-md border border-ink/20 bg-paper/60 px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/40"
            >
              Capture something new
            </Link>
          </div>
        </div>
      </section>

      <section id="brief" className="border-t border-line bg-paper/80">
        <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
              Today&apos;s brief
            </p>
            <h2 className="brand-mark mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              How to look calm, prepared, proactive and trusted today
            </h2>
            <p className="mt-3 text-ink-soft">
              Not a task list — coaching moves an exceptional Programme Manager
              would make next.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              {!hydrated ? (
                <p className="text-ink-soft">Loading operational memory…</p>
              ) : active.length === 0 ? (
                <p className="coach-voice text-xl text-ink-soft">
                  No active coaching moves. Capture a note, meeting or risk and
                  I will analyse what changed.
                </p>
              ) : (
                active.map((rec) => (
                  <RecommendationItem
                    key={rec.id}
                    recommendation={rec}
                    onDone={() => setRecommendationStatus(rec.id, "done")}
                    onDismiss={() =>
                      setRecommendationStatus(rec.id, "dismissed")
                    }
                  />
                ))
              )}
            </div>

            <aside className="space-y-8 lg:border-l lg:border-line lg:pl-8">
              {nextMeeting ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                    Next meeting to lead
                  </p>
                  <h3 className="brand-mark mt-2 text-xl font-bold">
                    {nextMeeting.title}
                  </h3>
                  <p className="mt-2 text-sm text-ink-soft">
                    {new Date(nextMeeting.startsAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="coach-voice mt-3 text-[15px] leading-relaxed text-ink">
                    {nextMeeting.prep.openingScript}
                  </p>
                  <Link
                    href={`/meetings/${nextMeeting.id}`}
                    className="mt-4 inline-block text-sm font-medium text-teal underline-offset-4 hover:underline"
                  >
                    Open meeting strategy →
                  </Link>
                </div>
              ) : null}

              {atRiskRelease ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                    Release watch
                  </p>
                  <h3 className="brand-mark mt-2 text-xl font-bold">
                    {atRiskRelease.name}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                    {atRiskRelease.risks.map((risk) => (
                      <li key={risk}>• {risk}</li>
                    ))}
                  </ul>
                  <Link
                    href="/releases"
                    className="mt-4 inline-block text-sm font-medium text-teal underline-offset-4 hover:underline"
                  >
                    Guide me through the playbook →
                  </Link>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  Projects in view
                </p>
                <ul className="mt-3 space-y-3">
                  {state.projects.map((p) => (
                    <li key={p.id}>
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-sm text-ink-soft">{p.currentFocus}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
