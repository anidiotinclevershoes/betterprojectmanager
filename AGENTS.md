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
