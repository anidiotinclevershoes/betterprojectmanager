"use client";

import { PageHeader, Panel } from "@/components/DashboardChrome";
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
    <div>
      <PageHeader
        eyebrow="Releases"
        title="Release playbook"
        description="Monthly lifecycle coaching from merge window through hypercare and closure."
      />

      <div className="space-y-6">
        {state.releases.map((release) => {
          const project = state.projects.find((p) => p.id === release.projectId);
          const current = getPlaybookStage(release.currentStage);
          return (
            <Panel
              key={release.id}
              title={`${project?.code ?? "Project"} · ${release.name}`}
              action={
                <span className="text-xs text-signal">
                  Focus: {current?.label}
                </span>
              }
            >
              {current ? (
                <div className="mb-5 border-l-2 border-signal pl-3">
                  <p className="coach-voice text-base leading-relaxed text-ink">
                    {current.coachingFocus}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                    {current.leadershipQuestions.map((q) => (
                      <li key={q}>• {q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {release.risks.length > 0 ? (
                <div className="mb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    Active risks
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-ink">
                    {release.risks.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <ol className="divide-y divide-line border-t border-line">
                {release.stages.map((stage, index) => {
                  const def = getPlaybookStage(stage.stage);
                  const active =
                    stage.status === "current" ||
                    stage.status === "at_risk" ||
                    stage.status === "blocked";
                  return (
                    <li
                      key={stage.stage}
                      className={`py-3 ${active ? "bg-mist/40 -mx-2 rounded-md px-2" : ""}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-ink-soft">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-semibold text-ink">
                            {stage.label}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
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
                        <p className="mt-1 text-sm text-ink-soft">
                          {stage.notes}
                        </p>
                      ) : null}
                      {stage.missingArtefacts?.length ? (
                        <p className="mt-1 text-sm text-signal">
                          Missing: {stage.missingArtefacts.join(", ")}
                        </p>
                      ) : null}
                      {active && def ? (
                        <p className="mt-1 text-xs text-ink-soft">
                          Artefacts: {def.typicalArtefacts.join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
