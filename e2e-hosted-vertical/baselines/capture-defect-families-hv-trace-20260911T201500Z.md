# Capture defect families — hosted trace `hv-trace-20260911T201500Z`

Diagnosis only. No production fix in this pass. D-052 New Project VALIDATE loss is out of scope.

Re-run the isolated traces (not the calibrated six-journey suite):

```bash
LUME_E2E_RUN_ID=hv-trace-<id> npx playwright test -c e2e-hosted-vertical/playwright.trace.config.ts
```

Live project IDs from this run:

- Capture date: `65743f38-cde1-4f4d-b9ff-9cb36e5ffa88` (`E2E capture hv-trace-20260911T201500Z`)
- Ambiguity: `3812c659-c17a-4108-9ab8-3bf2376d9904` (`E2E ambiguity hv-trace-20260911T201500Z`)

## Preflight

```text
Working branch: cursor/hosted-vertical-journeys-2024
Contains current main?: YES
Branch classification: CURRENT
Not safe to merge to main (stacked on PR #155)
```

## 1. Persistence root-cause (Capture date)

**Class F** — reload/projection is stale despite correct DB truth.

A HTTP 200 is not enough; this run also had `executed.kind = "wrote"`. That write **did** reach canonical `milestones.start_on`.

| Boundary | Evidence |
|---|---|
| Source | `The Production release is now scheduled for 20 September 2026.` |
| Extract / Review | `ENTITY_UPDATED`, family `update`, target milestone `4d7565f1-26ea-4bf0-bc56-6b671bd2891f`, date Sep 20 |
| Apply request | `update` / `targetEntityId=4d7565f1-…` / expectedTarget `startAt=2026-09-12T12:00:00.000Z` / requested `date=2026-09-20` |
| POST `/api/capture/apply` | HTTP 200 |
| Planned op | `update_milestone` on that id, `startAt=2026-09-20T12:00:00.000Z` |
| Executed | `kind=wrote`, `operation=update_milestone`, `reconcileFailed=false` |
| Persistence | `persistTimelineUpdate` → `milestones.update({ start_on })`. **No RPC. No receipt.** `applyOperationId` is not set on update. |
| Apply returned state | timeline `startAt=2026-09-20`; `projects.nextMilestoneAt` still `2026-09-12` |
| Canonical row after Apply | `milestones.start_on=2026-09-20` (updated_at `2026-09-11 20:23:51.828+00`); `projects.next_milestone_on=2026-09-12` |
| Receipt | none (table exists; this update path does not write one) |
| Hydrate GET `/api/workspace/state` immediately after Apply | timeline **20 Sep**, nextMilestoneAt **12 Sep** |
| Paint cache after Apply | still **12 Sep** (`savedAt` from create, `20:23:41.270Z`) |
| KC dates after Apply (no reload) | `Production release · 20 Sep` |
| Hard reload, workspace visible 570ms | cache still 12 Sep |
| Immediate KC dates | `Production release · 12 Sep` while hydrate GET already returns 20 Sep |
| After 8s | cache rewritten by hydrate (`savedAt 20:23:55.927Z`), KC dates `Production release · 20 Sep` |

Ruled out:

- **A** mutation never reaches canonical DB — false (`start_on=2026-09-20` and hydrate GET agrees).
- **B** mutation succeeds then overwritten — false (row still 20 Sep after reload wait).
- **C** old+new rows, hydrate chooses old — false (one milestone row). Partial cousin: `projects.next_milestone_on` stays 12 Sep **and** `milestones.start_on` is 20 Sep; KC **date cards** use `state.timeline`, not `nextMilestoneAt`.
- **D** Apply targets a different entity — false (same id from create → Review → Apply → DB).
- **E** receipt success without mutation — false (no receipt on this path; executed is `wrote`).

**G (additional, not the dates-card miss):** `update_milestone` does not update `projects.next_milestone` / `next_milestone_on`. Gantt `timeline-projection.ts` also remembers `source: "project_milestone"`. After hydrate, date cards are 20 Sep while that pointer remains 12 Sep.

Known name: N-10 (`adoptAppliedState` does not write `lume-mission-supabase-cache-v1`). Hard reload paints that cache in `useLayoutEffect` **before** `/api/workspace/state` is applied to React.

## 2. Earliest Apply/reload divergence

**After the canonical write, at first client paint on hard reload.**

Order:

