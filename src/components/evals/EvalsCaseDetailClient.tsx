"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EvalCaseFixture, EvalRunRecord } from "@/lib/evals/types";

export function EvalsCaseDetailClient() {
  const params = useParams();
  const caseId = String(params.caseId ?? "");
  const [fixture, setFixture] = useState<EvalCaseFixture | null>(null);
  const [worldName, setWorldName] = useState("");
  const [history, setHistory] = useState<
    Array<{
      runId: string;
      label: string;
      createdAt: string;
      case: EvalRunRecord["cases"][number];
    }>
  >([]);

  useEffect(() => {
    void fetch("/api/evals/fixtures")
      .then((r) => r.json())
      .then(
        (data: {
          active?: {
            worlds: Array<{
              id: string;
              name: string;
              cases: EvalCaseFixture[];
            }>;
          };
        }) => {
          for (const w of data.active?.worlds ?? []) {
            const c = w.cases.find((x) => x.id === caseId);
            if (c) {
              setFixture(c);
              setWorldName(w.name);
              break;
            }
          }
        },
      );

    void fetch("/api/evals/runs")
      .then((r) => r.json())
      .then(async (data: { runs: Array<{ id: string }> }) => {
        const out: typeof history = [];
        for (const slim of (data.runs ?? []).slice(0, 12)) {
          const res = await fetch(`/api/evals/runs/${slim.id}`);
          if (!res.ok) continue;
          const body = (await res.json()) as { run: EvalRunRecord };
          const hit = body.run.cases.find((c) => c.caseId === caseId);
          if (hit) {
            out.push({
              runId: body.run.id,
              label: body.run.label,
              createdAt: body.run.createdAt,
              case: hit,
            });
          }
        }
        setHistory(out);
      });
  }, [caseId]);

  if (!fixture) {
    return <p className="evals-meta">Loading case…</p>;
  }

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <p className="evals-kicker">{fixture.id}</p>
        <h2>{fixture.question}</h2>
        <p className="evals-meta">
          World:{" "}
          <Link href={`/evals/worlds/${fixture.worldId}`}>
            {worldName || fixture.worldId}
          </Link>
          {" · "}
          Stage: {fixture.stageId}
        </p>
        <p className="evals-meta">Categories: {fixture.categories.join(", ")}</p>
      </section>

      <section className="evals-panel">
        <h3>Expected behaviour</h3>
        {fixture.expectedAnswer ? <p>{fixture.expectedAnswer}</p> : null}
        {fixture.expectedFacts?.length ? (
          <>
            <h4>Expected facts</h4>
            <ul>
              {fixture.expectedFacts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        ) : null}
        {fixture.criticalInsight ? (
          <>
            <h4>Critical insight</h4>
            <p className="evals-critical">{fixture.criticalInsight}</p>
          </>
        ) : null}
        {fixture.forbiddenClaims?.length ? (
          <>
            <h4>Must not claim</h4>
            <ul>
              {fixture.forbiddenClaims.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        ) : null}
        {fixture.evaluatorNotes ? (
          <p className="evals-meta">Notes: {fixture.evaluatorNotes}</p>
        ) : null}
      </section>

      <section className="evals-panel">
        <h3>History for this stable test ID</h3>
        {!history.length ? (
          <p className="evals-meta">No runs contain this case yet.</p>
        ) : (
          <div className="evals-stack">
            {history.map((h) => (
              <article key={h.runId} className="evals-card">
                <p className="evals-meta">
                  <Link href={`/evals/runs/${h.runId}`}>{h.label}</Link> ·{" "}
                  {new Date(h.createdAt).toLocaleString()} · {h.case.automatedBand}
                  {h.case.hardFailures.length
                    ? ` · ${h.case.hardFailures.join(", ")}`
                    : ""}
                </p>
                <div className="evals-answer-body">{h.case.lume.answer}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
