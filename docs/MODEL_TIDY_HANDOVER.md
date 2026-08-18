# Model tidy-up — handover (pre-architecture review)

**Date:** 2026-08-18  
**Branch / PR:** `cursor/model-tidy-same-model-c9f3`  
**Purpose:** Make Lume vs generic GPT an apples-to-apples same-model comparison and explain the ~2.3× token gap — **without** redesigning Capture / Tell Me / Advise / Knowledge.

**Do not begin architecture redesign from this doc.** Next step is a separate architecture review.

---

## Current model configuration

| Surface | Requested identifier | Runtime resolution | Config path |
| --- | --- | --- | --- |
| Production Tell Me | `resolveOpenAIChatModel()` | Default pin **`gpt-4o-mini-2024-07-18`**; alias `gpt-4o-mini` → same pin; override via `OPENAI_MODEL` (aliases remapped) | `src/lib/openai-model.ts` → `src/lib/tell-me/answer.ts` |
| Generic GPT baseline (evals) | `resolveOpenAIChatModel({ forEval: true })` | Same pin by default; optional `OPENAI_EVAL_MODEL` for eval-only experiments | `src/lib/openai-model.ts` → `src/lib/evals/baseline.ts` |
| Capture / other OpenAI routes | `resolveOpenAIChatModel()` | Same shared pin | `src/lib/openai.ts`, snapshot, pm-coach, capture/chat, etc. |

**Before tidy:** both sides typically *requested* `gpt-4o-mini`, but metadata recorded:

- Lume: request alias `gpt-4o-mini`
- Baseline: API response snapshot `gpt-4o-mini-2024-07-18`

So the 2C.2 #1 headline looked like a model mismatch even when both likely hit the same family. That is now fixed by pinning + recording **API `model` + `modelRequested`** on both sides.

**Aliases:** `gpt-4o-mini` is treated as an intentional alias for the pinned snapshot (not left floating).

**Eval vs production:** Prefer **same pin** for controlled comparison (`OPENAI_EVAL_MODEL` unset). Use `OPENAI_EVAL_MODEL` only for explicit later model experiments — keep those runs labelled distinctly from “Same Model Control”.

---

## Changes made (this task only)

1. **`src/lib/openai-model.ts`** — pinned chat model + eval resolver + alignment helper.  
2. Wired Tell Me, baseline, Capture, and other OpenAI call sites through resolvers.  
3. Tell Me + baseline now record **`model` (API)** and **`modelRequested`**.  
4. Eval run summary: `sameModelControl`, `lumeModelRequested`, `baselineModelRequested`, token breakdown aggregates.  
5. **`src/lib/evals/token-breakdown.ts`** — tiktoken estimates by context bucket (eval/debug only; production Tell Me unchanged unless `debugTokenBreakdown`).  
6. Runner enables breakdown for eval Tell Me calls; UI shows models + estimated bucket totals.  
7. Scripts: `npm run verify:model-tidy`, `npm run evals:model-tidy`.  
8. **No** intelligence / fixture / scorer behaviour changes for score gaming.

**Historical runs:** Pre-tidy runs remain readable. New controlled runs should use label **`Model Tidy - Same Model Control`**. Compare score trends across eras carefully when `sameModelControl` / model metadata differ.

---

## Controlled benchmark

### Offline estimate (fixture prompts only — no live API)

From `npm run evals:model-tidy` (45 cases, input estimate):

| Side | Est. input tokens (suite sum) |
| --- | --- |
| Lume | ~44,022 |
| GPT baseline | ~19,546 |
| Ratio | ~**2.25×** |

Dominant Lume buckets (suite sum):

1. **systemInstructions** ~19.4k  
2. **history** ~8.5k  
3. **knowledgeNow** ~5.6k  
4. **knowledgeDecisions** ~3.8k  
5. **knowledgePeople** ~2.8k  
6. **knowledgeRisks** / **risksBucket** ~2.3k  

Baseline: **contextDocument** ~16.4k + **systemInstructions** ~2.7k.