1. `persistTimelineUpdate` commits `milestones.start_on=2026-09-20`.
2. Apply reloadWorkspace / GET `/api/workspace/state` already has 20 Sep on timeline.
3. Client adopts Apply `state` in memory (KC after Apply shows 20 Sep) but **does not write the paint cache**.
4. Hard reload paints the create-time cache (12 Sep). `ocean-project-workspace` is visible from that paint (~570ms).
5. Harness opens Knowledge dates and reads **12 Sep** while MissionProvider hydrate has not yet replaced React state (hydrate GET itself already returns 20 Sep).
6. ~1.5–8s later hydrate applies, rewrites the cache, and KC dates show 20 Sep.

The harness `PROJECTION_RELOAD` failure is this window. It is not a reverted DB write.

## 3. Capture date and Mixed are one family

Yes. Both are Apply `update_milestone` after Organise created a real Production release milestone.

Prior hosted rows, still true at diagnosis time:

- Capture `4db747ea-…` and Mixed `eaf92329-…` (`hv-cal-20260911T194000Z`): `milestones.start_on=2026-09-20`, `projects.next_milestone_on=2026-09-12`.
- Mixed `81f07681-…` (`hv-cal-20260911T193400Z`, the run that **looked** like it persisted 20 Sep after reload): **same split**. The “success” was hydrate winning the race, not a different mutation.

## 4. Intermittent success vs failure

Same operation shape. Same canonical outcome. Variable is **hydrate latency vs how soon Knowledge dates is read after `hardReload`**.

- Fast hydrate → 20 Sep in the dates card → Mixed PASS.
- Slow / read during cache paint → 12 Sep → FAIL.

Do not treat that as a second persistence bug.

## 5. `persist_milestone_create_with_receipt`

**Genuinely absent on hosted Lume (`exfftrxxinhduogcluce`).** Not PostgREST cache staleness of an existing function. Not a wrong name in the repo.

Hosted `public` functions are only:

- `create_project_bundle`
- `delete_project_bundle`
- `create_workspace_with_owner`
- `ensure_personal_workspace`
- `ensure_workspace_trial`
- `handle_new_user`
- `is_workspace_member`
- `project_belongs_to_workspace`
- `set_updated_at`

Repo defines `persist_milestone_create_with_receipt(p_workspace_id, p_project_id, p_milestone, p_receipt)` in `supabase/migrations/20260829200000_authoritative_apply_tx.sql`. Client: `persistTimelineItemWithReceipt`.

`capture_apply_receipts` **does** exist. `supabase_migrations` does not. Hosted schema was applied ad hoc and lags that migration.

Preview uses this same database. Create-milestone Apply with `applyOperationId` 500s with schema-cache missing-function (Ambiguity `hv-cal-20260911T193400Z`). **Unrelated to the update→reload dates-card miss.**

## 6. Ambiguity isolation — earliest loss

Seed (UI, not Organise): people Olga/Sarah + knowledge fact `"Production release"`. **No milestone row.** Confirmed on `3812c659-…`.

This live run did **not** make the date unmatched:

| Observation | Extract | Validate | Identity gate | Plan / Review |
|---|---|---|---|---|
| Pronoun / UAT | Fact bound to Olga (`630766c9-…`), evidence `She will own UAT going forward.` | accepted (`invalidTarget: false`) | person-linked; replacement needs confirmed owner | `needs_you` — **correct** |
| Production 21 Sep | `NEW_INFORMATION`, create target, date Due Sep 21 | accepted | n/a (milestone is not `PERSON_LINKED_DOMAINS`) | Review family **`create`** |

So on this run the clear date never became Needs You. The pronoun sibling did not contaminate it through `identityEvidenceText`.

The calibrated `hv-cal-20260911T194000Z` unmatched date is a **different extract/validate mode on the same seed**:

