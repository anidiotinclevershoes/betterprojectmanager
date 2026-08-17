# Phase 2A — Lume Intelligence Evaluation Harness

**Branch:** `cursor/phase2a-intelligence-evals-c9f3`  
**Purpose:** Internal regression environment for specialist PM intelligence vs generic GPT.  
**Does not change** Capture / Tell Me / Advise intelligence behaviour.

---

## A. What was built

Route: **`/evals`** (server-gated).

User journey:

1. Allowlisted user opens `/evals` (or sidebar **Evals** link).
2. **Home** shows latest health: Lume pass, GPT pass, wins/ties, trust failures, critical failures, dimension chips, recent runs.
3. **Run benchmark** creates an immutable run (sample fixture today).
4. **Run detail** shows each question with Lume answer, GPT baseline, scores, hard-failure flags, token usage, and manual review controls.
5. **Run history** lists runs; select two → **Compare**.
6. **Compare** shows aggregate deltas, dimension table, per-question side-by-side Lume answers, and **Regressions only** filter.
7. **Project Worlds** / **Case** pages explain fixtures, stages, expected behaviour, and historical answers for a stable test ID.

Architecture (Next.js + existing stack):

- Fixtures: `src/lib/evals/fixtures/` (repo-native TS)
- Access: `src/lib/evals/access.ts`
- Runner: calls **`answerTellMeQuestion`** directly (real Lume Tell Me path) + fair GPT baseline
- Scoring: deterministic heuristics + hard failures + manual overrides
- Persistence: Supabase `eval_runs` (service role) or local `.data/eval-runs/` fallback
- APIs under `/api/evals/*` all call `requireEvalAccess`

---

## B. Access / security

**Env var (Vercel → Project → Settings → Environment Variables):**

```
LUME_EVAL_ALLOWED_EMAILS=spud.hughes@gmail.com
```

Comma-separated, case-insensitive. Empty allowlist = nobody gets in.

Enforcement:

- `/evals/*` layout: server `requireEvalAccess()` → 401 redirect login / 403 redirect home
- Every `/api/evals/*` route: same check; unauthorised users get JSON errors and **no benchmark payloads**
- Sidebar link only appears after `/api/evals/access` succeeds (hiding is not the security boundary)
- Table RLS: `FORCE ROW LEVEL SECURITY`, **no** authenticated policies; `REVOKE` from `anon`/`authenticated`; service role only

**Founder action:** set `LUME_EVAL_ALLOWED_EMAILS` in Vercel Production (and Preview if desired), redeploy.

---

## C. Benchmark fixture format

Add worlds under `src/lib/evals/fixtures/` and register in `fixtures/index.ts`.

Minimal example (already shipped as sample):

```ts
{
  id: "sample-atlas-q3-dev-monday", // STABLE forever
  worldId: "world-sample-atlas-cutover",
  stageId: "stage-reschedule",
  question: "Can development start on Monday 18 August?",
  categories: ["dependency", "people", "temporal", "trust"],
  expectedFacts: ["Sarah", "away", "UX"],
  criticalInsight: "Sarah must finish UX first and is away the week of 18 August",
  forbiddenClaims: ["Yes, development can start Monday"],
}
```

Stages list `captureIds` in order so evolving truth is preserved. Real suite should replace/extend sample — do not treat sample as V1 IQ.

---

## D. Running an evaluation (founder)

1. Sign in with an allowlisted email.
2. Open `/evals`.
3. Optional: set run label (e.g. `Baseline v1`).
4. Click **Run benchmark** (waits until complete; then opens the run).
5. Review each case: Lume vs GPT, flags, collapsed sources.
6. Manual review buttons: Pass / Partial / Fail / Trust failure / Critical… + notes.  
   This annotates the run only — **model output is never mutated**.

---

## E. Historical runs

Each execution inserts a **new** `eval_runs` row (UUID). Updates only refine the same run while executing / adding manual reviews. Prior runs remain.

Recorded fields include: label, timestamp, git commit (`VERCEL_GIT_COMMIT_SHA` when present), `LUME_EVAL_VERSION` / short SHA, fixture version, models, baseline prompt version, summary aggregates, full case payloads, creator email.

---

