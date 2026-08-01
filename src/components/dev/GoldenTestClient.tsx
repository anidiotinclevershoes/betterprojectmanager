"use client";

import { useMemo, useState } from "react";
import type { CaptureResult } from "@/lib/types";
import type {
  GoldenPresentation,
  GoldenScore,
  GoldenScenarioFixture,
} from "@/lib/dev/golden";
import type { MatchStatus } from "@/lib/dev/golden/types";

type ScenarioMeta = {
  id: string;
  name: string;
  description: string;
  available: boolean;
};

type GoldenDiagnostics = {
  promptSize: number;
  estimatedTokens: number;
  contextRecordCount: number;
  dictionaryEntryCount: number;
  promptSections: string[];
  model: string;
  elapsedMs: number;
  openaiConfigured: boolean;
  provider?: string;
  requestId?: string;
};

type AnalyseResponse = {
  error?: string;
  notice?: string;
  scenarioName?: string;
  result?: CaptureResult;
  presentation?: GoldenPresentation;
  score?: GoldenScore & {
    passed?: boolean;
    unexpectedCount?: number;
    invalidTargetCount?: number;
    contradictions?: number;
  };
  diagnostics?: GoldenDiagnostics;
  promptText?: string;
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  correct: "Correct",
  needs_review: "Needs Review",
  missing: "Missing",
  unexpected: "Unexpected",
};

function statusClass(status: MatchStatus) {
  switch (status) {
    case "correct":
      return "is-correct";
    case "needs_review":
      return "is-review";
    case "missing":
      return "is-missing";
    case "unexpected":
      return "is-unexpected";
  }
}

