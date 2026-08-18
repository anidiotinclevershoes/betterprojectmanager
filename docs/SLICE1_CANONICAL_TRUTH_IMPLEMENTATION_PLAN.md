# Slice 1 Implementation Plan — Canonical Truth + Knowledge Centre Foundation

**Branch:** `cursor/slice1-canonical-truth-c9f3`  
**Status:** Plan approved for implementation (no blocking architectural issues)  
**Scope:** Slice 1 only — see architecture review. No prompt-tuning cycle, agents, vectors, multi-pass, or large rewrite.

---

## Blocker check

| Risk | Finding | Decision |
| --- | --- | --- |
| `ProjectKnowledge.sections` is `string[]` without ids | DB has UUIDs but load drops them | **Non-blocking.** Keep `sections: string[]` as legacy body store; add optional `structured: CanonicalTruthItem[]` overlay for Slice 1 metadata. Avoids blast-radius rewrite of Capture/UI. |
| `replaceKnowledge` local-only | Confirm owner must persist | Persist via existing `addKnowledgeBullet` / new `upsertCanonicalTruthItem` that writes `knowledge_items` with metadata columns |
| No mid-project person picker | Confirm owner needs select/add person | Reuse stakeholder list patterns; minimal dialog (select existing stakeholder or type name → knowledge people + optional stakeholder insert) |
| Epistemic backfill | Must not fake certainty | Legacy items: `epistemic: null` / treat as `legacy` — never auto-`confirmed` |
| Feature flag absent today | Need rollback | Env `LUME_CANONICAL_TRUTH=1\|0`; evals force ON; production default OFF until validated |

**No stop-ship blocker.** Proceed.

---

## Exact changes

### A. Schema (additive)

`supabase/migrations/20260818230000_knowledge_canonical_metadata.sql`

```sql
alter table public.knowledge_items
  add column if not exists kind text,
  add column if not exists epistemic text
    check (epistemic is null or epistemic in (
      'confirmed','pending','informal','suggested','inferred','conflicting','unknown','legacy'
    )),
  add column if not exists lifecycle text not null default 'current'
    check (lifecycle in ('current','superseded','historical')),
  add column if not exists supersedes_id uuid references public.knowledge_items(id) on delete set null,
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists provenance jsonb not null default '[]'::jsonb;
```

Hand-update `src/types/database.ts`.

### B. Types + helpers

- `src/lib/canonical-truth/types.ts` — `CanonicalTruthItem`, epistemic/lifecycle/kind unions, responsibility meta
- `src/lib/canonical-truth/serialize.ts` — `serializeCanonicalTruth({ state, projectId, question })`
- `src/lib/canonical-truth/flag.ts` — `isCanonicalTruthEnabled(opts?)`
- `src/lib/canonical-truth/suggestions.ts` — deterministic templates from structured + milestones + waiting
- `src/lib/canonical-truth/confirm-responsibility.ts` — pure function: apply confirm owner → next state patch
- Extend `ProjectKnowledge` with optional `structured?: CanonicalTruthItem[]`
- Extend `CreateKnowledgeInput` / persist / load to round-trip metadata

### C. Tell Me read path (flagged)

- `buildTellMeContext` / `answerTellMeQuestion`: when flag ON, use canonical prompt block (current truth once; history only if historical intent; skip duplicate channel dump)
- Preserve legacy `formatTellMePromptBlock` behind flag OFF
- Shorten system prompt **only** for canonical path where output schema carries noticed/needsConfirmation; keep core trust refuse-invention rules

### D. Output contract

Extend model JSON + `TellMeAnswer`:

```ts
{
  answer: string;
  noticed?: string[];
  needsConfirmation?: Array<{
    id: string;
    kind: 'unknown_owner' | 'conflict' | 'ambiguity';
    summary: string;
    scope?: string; // e.g. "Security sign-off"
  }>;
  confidence: ...; // retain
  sourceIds / evidenceIds: ...;
}
```

UI: render Answer / Lume noticed / Needs confirmation; Confirm owner button does not mutate inside answer engine.

### E. Confirm owner flow

- Component: `ConfirmOwnerDialog` + action in Tell Me panel when `needsConfirmation.kind === 'unknown_owner'`
- API or store method: `confirmResponsibilityOwner({ projectId, scope, personName, personId? })`
- Writes structured item `kind=responsibility`, `epistemic=confirmed`, meta `{ personName, scope }`, provenance `{ type: 'user_confirmation' }`
- Mirrors people bullet `"Name — scope"`
- Resolves matching unknown/ambiguity structured rows to superseded/resolved
- Subsequent Q&A reads owner from structured truth

### F. Knowledge UI foundation (minimal)

- `src/components/intelligence/PersonEntity.tsx` — `@Name` · optional scope
- `src/components/intelligence/EpistemicChip.tsx` — sparse (informal/conflicting/needs confirmation only)
- `src/components/intelligence/EvidenceReveal.tsx` — on-demand “Why does Lume think this?”
- Wire lightly into `ProjectKnowledgeBrief` for structured items; plain bullets unchanged

### G. Deterministic suggestions

- Extend/replace suggestion builder to prefer `buildCanonicalSuggestions(structured + milestones + waiting)`
- **Zero OpenAI calls** — unit test spies / static proof
- Project-scoped isolation test

### H. Tests

- `scripts/verify-canonical-truth.ts` — lifecycle, scoped responsibility, unknown stays unknown, suggestions no AI, confirm→answer mutation, project isolation
- Keep existing `verify:trust-intelligence`, `verify:context-integrity`, `verify:model-tidy`

### I. Benchmark

Label: `Canonical Truth Slice 1`  
Evals runner enables canonical path. Report vs MODEL TIDY PR37 (49,157 / 21,470).

---

## Out of scope (enforced)

Full Knowledge Centre redesign · Tell Me rename · availability engine · dependency confirm · risk-table unify · Advise · vectors/agents · freshness system · badge storm · prompt-tuning cycle.

---

## Implementation order

1. Types + migration + load/persist round-trip  
2. serializeCanonicalTruth + flag + Tell Me wiring + output schema  
3. Confirm owner end-to-end  
4. Entity UI foundation + deterministic suggestions  
5. Verify scripts + estimate tokens + handover  
6. Commit / PR  

*Proceeding to implement under this plan.*
