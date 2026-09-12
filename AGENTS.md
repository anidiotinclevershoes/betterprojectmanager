<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lume agent rules

Start at `docs/README.md`. That is the only current-docs entry point.

Durable high-order rules: `docs/LUME_CONSTITUTION.md`.  
Canonical writes: `docs/LUME_CANONICAL_PROJECT_TRUTH.md`.  
Existing-project compatibility: `docs/LUME_DURABLE_PROJECT_TRUTH.md`.  
Current Capture position: `docs/LUME_CAPTURE_STATUS.md`.  
Living debt: `docs/LUME_V1_KNOWN_DISCOVERIES.md`.  
Implementation map: the code on current `main`.

Do not invent a second architecture memory file. `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` is historical.

## Git / integration (must)

`main` is the only integration line.

Before every substantial implementation slice run:

```bash
npm run git:preflight
```

Record:

```text
Working branch:
Branch HEAD:
origin/main HEAD:
Merge-base:
Ahead:
Behind:
Contains current main?:
Working tree clean?:
PR base:
Dependencies:
Shared/global files expected:
Branch classification:
```

**MATERIALLY STALE = STOP.** Do not start normal product work. Recreate from current `main`, or mark the work an intentional non-mergeable experiment (`LUME_EXPERIMENT=1` / `experiment/` branch).

A few commits behind is still stale if those commits change Capture Apply, persist, `store.tsx`, shared types, or migrations.

Normal product branches must contain current `main` when work begins. Product PRs target `main`.

Maximum stack depth is 2, and only with an explicit dependency. Refresh after every upstream merge.

Shared/global files have one owner at a time:

- `src/lib/capture/**` (Apply, readiness, Review view-model)
- persist / load paths
- `src/lib/store.tsx`
- shared authoritative types
- Supabase migrations / RLS

Completion reports must state whether the branch contains current `main` and is safe to merge.

`experiment/` branches and leftover programme bases (including `cursor/capture-v2-desert-new-project-56c9`) are **reference-only**. They are not a development base. Promote work only by porting onto a fresh branch from current `main`.

Do not merge or rebase #119–#123 / #120 wholesale. They are salvage sources only.

## Data-model / persistence preflight (must)

Before material work on schema, canonical entity shapes, domain semantics, persistence contracts, migrations, canonical readers, or projection logic, answer:

1. What existing persisted project data could this affect?
2. Can this be additive / backwards-compatible?
3. If migration is required, is it deterministic?
4. Are stable IDs preserved?
5. Are relationships preserved?
6. Is history / audit preserved?
7. Is semantic meaning preserved?
8. Is uncertainty preserved correctly?
9. What old-project regression proves compatibility?
10. Could a real user lose data, need to recreate a project, or have truth silently reinterpreted?

If **#10 is YES or UNCERTAIN: STOP AND ESCALATE TO PRODUCT OWNER.**

Full contract: `docs/LUME_DURABLE_PROJECT_TRUTH.md`.

If a change could destroy existing project truth, require project recreation, irreversibly reinterpret stored truth, orphan history, invalidate stable IDs, break relationships, or make historical projects unreadable: **STOP.** Do not autonomously implement the destructive path.

## Architecture now

- Durable truth is Supabase. Surfaces re-project it. Actions must not create parallel stores.
- Capture V2 is the only Analyse → Review → Apply engine. Prompt A is production. Deterministic routing is accepted at 534/538. Live model imperfections are guarded by deterministic safety.
- Ready means the same production Apply path can execute that change. Apply still revalidates.
- Timeline is a read-only projection. Legacy writable Gantt is unmounted. Catch Me Up is a derived briefing from stored project truth; `Meeting.prep` hydrates for compatibility only.

Integrity contracts closed by the dogfood gate (D-045–D-048): Apply reload must not adopt pre-write state; fingerprints cover the fields Apply writes; Capture session binds to the open project; knowledge / availability / person / responsibility Apply uses `capture_apply_receipts`.

How to re-run integrity probes (read-only / in-memory):

```bash
npm run verify:adversarial-integrity
npm run verify:dogfood-integrity-gate
npm test
```

SQL printed by the adversarial script is operator-only. Do not run it as a migration.

Do not start work from a historical “do not start X” list in an old handoff. Current open work lives in Known Discoveries and in the task that names it.
