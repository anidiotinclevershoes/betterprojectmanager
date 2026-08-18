"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EvalRunRecord } from "@/lib/evals/types";

type SlimRun = Pick<
  EvalRunRecord,
  | "id"
  | "createdAt"
  | "label"
  | "status"
  | "gitCommit"
  | "lumeVersion"
  | "fixtureVersion"
  | "lumeModel"
  | "summary"
> & { caseCount: number };

export function EvalsRunsClient() {
  const [runs, setRuns] = useState<SlimRun[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/evals/runs")
      .then((r) => r.json())
      .then((data: { runs: SlimRun[] }) => setRuns(data.runs ?? []));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  }

  const compareHref = useMemo(() => {
    if (selected.length !== 2) return null;
    return `/evals/compare?a=${selected[0]}&b=${selected[1]}`;
  }, [selected]);

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <h2>Run history</h2>
        <p className="evals-meta">
          Select two runs to compare. Historical runs are never deleted by
          default.
        </p>
        {compareHref ? (
          <p>
            <Link className="primary-btn" href={compareHref}>
              Compare selected runs
            </Link>
          </p>
        ) : (
          <p className="evals-meta">Select exactly two runs for comparison.</p>
        )}
        <div className="evals-table-wrap">
          <table className="evals-table">
            <thead>
              <tr>
                <th />
                <th>Label</th>
                <th>When</th>
                <th>Commit / version</th>
                <th>Fixture</th>
                <th>Pass</th>
                <th>Trust</th>
                <th>Critical</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.label}`}
                    />
                  </td>
                  <td>
                    <Link href={`/evals/runs/${r.id}`}>{r.label}</Link>
                    <div className="evals-meta">{r.status}</div>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    {r.lumeVersion ?? "—"}
                    <div className="evals-meta">
                      {(r.gitCommit ?? "").slice(0, 7) || "—"} ·{" "}
                      {r.lumeModel ?? "—"}
                    </div>
                  </td>
                  <td>{r.fixtureVersion}</td>
                  <td>
                    {r.summary.lumePass}/{r.summary.totalCases}
                  </td>
                  <td className={r.summary.trustFailures ? "is-bad" : ""}>
                    {r.summary.trustFailures}
                  </td>
                  <td
                    className={
                      r.summary.criticalIntelligenceFailures ? "is-bad" : ""
                    }
                  >
                    {r.summary.criticalIntelligenceFailures}
                  </td>
                  <td>
                    <Link href={`/evals/runs/${r.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
