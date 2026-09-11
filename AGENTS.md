<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lume agent rules

Start at `docs/README.md`. That is the only current-docs entry point.

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

## Current post-programme truth (6 Sep 2026)

`origin/main` at programme start: `f737f8a88442bff9e850d91de55c9afd82cda630`. After this programme merges, that SHA moves.

Read `docs/README.md` → `docs/LUME_V09_TO_V1_HANDOFF.md` → `docs/LUME_V1_KNOWN_DISCOVERIES.md` → code. Integrity history: `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`. Do not invent a second memory file.

**Architecture now**

- Durable truth is Supabase. Surfaces re-project it. Actions must not create parallel stores (handoff §3.1).
- Capture V2 is the only Analyse → Review → Apply engine. Ready means the same production Apply path can execute that change. Apply still revalidates.
- Timeline is a read-only projection. Legacy writable Gantt is unmounted. Meeting Catch Me Up is meeting-scoped from stored project truth; `Meeting.prep` hydrates for compatibility only.

**Integrity contracts closed by the dogfood gate (D-045–D-048)**

- Apply reload: after a successful write, never adopt pre-write state. Production omits `state` and sets `reconcileFailed`; the client hydrates or asks for refresh.
- Fingerprint / concurrency: Analyse fingerprints the fields Apply writes (todo dueAt/detail, milestone endAt/notes, replace pin + owner set). Concurrent edits of those fields fail closed.
- Capture session binds to the open project (`lume-capture-session-v1:${projectId}`). Apply refuses a session/project mismatch.
- Knowledge, availability, person, and responsibility Apply writes use `capture_apply_receipts`. Retry is `no_change`. No second receipt system.

**Still open (later hardening — see Known Discoveries backlog)**

New Project create is one `create_project_bundle` transaction. Project delete is one `delete_project_bundle` transaction. Same-workspace RLS now requires `project_belongs_to_workspace` on recommendations / history / capture_sessions (N-09). No production integrity observer. Apply refreshes the paint cache from confirmed `reloadWorkspace` state (N-10 closed).

**How to re-run integrity probes (read-only / in-memory)**

```bash
npm run verify:adversarial-integrity
npm run verify:dogfood-integrity-gate
npm test
```

SQL printed by the adversarial script is operator-only. Do not run it as a migration. Do not start New Project TX, broader RLS, Timeline Add, Gantt, or Keep Open unless a later programme names them.
