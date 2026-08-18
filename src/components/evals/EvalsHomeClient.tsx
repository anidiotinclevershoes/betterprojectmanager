"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EvalRunSummary } from "@/lib/evals/types";
import { EVAL_DIMENSION_LABELS, EVAL_DIMENSIONS } from "@/lib/evals/types";
import { OFFICIAL_BENCHMARK_DEFAULT_LABEL } from "@/lib/evals/fixtures/v1-benchmark";

type SlimRun = {
  id: string;
  createdAt: string;
  label: string;
  status: string;
  gitCommit: string | null;
  lumeVersion: string | null;
  fixtureVersion: string;
  lumeModel: string | null;
  summary: EvalRunSummary;
  caseCount: number;
};

type BenchmarkSummary = {
  version: string;
  label: string;
  kind: "sample" | "official";
  worldCount: number;
  caseCount: number;
};

type FixturePayload = {
  benchmarks: BenchmarkSummary[];
  active: {
    version: string;
    label: string;
    kind?: "sample" | "official";
    worlds: Array<{
      id: string;
      name: string;
      code: string;
      cases: unknown[];
    }>;
  };
};

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export function EvalsHomeClient() {
  const [runs, setRuns] = useState<SlimRun[]>([]);
  const [fixture, setFixture] = useState<FixturePayload["active"] | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [benchmarkVersion, setBenchmarkVersion] = useState(
    "lume-intelligence-benchmark-v1",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(OFFICIAL_BENCHMARK_DEFAULT_LABEL);
  const [store, setStore] = useState<string>("");

  const load = useCallback(async () => {
    const [runsRes, fixRes, accessRes] = await Promise.all([
      fetch("/api/evals/runs"),
      fetch(`/api/evals/fixtures?benchmarkVersion=${encodeURIComponent(benchmarkVersion)}`),
      fetch("/api/evals/access"),
    ]);
    if (!runsRes.ok) {
      setError("Could not load runs.");
      return;
    }
    const runsData = (await runsRes.json()) as { runs: SlimRun[] };
    setRuns(runsData.runs);
    if (fixRes.ok) {
      const fixData = (await fixRes.json()) as FixturePayload;
      setFixture(fixData.active);
      setBenchmarks(fixData.benchmarks ?? []);
    }
    if (accessRes.ok) {
      const a = (await accessRes.json()) as { store?: string };
      setStore(a.store ?? "");
    }
  }, [benchmarkVersion]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = runs[0] ?? null;
  const previous = runs[1] ?? null;

  const deltaTrust = useMemo(() => {
    if (!latest || !previous) return null;
    return latest.summary.trustFailures - previous.summary.trustFailures;
  }, [latest, previous]);

  async function startRun() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/evals/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          benchmarkVersion,
        }),
      });
      const data = (await res.json()) as { run?: { id: string }; error?: string };
      if (!res.ok || !data.run) {
        setError(data.error || "Run failed");
        return;
      }
      window.location.href = `/evals/runs/${data.run.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const caseCount =
    fixture?.worlds.reduce((n, w) => n + w.cases.length, 0) ?? 0;
  const selectedMeta = benchmarks.find((b) => b.version === benchmarkVersion);

  return (
    <div className="evals-home">
      <section className="evals-panel">
        <h2>Did Lume get better?</h2>
        {latest ? (
          <div className="evals-health-grid">
            <div className="evals-stat">
              <p className="evals-stat-label">Latest Lume pass</p>
              <p className="evals-stat-value">
                {latest.summary.lumePass}/{latest.summary.totalCases}
              </p>
            </div>
            <div className="evals-stat">
              <p className="evals-stat-label">GPT baseline pass</p>
              <p className="evals-stat-value">
                {latest.summary.baselinePass}/{latest.summary.totalCases}
              </p>
            </div>
            <div className="evals-stat">
              <p className="evals-stat-label">Lume / GPT / ties</p>
              <p className="evals-stat-value">
                {latest.summary.lumeWins} / {latest.summary.gptWins} /{" "}
                {latest.summary.ties}
              </p>
            </div>
            <div className="evals-stat is-danger">
              <p className="evals-stat-label">Trust failures</p>
              <p className="evals-stat-value">{latest.summary.trustFailures}</p>
            </div>
            <div className="evals-stat is-danger">
              <p className="evals-stat-label">Critical intelligence failures</p>
              <p className="evals-stat-value">
                {latest.summary.criticalIntelligenceFailures}
              </p>
            </div>
            <div className="evals-stat">
              <p className="evals-stat-label">vs previous trust Δ</p>
              <p className="evals-stat-value">
                {deltaTrust == null ? "—" : deltaTrust > 0 ? `+${deltaTrust}` : deltaTrust}
              </p>
            </div>
          </div>
        ) : (
          <p className="evals-empty">
            No runs yet. Run the V1 Intelligence Benchmark below (label{" "}
            <code>Pre-Intelligence-Changes v1</code>).
          </p>
        )}

        {latest ? (
          <div className="evals-dim-row">
            {EVAL_DIMENSIONS.map((dim) => {
              const v = latest.summary.dimensionAverages[dim];
              if (v == null) return null;
              return (
                <div key={dim} className="evals-dim-chip">
                  <span>{EVAL_DIMENSION_LABELS[dim]}</span>
                  <strong>{pct(v)}</strong>
                </div>
              );
            })}
          </div>
        ) : null}

        {latest && previous ? (
          <p className="evals-meta">
            Latest: <Link href={`/evals/runs/${latest.id}`}>{latest.label}</Link>
            {" · "}
            <Link href={`/evals/compare?a=${previous.id}&b=${latest.id}`}>
              Compare with previous
            </Link>
          </p>
        ) : null}
      </section>

      <section className="evals-panel">
        <h2>Run benchmark</h2>
        <p className="evals-meta">
          Selected: <strong>{fixture?.label ?? "…"}</strong> (
          {fixture?.version}) · kind: {selectedMeta?.kind ?? fixture?.kind ?? "…"}{" "}
          · {fixture?.worlds.length ?? 0} world(s) · {caseCount} case(s) · store:{" "}
          {store || "…"}
        </p>
        <div className="evals-run-form">
          <label className="field">
            Suite
            <select
              value={benchmarkVersion}
              onChange={(e) => {
                const next = e.target.value;
                setBenchmarkVersion(next);
                if (next === "lume-intelligence-benchmark-v1") {
                  setLabel(OFFICIAL_BENCHMARK_DEFAULT_LABEL);
                } else if (next.startsWith("sample-")) {
                  setLabel("Harness sample regression");
                }
              }}
              disabled={busy}
            >
              {benchmarks.map((b) => (
                <option key={b.version} value={b.version}>
                  {b.kind === "official" ? "Official — " : "Sample — "}
                  {b.label} ({b.caseCount} cases)
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Run label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={OFFICIAL_BENCHMARK_DEFAULT_LABEL}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void startRun()}
          >
            {busy ? "Running… please wait" : "Run benchmark"}
          </button>
        </div>
        {error ? <p className="error-copy">{error}</p> : null}
        <p className="evals-meta">
          Official V1 scores must not include the harness sample. Each run is
          immutable.
        </p>
      </section>

      <section className="evals-panel">
        <h2>Recent runs</h2>
        <div className="evals-table-wrap">
          <table className="evals-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>When</th>
                <th>Fixture</th>
                <th>Pass</th>
                <th>Trust</th>
                <th>Critical</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/evals/runs/${r.id}`}>{r.label}</Link>
                    <div className="evals-meta">{r.status}</div>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="evals-meta">{r.fixtureVersion}</div>
                    <div className="evals-meta">
                      {(r.gitCommit ?? "").slice(0, 7) || "no commit"}
                    </div>
                  </td>
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
