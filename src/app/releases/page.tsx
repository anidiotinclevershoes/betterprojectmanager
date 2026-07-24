"use client";

import { getPlaybookStage } from "@/lib/release-playbook";
import { useMission } from "@/lib/store";

const STATUS_LABEL = {
  complete: "Complete",
  current: "Current",
  upcoming: "Upcoming",
  blocked: "Blocked",
  at_risk: "At risk",
} as const;

export default function ReleasesPage() {
  const { state } = useMission();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        Release playbook
      </p>
      <h1 className="brand-mark mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
        Guide the monthly release with calm authority
      </h1>
      <p className="coach-voice mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
        Merge window through hypercare and closure — with artefacts, risks and
        the questions an exceptional Programme Manager asks at each stage.
      </p>

      <div className="mt-12 space-y-16">
        {state.releases.map((release) => {
          const project = state.projects.find((p) => p.id === release.projectId);
          const current = getPlaybookStage(release.currentStage);
          return (
            <section key={release.id}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                    {project?.code} · Target{" "}
                    {new Date(release.targetDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <h2 className="brand-mark mt-2 text-3xl font-bold">
                    {release.name}
                  </h2>
                </div>
                <p className="text-sm text-signal">
                  Current focus: {current?.label}
                </p>
              </div>

              {current ? (
                <div className="mt-6 max-w-3xl border-l-2 border-signal pl-4">
                  <p className="coach-voice text-lg leading-relaxed text-ink">
                    {current.coachingFocus}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                    {current.leadershipQuestions.map((q) => (
                      <li key={q}>• {q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {release.risks.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    Active release risks
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-ink">
                    {release.risks.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <ol className="mt-10 space-y-0">
                {release.stages.map((stage, index) => {
                  const def = getPlaybookStage(stage.stage);
                  const active =
                    stage.status === "current" ||
                    stage.status === "at_risk" ||
                    stage.status === "blocked";
                  return (
                    <li
                      key={stage.stage}
                      className={`border-t border-line py-5 ${active ? "bg-mist/50" : ""}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-3">
                          <span className="text-xs text-ink-soft">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="brand-mark text-xl font-bold">
                            {stage.label}
                          </h3>
                        </div>
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                            stage.status === "at_risk" ||
                            stage.status === "blocked"
                              ? "text-signal"
                              : stage.status === "current"
                                ? "text-teal"
                                : "text-ink-soft"
                          }`}
                        >
                          {STATUS_LABEL[stage.status]}
                        </span>
                      </div>
                      {stage.notes ? (
                        <p className="mt-2 text-sm text-ink-soft">{stage.notes}</p>
                      ) : null}
                      {stage.missingArtefacts?.length ? (
                        <p className="mt-2 text-sm text-signal">
                          Missing: {stage.missingArtefacts.join(", ")}
                        </p>
                      ) : null}
                      {active && def ? (
                        <p className="mt-2 text-sm text-ink">
                          Typical artefacts: {def.typicalArtefacts.join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
