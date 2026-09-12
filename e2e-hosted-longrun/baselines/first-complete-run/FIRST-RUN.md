# First untouched production long-run — official run

**Run ID:** `lr-20260912T2212Z`  
**Frozen seed:** `lume-longrun-v1-20260912-a3db`  
**Frozen spec version:** `longrun-v1`  
**origin/main SHA:** `9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6`  
**Harness SHA:** `cd73c16` (New Capture compose-first; no product-code change)  
**Production origin:** `https://betterprojectmanager.vercel.app`  
**Dedicated project:** `8537b7cf-1b50-453e-af64-2b21e2d29e90`  
**Project name:** `E2E-LONGRUN-Riverside Civic Hall Fit-Out lr-20260912T2212Z`  
**Project code:** `LR12T2212Z`  
**Duration:** 10.3 minutes (50/50 captures completed)

This is the official first-run. Frozen expectations were **not** rewritten after seeing Lume. Harness-only compose-input fixes were applied after the first attempt (`lr-20260912T2155Z`) hit a Review-unmount wall; that aborted run is preserved separately and is **not** this report.

Playwright reported `1 passed` because the harness records product FAILs without throwing. That is **not** a product pass.

## A. Baseline

| Item | Value |
| --- | --- |
| origin/main | `9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6` |
| Production host | `https://betterprojectmanager.vercel.app` (public `/login` 200, no SSO) |
| Hosted DB / project | Supabase **Lume** `exfftrxxinhduogcluce` (`db.exfftrxxinhduogcluce.supabase.co`, eu-west-1, ACTIVE_HEALTHY). Production JS embeds `https://exfftrxxinhduogcluce.supabase.co`. Dedicated test project `8537b7cf-1b50-453e-af64-2b21e2d29e90`. |
| Test identity | Dedicated E2E account on `lume.com`; isolation preflight + per-Apply sibling fingerprint |
| Isolation proof | Workspace listed leftover E2E/HO synthetics only; **zero** customer/Candyland names. SQL: only this project’s `projects.updated_at` moved in the official run window. No `STOP_CROSS_PROJECT`. Foreign ID hits on other projects: **0**. |
| Frozen run / seed | `lr-20260912T2212Z` / `lume-longrun-v1-20260912-a3db` |
| First-attempt wall (not official) | `lr-20260912T2155Z` project `469539ae-599f-4bc1-840e-26116d90d023`; aborted `lr-20260912T2208Z` project `afe2bee4-67c1-40bf-a1f2-a0ce5944b07c` |

## B. Historical weakness analysis

| Weakness family | Previous evidence | Long-run probe |
| --- | --- | --- |
| False Needs You on clear create | D-011/D-012, 6+6 C5 | C5 timber-floor risk; C16 Cafe/Hall snag lists |
| Identity fail-closed on known people | D-015, D-049, Pippa-class | C8 Tomos; C24 James; C29 Helen Ward |
| Unmatched create not rematerialized | D-013 | C5/C16 “Create a new …” offered, not executed |
| Responsibility never persisted | D-051 / D-007 / D-052 notes | Organise + C4/C8/C24/C25/C28/C39/C46 → 0 `kind=responsibility` rows |
| Wrong-target Apply | D-008, D-016 | **C18 resolved DDA ramp** instead of timber-floor risk |
| Empty Review / silent omission | D-014, D-030 | C32–C34, C37, C40–C42, C45, C50 |
| Product-model gap not surfaced | D-026, D-027 | C32 cancel Saturday; C40 retire asbestos |
| Review exclude no re-include | D-025 | C22 exclude tape — no undo control |
| Reload / first-paint | Family 1, D-005 | C10/C30 todo appeared only in reload snapshot |
| Date restatement vs move | D-018, D-020 | C3 moved; C21/C48 restated; C33 third move omitted |
| Late people | D-049 | C11 Chris (false NY); C34 Jamie / C45 Leo silent |
| Mixed batch | D-009, D-019 | C7 biscuits excluded by AI; C18 mixed write |
| Specialist misses (post-freeze) | Phase 19 | KC-edit-before-Apply, mid-Review project switch, duplicate names — **not in this run**; see `PHASE19-SPECIALIST-CHALLENGE.md` |

## C. Scenario

Ordinary civic-hall fit-out. State 0: five people, three todos, two risks, three dates, knowledge (FF&E, PC glossary, timber-floor assumption, RAMS). Frozen 50 sequential captures on one project.