## F. Side-by-side comparison

1. `/evals/runs` — tick Run A and Run B → **Compare selected runs**, or open `/evals/compare?a=ID&b=ID`.
2. Overall panel: pass counts, trust, critical, Lume wins, **Δ (B − A)**.
3. Dimension table with percentage-point deltas (regressions highlighted).
4. Per question: Run A Lume answer | Run B Lume answer + classification tags (`improved`, `regressed`, `trust_failure_introduced`, etc.).
5. Enable **Regressions only** to jump straight to dangerous changes.

---

## G. Current Lume integration

- Lume path: `answerTellMeQuestion` from `src/lib/tell-me/answer.ts` with MissionState built from fixture captures/knowledge for that stage.
- No HTTP entitlement bypass issues for allowlisted operators — runner is server-side library call.
- No Tell Me / Capture / Coach prompt changes in this task.
- Snapshot refresh not required for fixture stages (snapshot=null).

---

## H. Generic GPT baseline

- System prompt version: `gpt-baseline-v1` (`BASELINE_SYSTEM_PROMPT` in `src/lib/evals/baseline.ts`)
- Same stage `contextDocument` as Lume receives (captures + known truth)
- Model: `OPENAI_MODEL` or `gpt-4o-mini`
- Instruction: experienced IT PM; answer only from supplied info; do not invent facts
- Not handicapped; no extra data

---

## I. Scoring

- **Deterministic:** expected-fact coverage, forbidden-claim detection, uncertainty heuristics, restraint length/waffle heuristics, category-scoped dimensions
- **Hard failures:** `trust_failure`, `critical_intelligence_failure` (prominent in UI)
- **Manual:** override verdict + notes on the run; recalculates summary; does not edit answers
- **Model judge:** not implemented (deferred)

Subjective dimensions (inference, actionability, etc.) may show heuristics — confirm with manual review.

---

## J. Usage telemetry

Captured when OpenAI returns `usage`:

- Lume: `prompt_tokens`, `completion_tokens`, `total_tokens`, model, durationMs (when Tell Me exposes usage)
- Baseline: same from chat completions
- Run summary: summed Lume / GPT total tokens when present  
If a path omits usage, fields are null — never invented.

---

## K. Verification

| Check | Result |
|-------|--------|
| `npm run verify:evals` | Pass (8 checks) |
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass (evals routes present) |

Product verifies not re-run exhaustively; harness is additive. No intentional product behaviour changes.

---

## L. Remaining gaps (meaningful)

1. Real 40–50 question suite not yet authored (sample only).
2. Live OpenAI end-to-end run not executed in this agent env (may lack keys).
3. Supabase migration must be applied in production for durable multi-instance history (filesystem fallback is single-machine / ephemeral on Vercel).
4. Progress UI during long runs is coarse (server waits; checkpoints persist per case).
5. Category/world filters exist in API/runner but home UI runs all sample cases.
6. Model-assisted judging not built.
7. Advise/Coach not in harness yet (Tell Me-focused by design for Phase 2A).

---

## M. Repository state

- Branch: `cursor/phase2a-intelligence-evals-c9f3`
- Commits: pushed with this work
- PR: against `main`
- Migration: `supabase/migrations/20260817200000_eval_runs.sql`
- Env: `LUME_EVAL_ALLOWED_EMAILS` (required), optional `LUME_EVAL_VERSION`, existing `OPENAI_*` / Supabase service role for persistence

### Founder merge / setup

```powershell
cd C:\Users\spudh\betterprojectmanager
git fetch origin
git checkout main
git pull origin main
git merge origin/cursor/phase2a-intelligence-evals-c9f3
git push origin main
```

Then:

1. Apply `20260817200000_eval_runs.sql` in production Supabase.
2. Set `LUME_EVAL_ALLOWED_EMAILS` in Vercel.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` + `OPENAI_API_KEY` present.
4. Open `/evals` while signed in as an allowlisted user.
5. Run sample benchmark once to confirm.
6. Replace sample fixtures with the real Project Worlds when ready.

---

## Recommendation

**EVALUATION HARNESS READY FOR REAL BENCHMARK DATA**

(After migration + allowlist env on the deployed environment.)