- `findingType: AMBIGUOUS`, `invalidTarget: true`, no `targetId`, `targetTitle` = project name, proposed date 21 Sep, 0 ready.
- `invalidTarget: true` is only set when the observation was **rejected** (`toResult.ts`).
- `validate.ts` `foreign_id`: `candidateTargetId` not in `contextRecordsFromWorld` (people/risks/todos/**milestones**). The prompt still prints `Current project: … id=<projectUuid>`. The model can copy that UUID. The project id is **not** a bindable milestone, so validate strips the id and forces `disposition: "ambiguous"`.
- If extract instead emits `update_existing` with no id: resolve `needs_you` (“Update requires a valid existing identity.”).
- If extract emits `create_new` (this trace): Review create. Apply then needs `persist_milestone_create_with_receipt` → hosted 500.

**Earliest unmatched loss (when it happens):** VALIDATE `foreign_id` (or resolve “update requires identity” if extract omitted the id). After extract, before Review paint. Not at Apply. Not at reload.

## 7. Same as the convergence-suite family?

**No.** `scripts/verify-capture-intelligence-diagnostic.ts` “Andris in the full paste is blocked by Olga+Sarah names in sibling sentences” is `personLinkedIdentityGate` using the **whole Capture** as identity evidence for person/availability/responsibility.

Milestone dates do not enter that gate. This hosted miss is:

- missing milestone (knowledge title is not dated truth);
- model sometimes `create_new` (ready) and sometimes `update_existing` / project UUID (fail-closed unmatched);
- validate does not type-check IDs.

Related fail-closed culture; **not** the same identity-evidence family.

## 8. Smallest structural fixes (not implemented)

**Family 1 — update persist vs first paint (F + N-10)**

- After confirmed Apply write, write `lume-mission-supabase-cache-v1` from the adopted post-write state (`adoptAppliedState` / Apply `state`). Do not wait for the next `saveStatus==="saved"`.
- Same `update_milestone` path: when the updated row is the project’s current `next_milestone`, update `projects.next_milestone_on` (or stop projecting `project_milestone` as a second date). Do not paper over it in the harness with a sleep.

**Family 2 — create RPC**

- Apply hosted `20260829200000_authoritative_apply_tx.sql` (and the other receipted persist functions in that file). Do not bypass receipts. Do not invent a second RPC name.

**Family 3 — date unmatched when no milestone**

- Validate: a `candidateTargetId` must match a context record of the observation’s entity type. Project UUID is not a milestone.
- Resolve/plan: clear milestone create (label + date, no existing milestone) must be `create_new` / Apply-ready, not unmatched Needs You.
- Do not weaken pronoun Needs You.

## 9. Blast radius

- Family 1: `store.tsx` cache write after Apply; optionally `persistTimelineUpdate` / project pointer. Every Capture Apply that currently looks right until refresh. Analyse/Review unchanged.
- Family 2: hosted schema + every receipted **create** Apply (milestone, and the other missing RPCs in that migration). Update path unchanged.
- Family 3: Capture V2 validate/resolve/plan for dates without a milestone. Pronoun/person identity gate stays. Mixed paste with a real Organise milestone already updates and is Family 1, not this.

## 10. Tests that would prove each fix

**Family 1**

- After Apply, paint-cache timeline `startAt` is 20 Sep before reload.
- Hard reload + **immediate** Knowledge dates card is 20 Sep (no 8s wait).
- GET `/api/workspace/state` and the dates card agree at first paint.
- `projects.next_milestone_on` matches `milestones.start_on` when that row is the named next milestone.
- Hosted Capture date + Mixed journeys without a post-reload sleep.

**Family 2**

- Hosted `pg_proc` contains `persist_milestone_create_with_receipt(uuid, uuid, jsonb, jsonb)`.
- Ambiguity create Apply HTTP 200, `executed.kind=wrote`, receipt row, hydrate has 21 Sep.
- Replay is `no_change`.

**Family 3**

- Deterministic: Olga+Sarah, **no** milestone, pronoun + “Production release … 21 September 2026” → pronoun `needs_you`, date `create` ready.
- Same paste with an existing Production release milestone → date `update` ready.
- Model-supplied project UUID as milestone `candidateTargetId` must not become unmatched if create is legal.
- Existing Andris sibling-name diagnostic must **not** start passing because the person identity gate was weakened.

## 11. Recommendations

| Family | Recommendation |
|---|---|
| Update → first paint / N-10 (+ stale `next_milestone_on`) | **FIX NOW** |
| Missing `persist_*_with_receipt` on hosted | **SCHEMA/ENVIRONMENT REPAIR** |
| Ambiguity date unmatched / create vs update instability | **FIX NOW** (validate type-check + create when no milestone). Pronoun Needs You stays. |
| D-052 New Project VALIDATE loss | **DEFER** (out of this task) |

Do not patch the harness with `waitForTimeout` as the product fix. A longer wait would hide Family 1.

## 12. Product Owner summary

Lume **did save** the new Production date. The database row is 20 September. After Apply, the screen already shows 20 September. A hard refresh briefly shows 12 September because the app keeps an old snapshot in the browser to avoid a flash, and it does not refresh that snapshot when Capture saves. The hosted test looked at the page during that flash. Sometimes the new date appears in time (that is why Mixed once “worked”); sometimes it does not. A leftover “next milestone” field on the project also still says 12 September, which can keep a second 12 September mark on the timeline strip.

Separately, creating a **new** date from Capture is broken on hosted until a missing database function is installed. That is why Ambiguity once offered “create” and then failed on Apply.

The “She will own UAT” line correctly asks you to choose. The independent Production date should still be actionable. When the project only has the words “Production release” and not a real date record, the model sometimes offers a new date (correct) and sometimes gets stuck asking you which record to update (there isn’t one). That is not the same bug as Andris being blocked by Olga and Sarah’s names.
