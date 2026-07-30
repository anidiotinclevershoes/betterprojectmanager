"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaptureRunMetrics, CompositionSlice } from "@/lib/dev/cockpit/types";

function fmtTokens(n: number | null | undefined) {
  if (n == null) return "Unavailable";
  return n.toLocaleString();
}

function fmtSeconds(ms: number | null | undefined) {
  if (ms == null) return "Unavailable";
  return `${(ms / 1000).toFixed(1)} s`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function isToday(iso: string) {
  return dayKey(iso) === new Date().toISOString().slice(0, 10);
}

function delta(current: number, previous: number | null) {
  if (previous == null) return null;
  return current - previous;
}

export function AiCockpitClient() {
  const [runs, setRuns] = useState<CaptureRunMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffA, setDiffA] = useState<string>("");
  const [diffB, setDiffB] = useState<string>("");
  const [hoverRunId, setHoverRunId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/ai-cockpit")
      .then((r) => r.json())
      .then((data: { runs?: CaptureRunMetrics[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        const list = data.runs ?? [];
        setRuns(list);
        if (list[0]) setDiffA(list[0].id);
        if (list[1]) setDiffB(list[1].id);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = runs[0] ?? null;
  const previous = runs[1] ?? null;

  const todayCount = useMemo(
    () => runs.filter((r) => isToday(r.recordedAt)).length,
    [runs],
  );

  const largestPrompt = useMemo(() => {
    if (!runs.length) return null;
    return runs.reduce((max, r) =>
      r.promptTokens > max.promptTokens ? r : max,
    );
  }, [runs]);

  const avgPrompt = useMemo(() => {
    if (!runs.length) return null;
    return Math.round(
      runs.reduce((s, r) => s + r.promptTokens, 0) / runs.length,
    );
  }, [runs]);

  const avgElapsed = useMemo(() => {
    if (!runs.length) return null;
    return Math.round(
      runs.reduce((s, r) => s + r.elapsedMs, 0) / runs.length,
    );
  }, [runs]);

  const chartRuns = useMemo(() => [...runs].reverse().slice(-16), [runs]);
  const chartMax = useMemo(
    () => Math.max(1, ...chartRuns.map((r) => r.promptTokens)),
    [chartRuns],
  );

  const contextGrowth = useMemo(() => {
    if (!latest) return [];
    return latest.contextBuckets
      .filter((b) => b.tokens > 1)
      .map((b) => {
        const prev = previous?.contextBuckets.find((p) => p.id === b.id);
        return {
          id: b.id,
          label: b.label,
          current: b.tokens,
          previous: prev?.tokens ?? null,
          delta: delta(b.tokens, prev?.tokens ?? null),
        };
      });
  }, [latest, previous]);

  const contributors = useMemo(() => {
    if (!latest) return [];
    return [...latest.composition].sort((a, b) => b.tokens - a.tokens);
  }, [latest]);

  const runA = runs.find((r) => r.id === diffA) ?? null;
  const runB = runs.find((r) => r.id === diffB) ?? null;

  const timelineGroups = useMemo(() => {
    const groups: Record<string, CaptureRunMetrics[]> = {};
    for (const run of runs) {
      const key = isToday(run.recordedAt)
        ? "Today"
        : dayKey(run.recordedAt) ===
            new Date(Date.now() - 86400000).toISOString().slice(0, 10)
          ? "Yesterday"
          : dayKey(run.recordedAt);
      groups[key] = groups[key] ?? [];
      groups[key].push(run);
    }
    return Object.entries(groups);
  }, [runs]);

  if (loading) {
    return <div className="cockpit-loading">Loading measured Capture history…</div>;
  }

  if (error) {
    return <div className="cockpit-error">{error}</div>;
  }

  return (
    <div className="cockpit" data-theme-force="dark">
      <header className="cockpit-hero">
        <div>
          <p className="cockpit-kicker">Development</p>
          <h1>AI Cockpit</h1>
          <p className="cockpit-sub">
            Measured Capture health. No estimates. No projections.
          </p>
        </div>
        <div className="cockpit-hero-meta">
          <span>{runs.length} runs stored</span>
          <span>Local only</span>
        </div>
      </header>

      {/* Top row — AI Health */}
      <section className="cockpit-health">
        <HealthCard
          label="Capture Runs Today"
          value={String(todayCount)}
          hint="Measured executions"
        />
        <HealthCard
          label="Largest Prompt"
          value={
            largestPrompt
              ? `${fmtTokens(largestPrompt.promptTokens)} tokens`
              : "Unavailable"
          }
          hint={largestPrompt?.label}
        />
        <HealthCard
          label="Average Prompt Size"
          value={avgPrompt != null ? `${fmtTokens(avgPrompt)} tokens` : "Unavailable"}
          hint={`${runs.length} measured runs`}
        />
        <HealthCard
          label="Average Response Time"
          value={fmtSeconds(avgElapsed)}
          hint="Wall clock"
        />
        <HealthCard
          label="Latest Capture"
          value={
            latest
              ? `${latest.findingsCount} Findings`
              : "Unavailable"
          }
          hint={
            latest
              ? `${latest.operationsCount} Operations · ${fmtTokens(latest.promptTokens)} tokens`
              : undefined
          }
        />
      </section>

      <div className="cockpit-grid">
        {/* Prompt Composition — centrepiece */}
        <section className="cockpit-panel cockpit-panel-wide">
          <div className="cockpit-panel-head">
            <h2>Prompt Composition</h2>
            <span className="cockpit-chip">Latest · tokenizer</span>
          </div>
          {latest ? (
            <CompositionVisual composition={latest.composition} />
          ) : (
            <p className="cockpit-empty">Unavailable</p>
          )}
        </section>

        {/* Context Growth */}
        <section className="cockpit-panel">
          <div className="cockpit-panel-head">
            <h2>Context Growth</h2>
            <span className="cockpit-chip">vs previous run</span>
          </div>
          <div className="cockpit-growth">
            {contextGrowth.length === 0 ? (
              <p className="cockpit-empty">Unavailable</p>
            ) : (
              contextGrowth.map((row) => (
                <div key={row.id} className="cockpit-growth-row">
                  <div className="cockpit-growth-label">{row.label}</div>
                  <div className="cockpit-growth-nums">
                    <span>
                      <em>Current</em> {fmtTokens(row.current)}
                    </span>
                    <span>
                      <em>Previous</em>{" "}
                      {row.previous == null ? "Unavailable" : fmtTokens(row.previous)}
                    </span>
                    <span
                      className={
                        row.delta == null
                          ? ""
                          : row.delta > 0
                            ? "is-up"
                            : row.delta < 0
                              ? "is-down"
                              : ""
                      }
                    >
                      {row.delta == null
                        ? "—"
                        : row.delta > 0
                          ? `▲ +${row.delta}`
                          : row.delta < 0
                            ? `▼ ${row.delta}`
                            : "● 0"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Prompt Evolution */}
        <section className="cockpit-panel cockpit-panel-wide">
          <div className="cockpit-panel-head">
            <h2>Prompt Evolution</h2>
            <span className="cockpit-chip">Measured history</span>
          </div>
          {chartRuns.length === 0 ? (
            <p className="cockpit-empty">Unavailable</p>
          ) : (
            <div className="cockpit-chart">
              <div className="cockpit-chart-plot">
                <svg viewBox={`0 0 ${Math.max(chartRuns.length - 1, 1) * 40 + 40} 160`} preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(91,140,255,0.9)"
                    strokeWidth="3"
                    points={chartRuns
                      .map((r, i) => {
                        const x = 20 + i * 40;
                        const y = 140 - (r.promptTokens / chartMax) * 120;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                  {chartRuns.map((r, i) => {
                    const x = 20 + i * 40;
                    const y = 140 - (r.promptTokens / chartMax) * 120;
                    return (
                      <circle
                        key={r.id}
                        cx={x}
                        cy={y}
                        r={hoverRunId === r.id ? 6 : 4}
                        fill="#5B8CFF"
                        onMouseEnter={() => setHoverRunId(r.id)}
                        onMouseLeave={() => setHoverRunId(null)}
                      />
                    );
                  })}
                </svg>
              </div>
              <div className="cockpit-chart-hover">
                {hoverRunId ? (
                  (() => {
                    const r = chartRuns.find((x) => x.id === hoverRunId);
                    if (!r) return null;
                    return (
                      <>
                        <strong>{new Date(r.recordedAt).toLocaleString()}</strong>
                        <span>Prompt {fmtTokens(r.promptTokens)} tokens</span>
                        <span>
                          Completion{" "}
                          {r.completionTokens == null
                            ? "Unavailable"
                            : `${fmtTokens(r.completionTokens)} tokens`}
                        </span>
                        <span>
                          {r.findingsCount} findings · {r.operationsCount} ops
                        </span>
                      </>
                    );
                  })()
                ) : (
                  <span className="cockpit-muted">Hover a point</span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Largest Contributors */}
        <section className="cockpit-panel">
          <div className="cockpit-panel-head">
            <h2>Largest Contributors</h2>
            <span className="cockpit-chip">Latest</span>
          </div>
          <div className="cockpit-rank">
            {contributors.length === 0 ? (
              <p className="cockpit-empty">Unavailable</p>
            ) : (
              contributors.map((c) => {
                const max = contributors[0]?.tokens || 1;
                return (
                  <div key={c.id} className="cockpit-rank-row">
                    <div className="cockpit-rank-meta">
                      <span>{c.label}</span>
                      <strong>{fmtTokens(c.tokens)}</strong>
                    </div>
                    <div className="cockpit-rank-bar">
                      <i
                        style={{
                          width: `${(c.tokens / max) * 100}%`,
                          background: c.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Capture Timeline */}
      <section className="cockpit-panel">
        <div className="cockpit-panel-head">
          <h2>Capture Timeline</h2>
          <span className="cockpit-chip">Every measured run</span>
        </div>
        <div className="cockpit-timeline">
          {timelineGroups.length === 0 ? (
            <p className="cockpit-empty">Unavailable</p>
          ) : (
            timelineGroups.map(([group, list]) => (
              <div key={group} className="cockpit-day">
                <h3>{group}</h3>
                {list.map((run) => {
                  const open = expandedId === run.id;
                  return (
                    <button
                      type="button"
                      key={run.id}
                      className={`cockpit-run ${open ? "is-open" : ""}`}
                      onClick={() =>
                        setExpandedId(open ? null : run.id)
                      }
                    >
                      <div className="cockpit-run-main">
                        <strong>{run.label}</strong>
                        <span>{fmtTokens(run.promptTokens)} tokens</span>
                        <span>{run.findingsCount} Findings</span>
                        <span>{run.operationsCount} Operations</span>
                        <span>{fmtSeconds(run.elapsedMs)}</span>
                      </div>
                      {open ? (
                        <div className="cockpit-run-detail">
                          <CompositionVisual composition={run.composition} compact />
                          <div className="cockpit-run-buckets">
                            {run.contextBuckets
                              .filter((b) => b.tokens > 0)
                              .map((b) => (
                                <span key={b.id}>
                                  {b.label} · {fmtTokens(b.tokens)} · {b.recordCount} records
                                </span>
                              ))}
                          </div>
                          <div className="cockpit-run-usage">
                            <span>
                              Prompt source:{" "}
                              {run.providerPromptTokens != null
                                ? "provider usage"
                                : "tokenizer"}
                            </span>
                            <span>
                              Completion:{" "}
                              {run.completionTokens == null
                                ? "Unavailable"
                                : run.providerCompletionTokens != null
                                  ? `${fmtTokens(run.completionTokens)} (provider)`
                                  : `${fmtTokens(run.completionTokens)} (tokenizer)`}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Prompt Diff */}
      <section className="cockpit-panel">
        <div className="cockpit-panel-head">
          <h2>Prompt Diff</h2>
          <span className="cockpit-chip">Measured deltas only</span>
        </div>
        <div className="cockpit-diff-controls">
          <label>
            Newer
            <select value={diffA} onChange={(e) => setDiffA(e.target.value)}>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.recordedAt).toLocaleString()} · {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Older
            <select value={diffB} onChange={(e) => setDiffB(e.target.value)}>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.recordedAt).toLocaleString()} · {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {runA && runB ? (
          <DiffView newer={runA} older={runB} />
        ) : (
          <p className="cockpit-empty">Unavailable</p>
        )}
      </section>

      {/* Future placeholders */}
      <section className="cockpit-future">
        <details className="cockpit-future-card">
          <summary>Cost Analysis</summary>
          <p>
            <strong>Coming Soon</strong>
            <br />
            Will display real provider costs once pricing integration is available.
          </p>
        </details>
        <details className="cockpit-future-card">
          <summary>Context Utilisation</summary>
          <p>
            <strong>Coming Soon</strong>
            <br />
            Will show which context sections the AI actually referenced.
          </p>
        </details>
        <details className="cockpit-future-card">
          <summary>Prompt Evolution Insights</summary>
          <p>
            <strong>Coming Soon</strong>
            <br />
            Will explain why prompts are growing over time.
          </p>
        </details>
      </section>
    </div>
  );
}

function HealthCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="cockpit-health-card">
      <p className="cockpit-health-label">{label}</p>
      <p className="cockpit-health-value">{value}</p>
      {hint ? <p className="cockpit-health-hint">{hint}</p> : null}
    </article>
  );
}

function CompositionVisual({
  composition,
  compact,
}: {
  composition: CompositionSlice[];
  compact?: boolean;
}) {
  const total = composition.reduce((s, c) => s + c.tokens, 0) || 1;
  return (
    <div className={`cockpit-composition ${compact ? "is-compact" : ""}`}>
      <div className="cockpit-stack">
        {composition.map((slice) => (
          <div
            key={slice.id}
            className="cockpit-stack-seg"
            style={{
              width: `${(slice.tokens / total) * 100}%`,
              background: slice.color,
            }}
            title={`${slice.label}: ${slice.tokens} tokens`}
          />
        ))}
      </div>
      <ul className="cockpit-legend">
        {composition.map((slice) => (
          <li key={slice.id}>
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <strong>{slice.tokens.toLocaleString()}</strong>
            <em>{slice.percent}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffView({
  newer,
  older,
}: {
  newer: CaptureRunMetrics;
  older: CaptureRunMetrics;
}) {
  const rows: Array<{ label: string; delta: number }> = [
    {
      label: "Prompt",
      delta: newer.promptTokens - older.promptTokens,
    },
  ];
  const ids = new Set([
    ...newer.contextBuckets.map((b) => b.id),
    ...older.contextBuckets.map((b) => b.id),
  ]);
  for (const id of ids) {
    const a = newer.contextBuckets.find((b) => b.id === id);
    const b = older.contextBuckets.find((b) => b.id === id);
    const d = (a?.tokens ?? 0) - (b?.tokens ?? 0);
    if (d === 0) continue;
    rows.push({ label: a?.label ?? b?.label ?? id, delta: d });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="cockpit-diff">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`cockpit-diff-row ${row.delta > 0 ? "is-up" : "is-down"}`}
        >
          <span>{row.label}</span>
          <strong>
            {row.delta > 0 ? "+" : ""}
            {row.delta.toLocaleString()} tokens
          </strong>
        </div>
      ))}
    </div>
  );
}