Composition (frozen, not observed): 14 single / 28 mixed / 8 heavy. Planned Review: 6 edits, 8 excludes, 2 re-includes (product has no re-include UI), 6 NY resolve, 5 NY exclude, 3 mixed, 7 reload checkpoints.

## D. Capture-by-capture matrix

Harness labels many missing writes `AI_EXTRACT`. The **earliest** column below is the lead reclassification from Review JSON + delta. Vacuous harness PASSes (empty Review + expected Needs You + no write) are **not** product passes.

| # | Frozen summary | Expected (frozen) | Review plan | Result | Earliest |
| --- | --- | --- | --- | --- | --- |
| 0 | New Project State 0 | 5 people, 3 todos, 2 risks, 3 dates, knowledge, responsibilities | organise | **FAIL** people/todos/risks/dates/knowledge present; **0** responsibilities; token `snag` missing (workface fact stored) | PRODUCT_MODEL_GAP + TEST_EXPECTATION |
| 1 | Induction time on mobilisation day | create knowledge 09:00 | none | **FAIL** unmatched Knowledge; induction fact not durable as expected | VALIDATE |
| 2 | Weekly dashboard to-do for Helen | create todo | none | **PASS** | — |
| 3 | First PC date move | PC → 2026-12-18 | none | **PASS** (SQL + reload) | — |
| 4 | Nadia cafe FF&E + sample review date | responsibility + todo date | none | **FAIL** FF&E due 14 Oct landed; responsibility did not | PRODUCT_MODEL_GAP |
| 5 | Asbestos chase closed; timber-floor services risk | complete asbestos; create timber-floor risk | none | **FAIL** asbestos still open; timber-floor never created; false NY “which risk” | VALIDATE |
| 6 | Mei Chen is the QS | responsibility (not duplicate Mei) | none | **FAIL** no responsibility; Mei not duplicated (correct non-write on person) | PRODUCT_MODEL_GAP |
| 7 | RAMS review create; exclude biscuits | create RAMS todo; biscuits excluded | exclude | **PASS** RAMS todo written; biscuits never proposed | — |
| 8 | Tomos owns DDA ramp sign-off | responsibility | none | **FAIL** “person not on this project” (Tomos exists) | IDENTITY |
| 9 | She will own walk-through agenda | NY responsibility; DDA unchanged | NY resolve | **PASS** NY card; DDA still open at this point | — |
| 10 | Week-one email paste plus they-chair huddle | M&E date + photo todo + water isolate + NY huddle | none | **FAIL** some todos/dates appeared on reload; huddle not NY-carded; water isolate became a todo | HYDRATE + VALIDATE |
| 11 | Chris joining — first name only | create name-only Chris | none | **FAIL** false NY “which person”; Create-new offered | VALIDATE |
| 12 | Vague second-fix week | NY milestone | edit date | **PASS** NY card | — |
| 13 | Saturday catch-up dated | create date | none | **PASS** | — |
| 14 | Timber floor is now a decision | create knowledge | none | **FAIL** no new timber-floor decision row | AI_EXTRACT |
| 15 | She wants the photo; exclude pronoun | NY photo; RAMS update | NY exclude | **FAIL** empty/weak Review; asbestos/photo still open | AI_EXTRACT |
| 16 | Two distinct snag lists | create Cafe + Hall snag todos | none | **FAIL** two false NY “which to do”; Create-new offered | VALIDATE |
| 17 | Site WhatsApp dump | containment risk + FF&E update + cost report + exclude biscuits | exclude | **FAIL** cost report written (late to C18 window); containment not a risk row | AI_EXTRACT + HYDRATE |
| 18 | Resolve timber-floor risk; ceiling void stays | complete timber-floor; M&E unchanged | none | **FAIL integrity** Ready-applied **DDA ramp resolve**. Timber-floor never existed. | **IDENTITY / APPLY** |
| 19 | Helen away dates | availability 22–24 Oct | none | **PASS** SQL matches | — |
| 20 | Mixed Review: date + exclude badges + they/RAMS | walk-through date + excludes | exclude + NY exclude | **FAIL** walk-through → 23 Oct written; mixed extras incomplete | AI_EXTRACT |
| 21 | PC restated — no change | no-op | none | **PASS** no duplicate PC | — |
| 22 | Second walk-through; exclude tape then re-include | create date; tape excluded | exclude then re-include | **FAIL** date created; tape stayed out; **no re-include control** | PRODUCT_MODEL_GAP |
| 23 | The snag list owned by James | NY (two lists) | none | **PASS** NY card (lists themselves were never created) | — |
| 24 | Explicit split ownership of two snag lists | 2 responsibilities | none | **FAIL** no writes | IDENTITY / PRODUCT_MODEL_GAP |
| 25 | Mei owns monthly cost report | responsibility | none | **FAIL** no write | PRODUCT_MODEL_GAP |
| 26 | Sample review done; banquettes lead-time | complete FF&E todo; create banquettes risk | none | **FAIL** new `FF&E samples delay` todo; sample review still open; no banquettes risk | IDENTITY |
| 27 | He will own client comms — Chris vs James | NY | NY resolve | **PASS** NY card | — |
| 28 | Chris Ward full name — not Helen Ward | person + responsibility | none | **FAIL** Chris Ward created; responsibility missing | PRODUCT_MODEL_GAP |
| 29 | First-name-only Helen variation | NY (Pippa-class) | none | **PASS** fail-closed | — |
| 30 | Mid-project email | containment update + cafe drawing + DDA mock-up + Nadia away + NY programme | none | **FAIL** drawing + DDA mock-up + Nadia away written (some on reload); PC no-op OK | HYDRATE |
| 31 | Hall lighting scene plate | create knowledge | edit entity kind | **FAIL** empty Review | AI_EXTRACT |
| 32 | Cancel Saturday catch-up | NY product-model gap | none | **FAIL** empty Review (harness vacuous PASS); date remains — correct non-delete, not voiced | PRODUCT_MODEL_GAP |
| 33 | Third PC date move | PC → 2027-01-08 | none | **FAIL** empty Review; SQL still 2026-12-18 | AI_EXTRACT |
| 34 | Jamie covers — name-only, not James | create Jamie | none | **FAIL** empty Review; no Jamie row | AI_EXTRACT |
| 35 | Exclude plant; apply second DDA visit | exclude plant; create date | exclude | **FAIL** no second DDA visit milestone | AI_EXTRACT |
| 36 | DDA ramp signed off; mock-up still due | complete DDA issue | none | **FAIL** DDA already wrongly resolved at C18; mock-up knowledge missing | TEST_EXPECTATION + APPLY |
| 37 | They said huddle chair rotates | NY | none | **FAIL** empty Review (harness vacuous PASS) | AI_EXTRACT |
| 38 | Mixed Review: dates + contradictory banquettes | mixed + NY exclude | NY exclude | **FAIL** empty/weak Review | AI_EXTRACT |
| 39 | Jamie Okoye is not James Okonkwo | person + responsibility | none | **FAIL** empty Review | AI_EXTRACT |
| 40 | Snag start + retire asbestos knowledge | updates + NY gap | exclude | **FAIL** empty Review; snag todos never existed | PRODUCT_MODEL_GAP + AI_EXTRACT |
| 41 | Someone needs to own fire-door certificates | NY | NY exclude | **FAIL** empty Review (harness vacuous PASS) | AI_EXTRACT |
| 42 | Nadia replaces Helen on cafe FF&E only | NY | NY resolve | **FAIL** empty Review (harness vacuous PASS) | AI_EXTRACT |
| 43 | Power-on passed; start cafe snag | complete + update | none | **FAIL** empty Review | AI_EXTRACT |
| 44 | Hall snag first pass | update Hall only | none | **FAIL** empty Review | AI_EXTRACT |
| 45 | Leo Mensah name-only, late introduction | create person | none | **FAIL** empty Review | AI_EXTRACT |
| 46 | Leo owns fire doors + dated reminder | resp + todo | none | **FAIL** empty Review | AI_EXTRACT |
| 47 | Year-end wrap + the Wards cabinet date | mixed complete/no-op/create | none | **FAIL** empty Review | AI_EXTRACT |
| 48 | PC confirmed — must not duplicate | no-op | none | **PASS** still one PC row | — |
| 49 | PC glossary restated; Leo responsibility idempotent | knowledge; no extra resp | none | **FAIL** empty Review | AI_EXTRACT |
| 50 | Close-out paste | knowledge + NY cancel + updates | none | **FAIL** empty Review; nothing written | AI_EXTRACT |