export function GoldenTestClient({
  scenarios,
  initialScenarioId,
}: {
  scenarios: GoldenScenarioFixture[];
  /** Optional deep-link, e.g. /dev/golden-test?scenario=website-refresh-hard */
  initialScenarioId?: string;
}) {
  const available = useMemo(
    () => scenarios.filter((s) => s.available),
    [scenarios],
  );
  const initial =
    (initialScenarioId &&
      available.find((s) => s.id === initialScenarioId)?.id) ||
    available[0]?.id ||
    "website-refresh";
  const [scenarioId, setScenarioId] = useState(initial);
  const scenario =
    scenarios.find((s) => s.id === scenarioId) ?? available[0] ?? scenarios[0];

  const [capture, setCapture] = useState(scenario?.defaultCapture ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [score, setScore] = useState<
    | (GoldenScore & {
        passed?: boolean;
        unexpectedCount?: number;
        invalidTargetCount?: number;
        contradictions?: number;
        prohibitedTriggered?: number;
        ambiguousFindings?: number;
        scoringMode?: "standard" | "hard";
        hardBand?: "strong" | "mixed" | "unreliable";
        hardBandLabel?: string;
        hardExplanation?: string;
      })
    | null
  >(null);
  const [presentation, setPresentation] = useState<GoldenPresentation | null>(
    null,
  );
  const [diagnostics, setDiagnostics] = useState<GoldenDiagnostics | null>(
    null,
  );
  const [promptText, setPromptText] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  function onScenarioChange(id: string) {
    const next = scenarios.find((s) => s.id === id);
    if (!next || !next.available) return;
    setScenarioId(id);
    setCapture(next.defaultCapture);
    setScore(null);
    setPresentation(null);
    setDiagnostics(null);
    setPromptText(null);
    setError(null);
    setNotice(null);
    setShowPrompt(false);
  }

  async function analyse() {
    if (!scenario?.available) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dev/golden-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          content: capture,
        }),
      });
      const data = (await res.json()) as AnalyseResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error || "Analyse failed");
      }
      setScore(data.score ?? null);
      setPresentation(data.presentation ?? null);
      setDiagnostics(data.diagnostics ?? null);
      setPromptText(data.promptText ?? null);
      setNotice(data.notice ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyse failed");
    } finally {
      setBusy(false);
    }
  }

  if (!scenario) {
    return <p className="meta">No Golden scenarios configured.</p>;
  }

  const dropdownItems: ScenarioMeta[] = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    available: s.available,
  }));

  return (
    <div className="golden-page">
      <header className="golden-hero">
        <div className="golden-hero-copy">
          <p className="eyebrow">Development only</p>
          <h1>Golden Test</h1>
          <p className="meta">
            Run a known Capture scenario through the real AI pipeline and see
            whether Lume reasons the way you expect.
          </p>
        </div>
        <label className="golden-scenario-pick">
          <span>Scenario</span>
          <select
            value={scenario.id}
            onChange={(e) => onScenarioChange(e.target.value)}
          >
            {dropdownItems.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.available}>
                {s.name}
                {!s.available ? " (soon)" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>

      {score ? (
        <section
          className={`golden-score golden-score-${score.grade}${
            score.scoringMode === "hard"
              ? ` golden-score-hard golden-score-hard-${score.hardBand ?? "mixed"}`
              : ""
          }`}
        >
          <p className="eyebrow">
            {score.scoringMode === "hard"
              ? "Hard scenario result"
              : "Overall Result"}
          </p>
          <p className="golden-score-grade">
            {score.scoringMode === "hard"
              ? score.hardBandLabel ?? score.gradeLabel
              : `${score.gradeEmoji} ${score.gradeLabel}`}
          </p>
          {score.scoringMode === "hard" ? (
            <>
              <ul className="golden-hard-metrics">
                <li>
                  Expected outcomes matched: {score.matched} / {score.total}
                </li>
                <li>
                  Prohibited outcomes triggered:{" "}
                  {score.prohibitedTriggered ?? 0}
                </li>
                <li>Unexpected operations: {score.unexpectedCount ?? 0}</li>
                <li>Ambiguous findings: {score.ambiguousFindings ?? 0}</li>
                <li>Invalid targets: {score.invalidTargetCount ?? 0}</li>
              </ul>
              {score.hardExplanation ? (
                <p className="golden-hard-explanation">{score.hardExplanation}</p>
              ) : null}
            </>
          ) : (
            <p className="golden-score-meta">
              {score.matched} / {score.total} expected outcomes matched
              {"passed" in score && score.passed === false
                ? ` · ${score.unexpectedCount ?? 0} unexpected · ${score.invalidTargetCount ?? 0} invalid IDs · ${score.contradictions ?? 0} contradictions`
                : null}
            </p>
          )}
          <ul className="golden-score-chips">
            {score.outcomes.map((o, i) => (
              <li key={`${o.status}-${i}`} className={statusClass(o.status)}>
                <span>{STATUS_LABEL[o.status]}</span>
                <span>{o.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="golden-score golden-score-idle">
          <p className="eyebrow">
            {scenario.scoringMode === "hard"
              ? "Hard scenario result"
              : "Overall Result"}
          </p>
          <p className="golden-score-grade">Ready</p>
          <p className="golden-score-meta">
            {scenario.scoringMode === "hard"
              ? "Press Analyse Scenario. A low band is a measurement, not an application failure."
              : "Press Analyse Scenario to score this fixture."}
          </p>
        </section>
      )}

      <section className="golden-panel">
        <h2>1. Scenario</h2>
        <h3 className="golden-project-name">{scenario.project.name}</h3>
        <hr className="golden-rule" />

        <h4>To Dos</h4>
        <ul className="golden-list">
          {scenario.todos.map((t) => (
            <li key={t.id}>
              ✓ {t.title}{" "}
              <span className="meta">({t.statusLabel})</span>
            </li>
          ))}
        </ul>

        <h4>Risks</h4>
        <ul className="golden-list">
          {scenario.risks.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>

        <h4>Stakeholders</h4>
        <ul className="golden-list">
          {scenario.stakeholders.map((s) => (
            <li key={s.id}>
              • {s.name} — {s.role}
            </li>
          ))}
        </ul>

        <h4>Knowledge</h4>
        <ul className="golden-list">
          {scenario.knowledge.map((k) => (
            <li key={k}>• {k}</li>
          ))}
        </ul>
      </section>

      <section className="golden-panel">
        <h2>2. Capture</h2>
        <textarea
          className="golden-capture"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          rows={8}
          spellCheck
        />
      </section>

      <section className="golden-panel golden-analyse">
        <h2>3. Analyse</h2>
        <button
          type="button"
          className="primary-btn golden-analyse-btn"
          disabled={busy || !scenario.available}
          onClick={() => void analyse()}
        >
          {busy ? "Analysing…" : "Analyse Scenario"}
        </button>
        {error ? <p className="golden-error">{error}</p> : null}
        {notice ? <p className="meta">{notice}</p> : null}
      </section>

      {presentation ? (
        <section className="golden-panel">
          <h2>4. Results</h2>
          <div className="golden-result-grid">
            <article className="golden-card">
              <h3>Summary</h3>
              <p>{presentation.summary}</p>
            </article>

            <article className="golden-card">
              <h3>Facts</h3>
              <ul className="golden-list">
                {presentation.facts.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </article>

            <article className="golden-card golden-card-wide">
              <h3>Findings</h3>
              <div className="golden-ops">
                {(presentation.findingCards ?? []).length === 0 ? (
                  <p className="meta">No findings returned.</p>
                ) : (
                  (presentation.findingCards ?? []).map((f) => (
                    <div key={f.id} className="golden-op-card">
                      <p className="golden-op-head">Finding</p>
                      <p className="golden-op-title">{f.fact}</p>
                      {f.matchedTitle ? (
                        <p className="meta">
                          Matched to {f.matchedLabel} · {f.matchedTitle}
                        </p>
                      ) : (
                        <p className="meta">No matched record</p>
                      )}
                      <p className="meta">Meaning · {f.meaning}</p>
                      <p className="golden-op-conf">
                        Confidence {f.confidence}%
                      </p>
                      {f.requiresClarification ? (
                        <p className="golden-error">
                          Needs clarification
                          {f.clarificationQuestion
                            ? `: ${f.clarificationQuestion}`
                            : ""}
                        </p>
                      ) : null}
                      {f.invalidTarget && f.validationWarning ? (
                        <p className="meta">{f.validationWarning}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="golden-card golden-card-wide">
              <h3>Reasoning</h3>
              <div className="golden-reasoning">
                {presentation.reasoning.map((step) => (
                  <div key={step.id} className="golden-reason-chain">
                    <p className="golden-reason-label">{step.foundLabel}</p>
                    <p className="golden-reason-title">{step.foundTitle}</p>
                    <p className="golden-reason-arrow">↓</p>
                    <p>{step.captureStates}</p>
                    <p className="golden-reason-arrow">↓</p>
                    <p className="golden-reason-recommend">{step.recommend}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="golden-card golden-card-wide">
              <h3>Proposed Operations</h3>
              <div className="golden-ops">
                {presentation.proposed.length === 0 ? (
                  <p className="meta">No operations proposed.</p>
                ) : (
                  presentation.proposed.map((op) => (
                    <div key={op.id} className="golden-op-card">
                      <p className="golden-op-head">
                        ✓ {op.operation.toUpperCase()}
                      </p>
                      <p className="meta">{op.entityLabel}</p>
                      <p className="golden-op-title">{op.title}</p>
                      {op.detail ? (
                        <p className="meta">{op.detail}</p>
                      ) : null}
                      <p className="golden-op-conf">
                        Confidence{" "}
                        {op.confidence != null ? `${op.confidence}%` : "—"}
                        {op.confidenceEstimated ? (
                          <span className="meta"> (estimated)</span>
                        ) : null}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <details className="golden-dev">
        <summary>Developer Details</summary>
        {diagnostics ? (
          <dl className="golden-dev-grid">
            <div>
              <dt>Prompt size</dt>
              <dd>{diagnostics.promptSize.toLocaleString()} chars</dd>
            </div>
            <div>
              <dt>Approx tokens</dt>
              <dd>{diagnostics.estimatedTokens.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Context records</dt>
              <dd>{diagnostics.contextRecordCount}</dd>
            </div>
            <div>
              <dt>Dictionary entries</dt>
              <dd>{diagnostics.dictionaryEntryCount}</dd>
            </div>
            <div>
              <dt>Prompt sections</dt>
              <dd>{diagnostics.promptSections.join(" · ")}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{diagnostics.model}</dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd>{(diagnostics.elapsedMs / 1000).toFixed(1)}s</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>
                {diagnostics.provider ?? "—"}
                {diagnostics.openaiConfigured ? "" : " (local fallback)"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="meta">Run Analyse to populate developer details.</p>
        )}
        {promptText ? (
          <div className="golden-prompt-wrap">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowPrompt((v) => !v)}
            >
              {showPrompt ? "Hide raw prompt" : "Show raw prompt"}
            </button>
            {showPrompt ? (
              <pre className="golden-prompt">{promptText}</pre>
            ) : null}
          </div>
        ) : null}
      </details>
    </div>
  );
}
