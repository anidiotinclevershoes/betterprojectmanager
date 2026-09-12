# Canonical Database Audit — `lr-20260912T2212Z`

Independent read-only inspection of production Postgres. The browser UI is not treated as proof.

Live intra-run SQL was not available during the official Playwright pass. This audit reconstructs every required checkpoint from:

- production JS ↔ Supabase correspondence (re-proved);
- State 0 / final hosted-API slices;
- a timestamped `SELECT` dump of the dedicated project (`sql-dump.json` + `sql-later.json`);
- `created_at` / `updated_at` plus State 0 values for fields that later changed.

No `INSERT` / `UPDATE` / `DELETE` / RPC mutation was issued. Incorrect DDA status was left as written.

Machine tables: `db-audit.json`, `db-checkpoints.json`, `sql-dump.json`, `sql-later.json`.

## Environment

| Item | Value |
| --- | --- |
| Production deployment | `https://betterprojectmanager.vercel.app` (`/login` 200, title “Lume — Lighting your way.”) |
| Supabase project name | `Lume` |
| Supabase project ref | `exfftrxxinhduogcluce` |
| Database host | `db.exfftrxxinhduogcluce.supabase.co` (eu-west-1, ACTIVE_HEALTHY) |
| Correspondence proof | `npm run audit:hosted-longrun-db -- --prove-env` fetches production login JS and finds exactly one `*.supabase.co` host: `exfftrxxinhduogcluce`. MCP `get_project` on that ref returns name `Lume`. `ev-stop-finder` and `neurodiverseapp` were not queried for row data. |

**The production application exercised by the browser writes to the same hosted database that was inspected.**

## Checkpoints

Expected = frozen ledger fold (creates/updates that should have landed by then).  
Actual = reconstructed SQL as-of that timestamp.  
UI = hosted-API slice at State 0 / after that Capture where stored.

| Checkpoint | Expected entities | Actual entities (SQL) | Unexpected delta | Result |
| --- | --- | --- | --- | --- |
| After New Project | 5 people, 3 todos, 2 open risks, 3 dates, responsibilities | 5 / 3 / 2 open / 3 / **0 resp** | responsibilities missing | **FAIL** B=C, A differs |
| After first hard reload | same as New Project | same IDs as State 0 API | none vs API | **PASS** B=C |
| After C5 | +dashboard; asbestos done; timber-floor **risk**; FF&E due 14 Oct; cafe FF&E responsibility | 5 / 4 / 2 open / 3 / 0. Asbestos **open**. No timber-floor row. FF&E due 14 Oct present. Dashboard present. | missing risk + complete + responsibility | **FAIL** B=C, A differs |
| After C10 | +M&E first-fix date; photo todo; water isolate date; NY huddle | 5 / 7 / 2 / 4 / 0. M&E first-fix **2026-10-13** present. Ceiling RAMS + water-isolate **todos** (not isolate milestone). No photo todo. | domain mismatch; missing NY card is UI | **FAIL** B=C, A differs |
| After C15 | +Saturday date; asbestos done; timber knowledge | 5 / 7 / 2 / 5 / 0. Saturday **2026-10-17** present. Asbestos still open. | missing completes / knowledge | **FAIL** |
| After C18 (high-risk) | timber-floor resolved; DDA **unchanged open** | DDA `fb74aa0f-…` **resolved** at 22:07:36Z. No timber-floor row. Cost-report todo exists (C17). | **wrong-target update** | **FAIL integrity** |
| After C20 | walk-through **2026-10-23**; mixed extras | walk-through `c0deb9c6-…` **2026-10-23**. 10 todos, 5 dates, DDA still resolved. | DDA already wrong; mixed extras incomplete | **FAIL** (date itself PASS) |
| After C25 | +snag responsibilities; banquettes risk; sample review done | 5 / 10 / 2 / 6 / 0. Second walk-through present. Sample review still open. Extra `FF&E samples delay` todo. No banquettes risk. | update-as-create; missing resp | **FAIL** |
| After C30 | +Chris Ward; cafe drawing; DDA mock-up; Nadia away; containment | 6 / 12 / 2 / 6 / 0. Chris Ward `7c3ea00b-…`. Drawing + mock-up + Nadia away + containment knowledge present. | responsibilities still 0 | **PARTIAL** |
| After C35 | +second DDA visit date | **identical SQL hash to C30** | missing milestone | **FAIL** silent |
| After C40 | snag updates; asbestos knowledge retire NY | **identical SQL hash to C30** | no writes | **FAIL** silent |
| After C45 | +Leo Mensah | **identical SQL hash to C30** | missing person | **FAIL** silent |
| After C50 | close-out knowledge + dates | **identical SQL hash to C30** | no writes after 22:10:11Z | **FAIL** silent |
| Final hard reload | same as C50 SQL | `state-final.json` IDs/values match live SQL | hash encoding differs (kind/section); **no extra/missing IDs** | **PASS** B=C |