## E. Integrity accounting

Lead-adjusted (not raw harness):

| Metric | Count |
| --- | --- |
| Expected writes (frozen, approx) | ~70 domain ops across 50 captures |
| Missing writes | High — responsibilities 0; late-cycle empty Reviews; C5/C16 creates not rematerialized |
| Wrong writes | **1 class: C18 DDA ramp resolved** |
| Unexpected writes | C26 new `FF&E samples delay` instead of completing the sample-review todo. C17 `Prepare cost report` was an expected C17 write that the harness attributed to the C18 window (hydrate lag), not a C18 invent. |
| Unexpected deletes | **0** |
| Duplicate people | **0** |
| ID / relationship corruption | **0** (IDs stable) |
| Excluded-candidate leaks | **0** (C22 tape stayed out) |
| Silent failures | C15, C32–C34, C37, C39–C50 empty Review; C18 wrong write with HTTP 200 |

**Zero-tolerance breach:** C18 silent/wrong-target write.

Final people: Helen, James, Nadia, Tomos, Mei, **Chris Ward**. Missing: Jamie, Jamie Okoye, Leo Mensah.  
Final todos: 12 (originals still open including asbestos).  
Final risks: M&E first-fix **open**; DDA ramp **resolved** (wrong).  
Final dates: PC **2026-12-18** (third slip missing); Saturday catch-up still present; walk-through 2026-10-23.  
Responsibilities: **0**.

