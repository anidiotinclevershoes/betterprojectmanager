"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RunComparison } from "@/lib/evals/types";
import { EVAL_DIMENSION_LABELS, EVAL_DIMENSIONS } from "@/lib/evals/types";

type SlimRun = { id: string; label: string; createdAt: string };

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export function EvalsCompareClient() {
  const search = useSearchParams();
  const [runs, setRuns] = useState<SlimRun[]>([]);
  const [a, setA] = useState(search.get("a") ?? "");
  const [b, setB] = useState(search.get("b") ?? "");
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [regressionsOnly, setRegressionsOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/evals/runs")
      .then((r) => r.json())
      .then((data: { runs: SlimRun[] }) => setRuns(data.runs ?? []));
  }, []);

  async function loadCompare() {
    if (!a || !b) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/evals/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
      );
      const data = (await res.json()) as {
        comparison?: RunComparison;
        error?: string;
      };
      if (!res.ok || !data.comparison) {
        setError(data.error || "Compare failed");
        setComparison(null);
        return;
      }
      setComparison(data.comparison);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (search.get("a") && search.get("b")) {
      void loadCompare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!comparison) return [];
    return regressionsOnly ? comparison.regressions : comparison.cases;
  }, [comparison, regressionsOnly]);

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <h2>Side-by-side run comparison</h2>
        <p className="evals-meta">
          Run A is the older/baseline reference; Run B is the newer candidate.
          Deltas are B − A.
        </p>
        <div className="evals-compare-pick">
          <label className="field">
            Run A
            <select value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">Select…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({new Date(r.createdAt).toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Run B
            <select value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">Select…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({new Date(r.createdAt).toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={!a || !b || loading || a === b}
            onClick={() => void loadCompare()}
          >
            {loading ? "Loading…" : "Compare"}
          </button>
        </div>
        {error ? <p className="error-copy">{error}</p> : null}
      </section>

      {comparison ? (
        <>
          <section className="evals-panel">
            <h3>Overall</h3>
            <div className="evals-compare-summary">
              <div>
                <h4>
                  <Link href={`/evals/runs/${comparison.runA.id}`}>
                    A · {comparison.runA.label}
                  </Link>
                </h4>
                <p>
                  Pass {comparison.runA.summary.lumePass}/
                  {comparison.runA.summary.totalCases}
                </p>
                <p>Trust {comparison.runA.summary.trustFailures}</p>
                <p>
                  Critical{" "}
                  {comparison.runA.summary.criticalIntelligenceFailures}
                </p>
              </div>
              <div>
                <h4>
                  <Link href={`/evals/runs/${comparison.runB.id}`}>
                    B · {comparison.runB.label}
                  </Link>
                </h4>
                <p>
                  Pass {comparison.runB.summary.lumePass}/
                  {comparison.runB.summary.totalCases}
                </p>
                <p>Trust {comparison.runB.summary.trustFailures}</p>
                <p>
                  Critical{" "}
                  {comparison.runB.summary.criticalIntelligenceFailures}
                </p>
              </div>
              <div>
                <h4>Δ (B − A)</h4>
                <p>Pass {fmtDelta(comparison.summaryDeltas.lumePassDelta)}</p>
                <p>
                  Trust {fmtDelta(comparison.summaryDeltas.trustFailuresDelta)}{" "}
                  {comparison.summaryDeltas.trustFailuresDelta < 0
                    ? "(resolved)"
                    : comparison.summaryDeltas.trustFailuresDelta > 0
                      ? "(worse)"
                      : ""}
                </p>
                <p>
                  Critical{" "}
                  {fmtDelta(comparison.summaryDeltas.criticalFailuresDelta)}
                </p>
                <p>
                  Lume wins {fmtDelta(comparison.summaryDeltas.lumeWinsDelta)}
                </p>
              </div>
            </div>

            <h4>Dimensions</h4>
            <div className="evals-table-wrap">
              <table className="evals-table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Run A</th>
                    <th>Run B</th>
                    <th>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {EVAL_DIMENSIONS.map((dim) => {
                    const av = comparison.runA.summary.dimensionAverages[dim];
                    const bv = comparison.runB.summary.dimensionAverages[dim];
                    const d = comparison.summaryDeltas.dimensionDeltas[dim];
                    if (av == null && bv == null) return null;
                    return (
                      <tr key={dim}>
                        <td>{EVAL_DIMENSION_LABELS[dim]}</td>
                        <td>{pct(av)}</td>
                        <td>{pct(bv)}</td>
                        <td className={d != null && d < 0 ? "is-bad" : ""}>
                          {d == null ? "—" : fmtDelta(Math.round(d * 100))}
                          {d != null ? " pp" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="evals-meta">
              Regressions: {comparison.regressions.length} · Improvements:{" "}
              {comparison.improvements.length}
            </p>
            <label className="evals-check">
              <input
                type="checkbox"
                checked={regressionsOnly}
                onChange={(e) => setRegressionsOnly(e.target.checked)}
              />
              Regressions only
            </label>
          </section>

          {rows.map((row) => (
            <section
              key={row.caseId}
              className={`evals-panel evals-case ${
                row.classification.some((c) => c.includes("regressed") || c.includes("introduced") || c.includes("passed_to_failed"))
                  ? "has-hard-fail"
                  : ""
              }`}
            >
              <div className="evals-case-head">
                <div>
                  <p className="evals-kicker">{row.caseId}</p>
                  <h3>
                    <Link href={`/evals/cases/${row.caseId}`}>{row.question}</Link>
                  </h3>
                  <p className="evals-meta">
                    {row.classification.join(" · ")}
                  </p>
                </div>
              </div>
              <div className="evals-answer-grid">
                <div className="evals-answer">
                  <h4>Run A — Lume</h4>
                  <p className="evals-meta">
                    {row.runA?.automatedBand ?? "—"}
                    {row.runA?.hardFailures?.length
                      ? ` · ${row.runA.hardFailures.join(", ")}`
                      : ""}
                  </p>
                  <div className="evals-answer-body">
                    {row.runA?.lume.answer || "—"}
                  </div>
                </div>
                <div className="evals-answer">
                  <h4>Run B — Lume</h4>
                  <p className="evals-meta">
                    {row.runB?.automatedBand ?? "—"}
                    {row.runB?.hardFailures?.length
                      ? ` · ${row.runB.hardFailures.join(", ")}`
                      : ""}
                  </p>
                  <div className="evals-answer-body">
                    {row.runB?.lume.answer || "—"}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}

function fmtDelta(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}
