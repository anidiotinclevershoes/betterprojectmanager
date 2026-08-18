"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EvalCaseResult, EvalRunRecord, ManualVerdict } from "@/lib/evals/types";
import { EVAL_DIMENSION_LABELS } from "@/lib/evals/types";

function AnswerBlock({
  title,
  record,
}: {
  title: string;
  record: EvalCaseResult["lume"];
}) {
  return (
    <div className="evals-answer">
      <h4>{title}</h4>
      <p className="evals-meta">
        {record.provider ?? "—"} · {record.model ?? "—"} ·{" "}
        {record.confidence ?? "n/a"} ·{" "}
        {record.usage?.total_tokens != null
          ? `${record.usage.total_tokens} tokens`
          : "tokens n/a"}
        {record.durationMs != null ? ` · ${record.durationMs}ms` : ""}
      </p>
      {record.error ? <p className="error-copy">{record.error}</p> : null}
      <div className="evals-answer-body">{record.answer || "—"}</div>
      {record.sources?.length ? (
        <details>
          <summary>Sources ({record.sources.length})</summary>
          <ul>
            {record.sources.map((s) => (
              <li key={s.id}>
                <strong>{s.label}</strong>{" "}
                <span className="evals-meta">({s.kind})</span>
                {s.detail ? <div>{s.detail}</div> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function EvalsRunDetailClient() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [run, setRun] = useState<EvalRunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterHard, setFilterHard] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/evals/runs/${id}`);
    const data = (await res.json()) as { run?: EvalRunRecord; error?: string };
    if (!res.ok || !data.run) {
      setError(data.error || "Run not found");
      return;
    }
    setRun(data.run);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveReview(caseId: string, verdict: ManualVerdict, notes: string) {
    const res = await fetch(
      `/api/evals/runs/${id}/cases/${encodeURIComponent(caseId)}/review`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, notes }),
      },
    );
    if (res.ok) await load();
  }

  if (error) return <p className="error-copy">{error}</p>;
  if (!run) return <p className="evals-meta">Loading run…</p>;

  const cases = filterHard
    ? run.cases.filter((c) => c.hardFailures.length > 0)
    : run.cases;

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <p className="evals-kicker">{run.status}</p>
        <h2>{run.label}</h2>
        <p className="evals-meta">
          {new Date(run.createdAt).toLocaleString()} · by {run.createdByEmail} ·
          fixture {run.fixtureVersion} · Lume {run.lumeVersion ?? "—"} · commit{" "}
          {(run.gitCommit ?? "").slice(0, 7) || "—"}
        </p>
        <div className="evals-health-grid">
          <div className="evals-stat">
            <p className="evals-stat-label">Lume pass</p>
            <p className="evals-stat-value">
              {run.summary.lumePass}/{run.summary.totalCases}
            </p>
          </div>
          <div className="evals-stat">
            <p className="evals-stat-label">GPT pass</p>
            <p className="evals-stat-value">
              {run.summary.baselinePass}/{run.summary.totalCases}
            </p>
          </div>
          <div className="evals-stat is-danger">
            <p className="evals-stat-label">Trust failures</p>
            <p className="evals-stat-value">{run.summary.trustFailures}</p>
          </div>
          <div className="evals-stat is-danger">
            <p className="evals-stat-label">Critical failures</p>
            <p className="evals-stat-value">
              {run.summary.criticalIntelligenceFailures}
            </p>
          </div>
          <div className="evals-stat">
            <p className="evals-stat-label">Lume tokens</p>
            <p className="evals-stat-value">
              {run.summary.lumeTotalTokens ?? "—"}
            </p>
            <p className="evals-stat-note">
              {run.lumeModel ?? "—"}
              {run.summary.sameModelControl === false
                ? " · model mismatch"
                : run.summary.sameModelControl
                  ? " · same-model control"
                  : ""}
            </p>
          </div>
          <div className="evals-stat">
            <p className="evals-stat-label">GPT tokens</p>
            <p className="evals-stat-value">
              {run.summary.baselineTotalTokens ?? "—"}
            </p>
            <p className="evals-stat-note">{run.baselineModel ?? "—"}</p>
          </div>
        </div>
        {run.summary.lumeTokenBreakdown || run.summary.baselineTokenBreakdown ? (
          <p className="evals-stat-note" style={{ marginTop: "0.5rem" }}>
            {run.summary.lumeTokenBreakdown
              ? `Lume est. in — sys ${run.summary.lumeTokenBreakdown.systemInstructions ?? "—"} · now ${run.summary.lumeTokenBreakdown.knowledgeNow ?? "—"} · hist ${run.summary.lumeTokenBreakdown.history ?? "—"} · people ${run.summary.lumeTokenBreakdown.knowledgePeople ?? "—"} · risks ${run.summary.lumeTokenBreakdown.knowledgeRisks ?? "—"} · todos ${run.summary.lumeTokenBreakdown.todos ?? "—"} · decisions ${run.summary.lumeTokenBreakdown.knowledgeDecisions ?? "—"} · turns ${run.summary.lumeTokenBreakdown.conversation ?? "—"} · snap ${run.summary.lumeTokenBreakdown.snapshot ?? "—"}`
              : null}
            {run.summary.lumeTokenBreakdown &&
            run.summary.baselineTokenBreakdown
              ? " · "
              : null}
            {run.summary.baselineTokenBreakdown
              ? `GPT est. in — sys ${run.summary.baselineTokenBreakdown.systemInstructions ?? "—"} · ctx ${run.summary.baselineTokenBreakdown.contextDocument ?? "—"}`
              : null}
          </p>
        ) : null}
        <p>
          <Link href="/evals/runs">← All runs</Link>
          {" · "}
          <Link href="/evals/compare">Compare with another run</Link>
        </p>
        <label className="evals-check">
          <input
            type="checkbox"
            checked={filterHard}
            onChange={(e) => setFilterHard(e.target.checked)}
          />
          Show hard failures only
        </label>
      </section>

      {cases.map((c) => (
        <CaseCard
          key={c.caseId}
          runId={run.id}
          caseResult={c}
          onReview={saveReview}
        />
      ))}
    </div>
  );
}

function CaseCard({
  runId,
  caseResult: c,
  onReview,
}: {
  runId: string;
  caseResult: EvalCaseResult;
  onReview: (caseId: string, verdict: ManualVerdict, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(c.manual?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <section
      className={`evals-panel evals-case ${c.hardFailures.length ? "has-hard-fail" : ""}`}
      id={c.caseId}
    >
      <div className="evals-case-head">
        <div>
          <p className="evals-kicker">{c.caseId}</p>
          <h3>
            <Link href={`/evals/cases/${c.caseId}`}>{c.question}</Link>
          </h3>
          <p className="evals-meta">
            {c.worldId} · {c.stageId} · {c.categories.join(", ")}
          </p>
        </div>
        <div className="evals-flags">
          <span className={`evals-band is-${c.automatedBand}`}>
            {c.automatedBand}
          </span>
          {c.hardFailures.map((f) => (
            <span key={f} className="evals-hard-flag">
              {f === "trust_failure" ? "TRUST FAILURE" : "CRITICAL FAILURE"}
            </span>
          ))}
          {c.manual ? (
            <span className="evals-meta">Manual: {c.manual.verdict}</span>
          ) : null}
        </div>
      </div>

      {c.automatedNotes.length ? (
        <ul className="evals-notes">
          {c.automatedNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <div className="evals-answer-grid">
        <AnswerBlock title="Lume" record={c.lume} />
        <AnswerBlock title="Generic GPT baseline" record={c.baseline} />
      </div>

      <details>
        <summary>Dimension scores</summary>
        <ul className="evals-dim-list">
          {c.dimensionScores
            .filter((d) => d.band !== "unscored")
            .map((d) => (
              <li key={d.dimension}>
                <strong>{EVAL_DIMENSION_LABELS[d.dimension]}</strong>: {d.band}
                {d.score != null ? ` (${Math.round(d.score * 100)}%)` : ""}
                {d.rationale ? (
                  <span className="evals-meta"> — {d.rationale}</span>
                ) : null}
              </li>
            ))}
        </ul>
      </details>

      <div className="evals-review">
        <p className="evals-meta">Manual review (does not change model output)</p>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
        <div className="evals-review-actions">
          {(
            [
              "pass",
              "partial",
              "fail",
              "trust_failure",
              "critical_intelligence_failure",
            ] as ManualVerdict[]
          ).map((v) => (
            <button
              key={v}
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onReview(c.caseId, v, notes).finally(() => setBusy(false));
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="evals-meta sr-only">run {runId}</p>
      </div>
    </section>
  );
}