## F. Ambiguity accounting

| Metric | Count / note |
| --- | --- |
| Genuine ambiguity planned (frozen `ambiguous` / mixed NY ops) | C9, C10 huddle, C12, C15, C20, C23, C27, C29, C30 programme, C32, C37, C38 banquettes, C40 retire, C41, C42, C50 cancel |
| Correct Needs You (card shown) | C9, C12, C23, C27, C29 |
| False Needs You | C5 timber-floor create; C11 Chris create; C16 snag-list creates; C8 Tomos known person |
| Ambiguity guessed incorrectly | **C18** Ready-applied DDA instead of Needs You / unmatched create |
| Safe siblings blocked | C16 both creates blocked as NY; C50 entire paste empty |
| Expected NY with empty Review | C32, C37, C40, C41, C42 — **not fail-closed, silent** |

## G. Review behaviour

| Interaction | Result |
| --- | --- |
| Edits | C17 date picker attempted (NY date); no free-text title edit exists |
| Exclusions | C22 tape excluded; Apply count 2→1; tape not written |
| Re-inclusions | **None possible** — no control (D-025 / PRODUCT_MODEL_GAP) |
| Needs You resolutions | Not executed where cards said “Create a new …” (C5/C11/C16) — harness followed frozen “none” |
| Needs You exclusions | C9 exclude attempted |
| Apply-count errors | None observed on C22 |
| Pre-Apply canonical writes | C18 flagged `preApplyCanonicalWrite` (cost-report / DDA) |

## H. Persistence / durability

| Check | Result |
| --- | --- |
| Hard reload after New Project | Facts survived; responsibilities never existed |
| Reload after C3 | PC 18 Dec persisted |
| Reload after C5/C10/C20/C30/C40/C50 | C10/C30 todos appeared in reload snapshot (CACHE/HYDRATE) |
| Browser restart / re-login | Not separately executed (time); hard reloads + project reopen used |
| Sibling fingerprint | Unchanged after every Apply |
| Receipt / idempotency | No duplicate people; C21/C48 no extra PC date |

## I. Projection findings

Harness recorded **0** formal projection mismatches (token search is coarse). Manual/canonical inspection:

- People / To Do / Issues / Knowledge Centre showed the same thin truth as DB (no extra ghosts).
- Responsibilities never appeared on People (matches 0 rows).
- Catch Me Up / Timeline not deeply audited this run.
- DDA ramp shows resolved in Issues — agrees with wrong DB write.
- Saturday catch-up still on Timeline — agrees with non-delete.

## J. Failure families

1. **Wrong-target Apply (C18)** — freq 1; **integrity block**; user sees DDA closed, timber-floor never existed; repair VALIDATE+IDENTITY+APPLY.  
2. **False Needs You / unmatched create (C5, C11, C16)** — freq 3+; user must click Create-new; repair VALIDATE rematerialize.  
3. **Identity reject of known named people (C8, C24, C29)** — freq 3; fail-closed cards; repair IDENTITY.  
4. **Responsibility persist gap (Organise + many captures)** — freq continuous; People look empty of ownership; repair APPLY/PERSIST (D-051).  
5. **Empty Review late-cycle (C32–C50 cluster)** — freq ~15; silent omission; repair AI_EXTRACT + surface PRODUCT_MODEL_GAP.  
6. **Hydrate lag (C10, C30)** — freq 2; first paint missing then reload has it; repair HYDRATE.  
7. **Product-model gap not voiced (C32, C40)** — freq 2; legal no-op without Needs You; repair REVIEW_UI.  
8. **Update→Create (C26)** — freq 1; duplicate todo family; repair IDENTITY.  
9. **Harness/test scoring (C0 snag token, C22 title, vacuous NY PASS)** — not product bugs.