Three-way at every cadence checkpoint after C30 is **B=C, A differs** (empty Review, database unchanged, UI after reload agrees with that empty database).

## Integrity totals (dedicated project only)

| Metric | Count |
| --- | --- |
| Unexpected Creates | `FF&E samples delay`; `Prepare cost report` was a C17 expected write (late to the C18 API window) |
| Unexpected Updates | **1:** DDA ramp `open→resolved` |
| Unexpected Removes | **0** |
| Missing expected writes | High (see FIRST-RUN §E) |
| Duplicate canonical rows | **0** people. Extra FF&E todo is a second current title, not an ID clone |
| Changed stable IDs | **0** — all State 0 IDs still present at C50 |
| Broken relationships | **0** orphans; entity IDs do not appear on other `project_id`s |
| Cross-project rows | **0**. Only this project’s `projects.updated_at` moved in the official run window |
| Excluded-candidate leaks | **0** (no biscuits / tape / plant rows) |
| Unresolved Needs You leaks | **0** |
| Receipt mismatches | 16 create receipts. 0 receipts on updates of existing PC, walk-through, DDA, FF&E sample-review rows. History events exist for those updates |

## Long-run durability

Truth created at New Project is still in Postgres after Capture 50 with the same IDs.

| State 0 ID | Still present at C50 | Semantic drift |
| --- | --- | --- |
| Helen / James / Nadia / Tomos / Mei | yes | names unchanged |
| RIBA pack / asbestos chase / FF&E sample review | yes | asbestos never completed; FF&E gained due 14 Oct |
| M&E first-fix risk | yes | still `open` |
| DDA ramp | yes | **wrongly `resolved`** |
| Mobilisation 6 Oct | yes | unchanged |
| Walk-through | yes | 20 Oct → 23 Oct (C20, intended) |
| PC | yes | 12 Dec → 18 Dec (C3); **not** 8 Jan (C33) |

No old Knowledge bodies disappeared. No earlier dates reverted. Responsibilities never existed to be overwritten.

After C30 the canonical hash is frozen (`c1347c9b3c48…`). Captures 31–50 produced **no SQL delta**.

## Three-way consistency

| Pattern | Where | Earliest boundary |
| --- | --- | --- |
| B=C, A differs | Majority of checkpoints | VALIDATE / AI_EXTRACT / PRODUCT_MODEL_GAP |
| B=C, A differs + wrong write | C18 | IDENTITY / APPLY |
| A=B, C differs (brief) | C10 / C30 first paint | HYDRATE — reload then matched SQL |
| A=C, B differs | **Not observed** | — |
| A B C all differ | **Not observed** | — |

## Review-specific SQL

C18 Review showed only “UPDATE RISK Outstanding DDA… Open → Resolved”. SQL after Apply: that risk’s `updated_at` 22:07:36Z, status `resolved`. No timber-floor row was created before or after. C22 tape never appears in `todos`. No receipt for the DDA update.

Pre-Apply SQL for every Review was not captured live. C18 `preApplyCanonicalWrite` in the harness flagged `Prepare cost report`, which SQL timestamps to 22:07:29Z (C17 batch), seven seconds before the DDA update.

## Person-identity SQL

| Capture | Expected | SQL |
| --- | --- | --- |
| C11 Chris (first name) | create name-only Chris | no row |
| C28 Chris Ward | create Chris Ward | `7c3ea00b-aae3-41d7-a44d-a9f9b611fbb7` — only extra person. No duplicate Helen/Chris |
| C34 Jamie | create Jamie | no row |
| C39 Jamie Okoye | create Jamie Okoye | no row |
| C45 Leo Mensah | create Leo Mensah | no row |

No sibling person mutated. No responsibility attached to anyone (`kind=responsibility` count 0).

## Destructive-operation SQL

No supported Remove was expected. C32 cancel Saturday: row `7c30dc1b-…` still present with `2026-10-17`. **No unexpected deletion. STOP not triggered.**

## Final statement

**At the end of the 50-Capture production lifecycle, the canonical database was not in the state expected from the user's approved actions.**

Discrepancies:

1. 0 structured responsibilities.  
2. No timber-floor services risk.  
3. DDA ramp `fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3` resolved (C18 wrong target).  
4. Practical completion `8e622129-…` is `2026-12-18`, not `2027-01-08`.  
5. Asbestos todo still open.  
6. No Jamie / Jamie Okoye / Leo Mensah.  
7. No Cafe / Hall snag-list todos.  
8. No SQL writes after 22:10:11Z (C31–C50).  
9. Extra current todo `FF&E samples delay`.  
10. People Knowledge remains `Name ()`.  
11. DDA Knowledge body still `current` after the risk resolved.  
12. Updates of existing State 0 rows lack `capture_apply_receipts`.

Future runs must prove environment **before** New Project and take live SQL at this cadence when service-role credentials are present (`e2e-hosted-longrun/db-sql.ts`, SELECT only).
