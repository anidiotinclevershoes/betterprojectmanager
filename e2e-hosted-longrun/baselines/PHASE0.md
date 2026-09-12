# Phase 0 — current authority

Recorded 12 September 2026 before first production long-run.

## Repository

- Remote: `anidiotinclevershoes/betterprojectmanager`
- `origin/main` SHA: `9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6`
- Commit: `9f24a65 Merge pull request #169 from anidiotinclevershoes/cursor/docs-reconciliation-c980`
- Working branch: `cursor/e2e-longrun-dogfood-a3db`
- Contains current main?: YES
- Behind: 0
- Shared/global product files touched?: NO (programme assets + docs entry + package script only)

## Authority read

- `docs/README.md` — entry map; historical files do not override
- `docs/LUME_CONSTITUTION.md` — Capture AI/deterministic boundary; Review op ≠ domain; Needs You for unsafe ambiguity
- `docs/LUME_CANONICAL_PROJECT_TRUTH.md` — write then project; Apply is the write
- `docs/LUME_DURABLE_PROJECT_TRUTH.md` — no stranding of persisted truth
- `docs/LUME_CAPTURE_STATUS.md` — Prompt A; 534/538; product-model gaps; Prompt E rejected
- `docs/LUME_V1_KNOWN_DISCOVERIES.md` — open D-005/D-008/D-029/D-050 etc.; closed D-045–D-048, D-052, Family 1
- `AGENTS.md` — main is the only integration line; no product fixes in this first run

Capture status production SHA named in that file (`91fabf8`) is the accepted Capture position. Current `main` is docs-reconciliation on top of that line.

## Production host for this programme

- Default: `https://betterprojectmanager.vercel.app`
- Public `/login` returned HTTP 200 without Vercel SSO (12 Sep 2026)
- Cloud env `LUME_E2E_BASE_URL` pointed at a Preview host and is **not** used; long-run defaults to production via `LUME_LONGRUN_BASE_URL` / built-in origin

## Review contract locked from current code

- Exclude change = dismiss; Apply Ready uses `pendingReadyModels` (not dismissed)
- No re-include / restore-dismissed control in Review UI
- No free-text candidate title editor (`setEditingContent` unused by cards)
- Legal candidate edits: date, entity kind, target, ownership
- `onResolve` / `onProvideDate` / ownership share|replace may call Apply immediately
- Use this / Create new / entity kind stage only