## K. V1 assessment

1. **Would a normal user trust Lume with an ongoing project?** Not yet. Early creates/dates often work; ownership never sticks; later captures increasingly disappear; one Apply wrote the wrong risk.  
2. **Did accumulated truth remain stable?** IDs and existing rows were not deleted or duplicated. Content drifted: PC stuck at 18 Dec; DDA wrongly resolved; late people never entered.  
3. **Did Lume fail safely when uncertain?** When a Needs You **card** appeared, usually yes. Empty Review is **not** fail-safe. C18 converted uncertainty into a wrong Ready write.  
4. **Silent wrong writes?** **Yes — C18.**  
5. **Unexpected destructive mutations?** No deletes. Wrong status change on DDA is a destructive *semantic* mutation.  
6. **Biggest remaining real-user weakness?** Unmatched-create + wrong-target Apply, then responsibility vacuum, then silent empty Review on later/heavier pastes.  
7. **Block V1?** **Yes:** C18 wrong-target write. Responsibility vacuum and silent omissions are also V1-blocking for “ongoing project” trust.  
8. **Fix next, in order:** (1) rematerialize unmatched creates / do not Ready-apply a *different* entity when the intended target was never created; (2) persist responsibilities from Organise and Capture; (3) surface Needs You (or explicit unsupported) instead of empty Review for cancel/retire/late people/heavy close-out; (4) stop UUID-not-enough on full-name restatements; (5) first-paint after Apply.

## L. Safety confirmation

- Only dedicated E2E projects were mutated: official `8537b7cf-1b50-453e-af64-2b21e2d29e90`; aborted `469539ae-599f-4bc1-840e-26116d90d023` and `afe2bee4-67c1-40bf-a1f2-a0ce5944b07c`.  
- No customer project was listed or fingerprinted as changed. SQL: the only `projects` row in this workspace with `updated_at` in the official run window is the official long-run project.  
- No direct SQL canonical writes. Post-run inspection used `SELECT` / `information_schema` only.  
- No product code was changed. Harness-only compose-input + New Capture order.  
- Frozen `frozen-manifest.ts` / `SPEC.md` expectations were **not** rewritten after observing Lume.  
- Projects left in place for forensics; no cleanup.

## Canonical Database Audit

Full cadence write-up: [`CANONICAL-DB-AUDIT.md`](./CANONICAL-DB-AUDIT.md).  
Machine snapshots: [`db-audit.json`](./db-audit.json), [`db-checkpoints.json`](./db-checkpoints.json), [`sql-dump.json`](./sql-dump.json).

Independent SQL was run **after** the official 50-capture run (the live-SQL cadence requirement arrived as a follow-up). Intra-run checkpoints used the hosted load API + UI reload. This audit proves those API snapshots match production Postgres, and that the production app and the inspected database are the same project.

### Environment

| Item | Value |
| --- | --- |
| Production app | `https://betterprojectmanager.vercel.app` |
| Public Supabase URL in production JS | `https://exfftrxxinhduogcluce.supabase.co` |
| Supabase project name | `Lume` |
| Supabase project ref | `exfftrxxinhduogcluce` |
| Database host | `db.exfftrxxinhduogcluce.supabase.co` |
| Correspondence proof | Production login bundle chunk embeds that URL; MCP `list_projects` returns the same ref as the only active Lume project. `ev-stop-finder` and `neurodiverseapp` were not queried for data. |

### Checkpoints

Intra-run hosted-API snapshots exist for State 0 and every Capture. Post-run SQL was compared to State 0 + State final + C18 delta.