### Live run — founder action required

Agent environment has **no `OPENAI_API_KEY`**. Please run:

```bash
# UI: Evals → Official V1 suite → include GPT baseline → label:
# Model Tidy - Same Model Control
```

Or scripted create+run with the same label. Confirm:

- `sameModelControl: true`
- Lume model === baseline model === `gpt-4o-mini-2024-07-18` (or your pinned override)
- Record pass/partial/fail, trust/critical, tokens, ratio, breakdown

**Until that live run is pasted back, treat score headlines as provisional; token-structure findings below already stand.**

---

## Cost / token concepts

| Concept | Meaning |
| --- | --- |
| Token footprint | Input + output tokens (API usage + estimated bucket split) |
| Approximate API $ | Not hard-coded into production here; use OpenAI’s published 4o-mini rates offline if needed |
| Per-question | Suite total ÷ 45 (rough) |
| Monthly projection | ×20 / ×50 / ×100 Tell Me questions — **tokens**, not billing product |

Implication: most of Lume’s premium is **fixed instruction + structured multi-channel context**, not output length.

---

## Duplicate-context findings (read-only)

### Clearly redundant (safe to consider later)

- **Current position (`now`) vs Knowledge** — knowledge often restates the same facts with different labels (`Current focus`, `Progress`, etc.).
- **Risks vs Knowledge / History** — many risk lines are narrative restatements of the same blockers already in `now` or history.
- **System prompt length** — large behavioural contract repeated every call; much of it is invariant across questions.

### Potentially useful repetition (needs A/B later)

- Restating ownership / open risks in both People and Risks may help the model attend under long context.
- History + Current position overlap can reinforce “what changed” if wording differs.

### Necessary (different purpose)

- **Decisions** as structured supersession channel vs free-text history.
- **People** as responsibility graph vs narrative “who owns what” in knowledge.
- **Conversation turns** as session continuity (non-authority) vs project truth.
- **Snapshot** when present — separate coaching artefact.

**This task did not delete these.** Architecture review should decide what becomes structured truth vs prompt.

---

## Product interpretation (from structure + 2C.2 #1 context)

We still want the live same-model run, but directionally:

### Where Lume is designed to be better

- Current vs historical truth / supersession
- Responsibility restraint (when ownership rules fire)
- Dependency and project-specific continuity
- Contradiction / trust handling (2C.1/2C.2 drove trust failures to 0)

### Where generic GPT tends to win on the suite

- Broad completeness / fluent synthesis on open questions
- **Much lower token use** (~2.2–2.3× less in recent runs)
- Occasional cases where Lume’s shaping/truncation or restraint hurts completeness

### Where they are effectively equal

Paying ~2× tokens for the same answer quality is a **design signal**: either shrink context / instructions, or make structured truth earn the premium with clearer product wins.

---

## Architecture questions raised (do not solve here)

Preserve for the next review:

1. Capture vs Tell Me intelligence contracts (write/propose vs read-only).  
2. Tell Me must not silently add knowledge.  
3. Output shape: direct answer · `Lume noticed` · `Needs confirmation`.  
4. Advise = judgement, separate from Tell Me truth.  
5. North star: Capture proposes → Knowledge maintains → Tell Me reads → Advise judges.  
6. Structured project truth as moat vs ever-larger prompts.  
7. Deterministic invariants + model for interpretation; avoid keyword-rule sprawl.  
8. Cut tokens via better-maintained truth, not more context channels.  
9. Unknown ownership → confirmation UI vs harder prompt rules (2C.2 attempt 2/2).

---

## Recommendation

### `MODEL TIDY COMPLETE — PROCEED TO ARCHITECTURE REVIEW`

**Caveat:** live “Model Tidy - Same Model Control” scores still need founder confirmation with API key. Model alignment, metadata, and token instrumentation are in place; offline footprint analysis already explains the ~2.3× gap. Architecture review should use those facts — not wait on another intelligence tweak.