| Checkpoint | Expected (ledger) | Actual (SQL) | Unexpected delta | Result |
| --- | --- | --- | --- | --- |
| After New Project | 5 people, 3 todos, 2 open risks, 3 dates, responsibilities | 5 / 3 / 2 open / 3 / 0 resp | responsibilities missing | FAIL |
| After first reload | same | State 0 API IDs = SQL | none vs API | PASS B=C |
| After C5 | timber-floor risk; asbestos done | still 2 open risks; asbestos open; +dashboard todo | missing create/complete | FAIL |
| After C10 | M&E date + isolate + photo | M&E date + 7 todos (isolate as todo) | domain mismatch | FAIL |
| After C15 | Saturday + asbestos done | Saturday present; asbestos open | missing complete | FAIL |
| After C18 (high-risk) | timber-floor resolved; DDA open | **DDA `fb74aa0f-…` resolved**; no timber-floor | wrong-target update | **FAIL integrity** |
| After C20 | walk-through 23 Oct | `c0deb9c6-…` `2026-10-23` | DDA already wrong | date PASS |
| After C25 | snag resp; banquettes; sample done | 10 todos; extra FF&E-delay todo; 0 resp | update-as-create | FAIL |
| After C30 | Chris + drawing + mock-up + Nadia away | 6 / 12 / 2 / 6 / 0 — those rows exist | 0 resp | PARTIAL |
| After C35 / 40 / 45 / 50 | further creates / NY / close-out | **SQL hash identical to C30** (`c1347c9b3c48`) | no writes after 22:10:11Z | FAIL silent |
| Final hard reload | same as C50 SQL | `state-final.json` IDs match live SQL | none | PASS B=C |

### Integrity totals (SQL, official project only)

| Metric | Count |
| --- | --- |
| Unexpected Creates (vs frozen ledger) | several (cost report; FF&E samples delay as new todo; extra containment knowledge) |
| Unexpected Updates | **1 integrity:** DDA ramp resolved |
| Unexpected Removes | **0** |
| Missing expected writes | high (responsibilities 0; Jamie/Leo never created; C33 PC move; asbestos never completed; many late captures) |
| Duplicate canonical rows | **0** people; C26-class extra FF&E todo is a second current todo, not an ID clone |
| Changed stable IDs | **0** — all State 0 IDs still present |
| Broken relationships | **0** foreign-key orphans detected; entity IDs do not appear on other projects |
| Cross-project rows | **0** |
| Excluded-candidate leaks | **0** (C22 tape never present) |
| Unresolved Needs You leaks | **0** (empty Reviews wrote nothing; false NY cards were not Apply-resolved) |
| Receipt mismatches | **16** create receipts; **0** receipts on updates of existing State 0 PC / walk-through / DDA / FF&E todo. History events exist for those updates. |

### Long-run durability

Truth created at State 0 is still in the database with the same IDs after Capture 50. Dates that were legally updated (PC → 18 Dec, walk-through → 23 Oct) stayed on those rows. Saturday catch-up was **not** deleted. DDA status is the one durable corruption. Responsibility and later-cycle people never accumulated.

### Three-way consistency

| Case | Classification |
| --- | --- |
| Expected ledger ≠ database | Product / extract / identity failures (majority of FAILs) |
| Database = harness API snapshot | Persistence path of what *did* Apply is trustworthy |
| Database = UI after reload | No first-paint lie at the final snapshot; C10/C30 were earlier hydrate lags |
| Knowledge risk prose still `current` after DDA resolve | D-030 leftover Knowledge vs domain status |

### Final statement

**At the end of the 50-Capture production lifecycle, the canonical database was not in the state expected from the user's approved actions.**

Every discrepancy:

1. No structured responsibilities (Organise + later ownership captures).  
2. Timber-floor services risk never created (C5).  
3. DDA ramp `fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3` resolved (C18) — **wrong target**.  
4. Practical completion stayed `2026-12-18` instead of `2027-01-08` (C33).  
5. Asbestos todo still `done=false` (C15).  
6. Jamie / Jamie Okoye / Leo Mensah never inserted.  
7. Cafe/Hall snag-list todos never created (C16).  
8. Many late captures (C32, C34, C37, C39–C50) produced no SQL delta.  
9. Extra current todos: `Prepare cost report`, `FF&E samples delay` (update-as-create).  
10. People knowledge rows remain `Name ()`.  
11. DDA Knowledge body still current after the risk was resolved.  
12. Updates of existing rows lack `capture_apply_receipts` even when `history_events` recorded them.

## Verdict

The programme succeeded as **diagnostic evidence**. The product did **not** succeed as a 50-capture ongoing project. Zero-tolerance integrity failed at C18. Independent SQL confirms the harness did not invent that write, and did not hide a different database. Structural families above should drive the next work, not a green score.
