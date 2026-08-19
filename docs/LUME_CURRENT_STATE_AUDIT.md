# Lume Current-State Audit

**Facts only — no architecture recommendations, no implementation plan.**  
**Audience:** external product/architecture review.  
**Generated from repository state on `main`.**

---

## 1. Repository / deployment state

### Commits / branches

| Item | Value |
| --- | --- |
| Production branch (repo `main`) | `bbe1ce488708b4df2181b8cd778e49df4679fe41` |
| Tip message | Merge PR #40 — Evals expand/collapse all |
| This audit working branch | `cursor/current-state-audit-c9f3` (docs only; based on `main`) |

**Deployed production environment** (Vercel/Supabase) is not observable from this agent. Treat “production today” below as **what is merged on `main` and therefore deployable**, unless an env flag overrides behaviour.

### Recent intelligence-related PRs

| PR | Topic | State on `main` |
| --- | --- | --- |
| #35 | Phase 2C.1 trust intelligence | **Merged** |
| #36 | Phase 2C.2 context integrity | **Merged** |
| #37 | Model tidy + token breakdown | **Merged** |
| #39 | Canonical Truth Slice 1 | **Merged** |
| #40 | Evals expand/collapse extras | **Merged** |
| #38 | Architecture review (docs) | **Open draft** — not product code |
| #41 | Slice 1 regression diagnostic (docs) | **Open draft** — not on `main` |

Older open drafts (#2, #11–#22, etc.) predate current intelligence stack; not treated as current product state.

### Migrations in repo

All under `supabase/migrations/`:

1. `20260812002748_workspace_schema.sql`  
2. `20260812002749_tenant_rls.sql`  
3. `20260812195500_fix_grants_and_membership_helper.sql`  
4. `20260812203000_phase2_ensure_personal_workspace.sql`  
5. `20260813140000_billing_foundation.sql`  
6. `20260815160000_project_intelligence_snapshots.sql`  
7. `20260817200000_eval_runs.sql`  
8. `20260818230000_knowledge_canonical_metadata.sql` ← Slice 1 additive columns on `knowledge_items`

Whether #8 is applied on the live Supabase project is **not verified here**.

### Feature flags affecting intelligence behaviour

| Flag | Production default (unset) | Effect |
| --- | --- | --- |
| `LUME_CANONICAL_TRUTH` | **off** | Canonical Tell Me read path; evals force on via `useCanonicalTruth: true` / `forEval` |
| `OPENAI_MODEL` | pin `gpt-4o-mini-2024-07-18` | Chat model (alias `gpt-4o-mini` remapped to pin) |
| `OPENAI_EVAL_MODEL` | unset → same as above | Eval-only override when set + `forEval` |
| `OPENAI_API_KEY` | required for live AI | Absent → local Tell Me / Capture fallbacks |
| `LUME_EVAL_ALLOWED_EMAILS` | empty → evals denied | Evals access |
| Rate limits `LUME_RATE_LIMIT_*` | Capture/Coach/Tell Me 60/h; Transcribe 40; New project 30 | HTTP rate limits |

### Distinction

| Layer | What |
| --- | --- |
| **Production today** | 2C.1, 2C.2, model tidy, Slice 1 **code** on `main`; Tell Me uses **legacy** context path unless `LUME_CANONICAL_TRUTH=1` |
| **Implemented but flagged/off** | Canonical serializer as default Tell Me path; evals always enable canonical |
| **Proposed/documented only** | Architecture review (#38), regression diagnostic (#41), Knowledge Centre product rename, Advise/Capture/Tell Me north-star redesign |

**Naming:** UI strip shows **Advise**; implementation is **Coach** (`mode: "coach"`, `/api/coach`, drawer “Coach”). No Tell Me rename/removal on `main`.

---

## 2. Current user flow

Entry: signed-in project page `src/app/projects/[id]/page.tsx` → intelligence strip (`CaptureCoachRow` + `IntelligenceLoopStrip`) + workspace frames + `ProjectKnowledgeBrief`.

### Capture

| Aspect | Fact |
| --- | --- |
| What user sees | “Capture anything”; typed or recorded input; Analyse; post-analyse locked transcript + review panels |
| What can be captured | Free-text notes; voice via `/api/transcribe` (Whisper) then text analysis |
| What AI does | `POST /api/capture` → OpenAI tidy/findings (or local fallback) → findings pipeline → suggestions |
| Review UI | What Lume Understood; Suggested changes (Ready / Needs Review / Unmatched); Remember for later; Why panels |
| Requires confirmation | Primary path: user Approves / Apply Ready / Remember before writes |
| Writes | Via `applyOne` / `approveReady` / Remember: todos, knowledge bullets, timeline, risks (incl. `[Resolved]`), memory, recommendations |
| Destructive / superseding | Todo complete/delete/update; risk resolve rewrites bullet with `[Resolved]`; knowledge merge can prefer incoming wording (cap 8/section) |
| After approval | Item removed from pending; state updated; supabase insert paths for bullets/todos/timeline/memory when in supabase mode |

### Knowledge (`ProjectKnowledgeBrief`)

| Aspect | Fact |
| --- | --- |
| Contents | Sections: Current position, Decisions, Risks & blockers, People & context, Waiting & open loops |
| Editable | Full edit mode (textarea lines) → `replaceKnowledge`; quick-add → `addKnowledgeBullet` |
| People | Table via heuristic split; `@Name · detail` via `PersonEntity` |
| Dates | Not first-class entities in Knowledge; dates appear as prose or in Timeline/Todo frames |
| Collapse | Per-section collapse in `sessionStorage` |
| Search | Client substring search + Ask Tell Me |
| Structured panel | If `knowledge.structured` has confirmed responsibilities: list + EpistemicChip + EvidenceReveal |
| Duplication | Same themes also in Risks frame, Todos, Timeline, Tell Me context, snapshots |
| Evidence/history | EvidenceReveal only when structured provenance present; full History is a separate `/history` page |

### Tell Me

| Aspect | Fact |
| --- | --- |
| Open | Strip “Tell Me”; Knowledge “Ask Tell Me”; event `lume:open-tell-me` |
| Question UI | Textarea + Ask Lume; “Uses AI” hint |
| Suggestions | Up to 6 buttons: canonical templates first, then legacy heuristics — **no AI** |
| Session | Last turns kept; cleared on project switch / New |
| Request | `POST /api/tell-me` → `answerTellMeQuestion` |
| Answer render | Confidence; Answer; optional Lume noticed; optional Needs confirmation (+ Confirm owner); sources; freshness/Refresh |
| Mutation from Tell Me | None in answer engine; Confirm owner is separate store write |
| Project switch | Conversation/answer cleared |
| Refresh | `POST /api/tell-me/refresh` → AI or deterministic snapshot; client `localStorage` cache `lume-tell-me-snapshots-v1` |

### Advise / Coach

| Aspect | Fact |
| --- | --- |
| UI name | **Advise** on strip |
| Code name | Coach (`CoachDrawer`, `CoachSessionContext`, `/api/coach`) |
| Open | Strip; Tell Me “Ask Coach”; event `lume:open-coach` |
| Input | Project bundle / coach context from MissionState |
| Shared truth | Same MissionState; separate prompt from Tell Me |
| Mutations | User can accept actions into todo / suggestion / knowledge |

---

## 3. Review-everything behaviour (Capture)

Primary Capture analyse path does **not** auto-write knowledge/todos. User must Approve / Apply Ready / Remember.

| Type | Seen before write? | Edit in review UI? | Reject? | Confidence/review state? | Silent apply on Analyse? | Overwrite/supersede? | Provenance retained? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Action / nudge (todo) | Yes | Target/project/kind corrections; free-text content edit API unused in UI | Dismiss | Ready / Needs Review / Unmatched + Why % | No | Update can replace todo title/detail/due | Why evidence quotes |
| Risk | Yes | + Resolve | Dismiss | Same | No | Resolve → `[Resolved]` rewrite or append | Why |
| Milestone | Yes | Corrections | Dismiss | Same | No | Append timeline | Why |
| Decision | Yes (or Remember panel) | Corrections / Remember | Dismiss / Don’t remember | Same | No | Merge into decisions (cap 8) | Why / remember copy |
| Stakeholder | Yes | Corrections | Dismiss | Same | No | People bullet merge (not always `stakeholders` table) | Why |
| Knowledge bullet | Remember panel | Remember / Don’t / Remember All | Don’t remember | Static remember why | No | Section merge | Limited |
| Memory | Remember panel | Remember | Don’t | Same | No | Prepend memory | Via memory record |
| Meeting | Yes | Corrections | Dismiss | Same | No | Often recommendation/todo, not meeting row update | Why |

**Paths that can write without Capture review UI**

| Path | Fact |
| --- | --- |
| Manual Knowledge quick-add / edit | User-initiated, no AI |
| Confirm owner | User-initiated from Tell Me Needs confirmation |
| Coach accept | User-initiated |
| `replaceKnowledge` / `updateKnowledgeSection` | Local state; **no** full supabase rewrite |
| Orphan `CaptureBar` + `captureWithAI` → `mergeCapture` | Exists in codebase; **not mounted** in AppShell/project page |
| Local heuristic `extractKnowledgePatchFromText` | Used when AI not configured / some merge paths |
| New project onboarding | Separate review (`ProjectSetupReview`) then persist |

---

## 4. Where project truth exists today

| Store | Purpose today | Authoritative? | Written by | Read by | Duplicates what? |
| --- | --- | --- | --- | --- | --- |
| `projects` | Name, code, summary, focus, status, dates | Project meta yes | Create/clone/API | Everywhere | Focus vs Knowledge `now` |
| `stakeholders` | Name/role on project | Partial | New project persist; Confirm owner may add in-memory | Context / UI | Knowledge `people` bullets |
| `knowledge_items` | Section bullets (+ Slice 1 metadata columns) | Primary brief | Capture apply, quick-add, confirm owner | Knowledge UI, Tell Me, Capture | Risks table, stakeholders |
| `ProjectKnowledge.structured` (client overlay) | Canonical items in memory | Only when populated | Confirm owner; load from DB meta | Canonical serialize, suggestions, Knowledge panel | People bullets |
| `todos` | Actions / waiting / chase | Task truth | Capture, Coach, frames | Frames, Tell Me, canonical waiting | openLoops bullets |
| `risks` | Risk rows | Partial | Persist on risk bullet create; load folds open titles into knowledge.risks | Load fold | Knowledge risks |
| `milestones` | Timeline dates | Date list | Capture apply, addTimelineItem | Timeline, Tell Me | Project date fields |
| `memories` | Capture narratives | Evidence archive | Capture remember/apply | Coach, history-ish | History events |
| `capture_sessions` | Session JSON | Session audit | Capture analyse persist | Captures page | — |
| `history_events` | Event log | Audit | Many mutations | History page; legacy Tell Me History | Memories / captures |
| `project_intelligence_snapshots` | Compact Tell Me cache | Cache only | Refresh API | Tell Me freshness | Knowledge summary |
| `recommendations` | Coaching suggestions | Non-canonical | Capture/Coach | UI | Risk-like items in Capture context |
| `releases` / `meetings` | Release train / meetings | Those domains | Store/load | Context builders | — |
| `coach_sessions` | Coach markdown history | Session | Coach | Coaching page | — |
| `workspace_usage` | Analysis **counts** | Usage count | Capture analyse increment | Soft limits UI | Not tokens |
| Client `localStorage` / `sessionStorage` | Local persist / Capture session / Tell Me snapshots / Knowledge collapse | Mode-dependent | Client | Client | Server state when supabase |

Runtime behaviour: MissionState is the in-app cache; multiple stores can hold overlapping semantics; Tell Me (legacy) reconciles several channels each request.

---

## 5. Canonical truth work (Slice 1 / PR #39)

### Implemented on `main`

- Migration columns on `knowledge_items`: `kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta`, `provenance`
- `ProjectKnowledge.structured?: CanonicalTruthItem[]`
- `deriveLegacyStructured` — maps section strings to items with `epistemic: null` (legacy)
- `serializeCanonicalTruth` — `CURRENT FACTS` / milestones / waiting; History only if historical question
- Flag `LUME_CANONICAL_TRUTH` — **production default off**; evals force on
- `findUnknownOwnerHints` / KNOWN GAPS for ownership questions without confirmed `responsibility`
- `TELL_ME_SYSTEM_CANONICAL` asks for `answer` / `noticed` / `needsConfirmation`
- Confirm owner → confirmed scoped responsibility + people bullet + provenance
- Deterministic `buildCanonicalSuggestions` merged into Tell Me suggestions
- UI: PersonEntity, EpistemicChip, EvidenceReveal, ConfirmOwnerDialog, Tell Me three blocks

### PR #41 diagnostic findings (documented on open branch; factual observations from live PR38 run)

| Finding | Fact |
| --- | --- |
| Pass | 23/45 vs PR37 30/45; trust/critical still 0 |
| Tokens | 37,404 vs 49,157 (~−24%); ratio ~1.74× vs ~2.29× |
| Misses | Contacts/roles not `owns`-shaped; joint ownership not typed; compound risks compressed; candidates/conflicts lost; capture truths not in latest stage |
| Polarity | `"No record that Tom owns…"` extracted as `"Tom owns…"` |
| Quiet Alex | Abbreviated Alex line present in CURRENT FACTS; model still answered unspecified |
| Multi-hop | Flat facts; dependency chains not linked |
| Telemetry | Bucket headers expect legacy section names; `CURRENT FACTS` unbucketed |

---

## 6. Current AI call map

| Surface/action | Route/function | Model | Input | Output | Can mutate state? | Explicitly triggered? |
| --- | --- | --- | --- | --- | --- | --- |
| Capture analyse | `POST /api/capture` → `tidyAndCoachWithOpenAI` | `resolveOpenAIChatModel()` | Capture text + ranked context | Findings → suggestions | Only after user approve | Yes — Analyse |
| Transcribe | `POST /api/transcribe` | `whisper-1` | Audio | Text | No (feeds Capture) | Yes |
| Tell Me ask | `POST /api/tell-me` → `answerTellMeQuestion` | Same (eval may use eval resolver) | System + prompt block + conversation | JSON answer | No (Confirm owner separate) | Yes — Ask |
| Tell Me refresh | `POST /api/tell-me/refresh` → snapshot AI or deterministic | Chat if AI refresh | Project state | Snapshot | Snapshot store only | Yes — Refresh |
| Advise/Coach | `POST /api/coach` | Same | Coach context | Streaming markdown + actions | Only if user accepts action | Yes |
| New project | `POST /api/new-project` (2 chat calls) | Same | Brief / assemble | Draft project content | After onboarding confirm | Yes |
| Golden capture (dev) | `/api/dev/golden-capture` | Same | Test fixtures | Analysis | Dev tooling | Dev |
| Evals Lume | Runner → Tell Me | Eval model | Fixture MissionState | Answers | No | Operator |
| Evals GPT baseline | `runGptBaseline` | Eval model | Context document + Q | Answer | No | Operator |

No background cron AI in repo. Snapshots only on Refresh. Suggestions/autocomplete: **no** OpenAI.

---

## 7. Tell Me request — exact current payload

### Legacy production path (`LUME_CANONICAL_TRUTH` unset/off)

**System:** `TELL_ME_SYSTEM` — read-only recall; JSON `{ answer, confidence, sourceIds, capturePrefill }`; ownership/current-vs-history/epistemic/conversation-authority rules. Does **not** request `noticed` / `needsConfirmation`.

**User content (logical):**

1. `QUESTION` / `SCOPE`  
2. Optional **PROJECT INTELLIGENCE SNAPSHOT** (if client snapshot matches project)  
3. Per project **PROJECT RECORDS**: Knowledge by section labels (Current position → Decisions → Waiting → People → Risks), then To Dos, Risks (deduped vs knowledge), Milestones, History, Meetings, Releases, Stakeholders — lines like `- [id] title …`  
4. Freshness block  
5. Up to last **6** conversation turns  

**Selection / limits (facts):**

| Location | Limit | What |
| --- | --- | --- |
| `capture/context.ts` `DEFAULT_CAPTURE_CONTEXT_LIMITS` | openTodos 20, completed 8, meetings 8, milestones 10, risks 8, stakeholders 12, knowledge 16, history 10, releases 3 | Capture/Tell Me shared ranking caps |
| `tellMeContextLimitsForQuestion` | historical: history 12, knowledge 14; ownership: history 4, risks 4, knowledge 14; current-state: history 4, risks 5, knowledge 12 | Question-shape overrides |
| `retruncateHistorySummaries` | 220 chars semantic | History summaries |
| `semantic-truncate.ts` | default maxLen 220 | Soft truncate preserving qualifiers |
| `formatTellMePromptBlock` | slice(0, 20) per bucket | Prompt formatting |
| `filterKnowledgeForOwnershipQuestion` | drops adjacent ownership lines | Ownership pollution |
| `refineHistoryForQuestion` | drops History overlapping Current for current-state | Soft supersession |
| Knowledge merge | max 8 bullets/section on merge; load cap 24 | Storage |

**Duplication:** Knowledge risks vs Risks bucket (exact-string dedupe); people vs stakeholders; now vs snapshot keyState; history vs now for same topics (partially refined).

### Canonical flagged / eval path

**System:** `TELL_ME_SYSTEM_CANONICAL` — JSON includes `noticed`, `needsConfirmation`.

**User content:** single `serializeCanonicalTruth` block:

- Header MODE current|historical  
- `CURRENT FACTS:` (structured overlay preferred, else legacy-derived items; `lifecycle=current` only unless historical)  
- `MILESTONES:` (up to 8 timeline)  
- `WAITING / OPEN:` (up to 8 waiting/chase todos)  
- Optional `EVIDENCE (history)` if historical (up to 6, detail 160 chars)  
- Optional `KNOWN GAPS` from ownership hints  
- `QUESTION:`  

Skips multi-channel Capture context dump and snapshot on this path. Conversation/freshness still appended by answer engine.

---

## 8. Token / cost telemetry state

### Reference same-model runs (eval totals)

| Run | Lume pass | GPT pass | Lume tokens | GPT tokens | Notes |
| --- | --- | --- | --- | --- | --- |
| MODEL TIDY PR37 | 30/45 | 32/45 | 49,157 | 21,470 | Legacy Tell Me path |
| PR38 Canonical | 23/45 | 30/45 | 37,404 | 21,452 | Canonical path; trust/critical 0 |

These headline numbers are **API `usage.total_tokens` sums** across cases (input+output combined in the stored total), not offline estimates.

| Derived | Approx. |
| --- | --- |
| Avg Lume tokens/question (PR37) | 49,157 / 45 ≈ **1,092** |
| Avg Lume (PR38) | 37,404 / 45 ≈ **831** |
| Avg GPT (both) | ≈ **477** |

Per-case records may also store `prompt_tokens` / `completion_tokens` when API returns them; summary UI emphasises totals.

### Instrumentation

- Eval: `lumeTotalTokens`, `baselineTotalTokens`, optional `lumeTokenBreakdown` / `baselineTokenBreakdown`, `sameModelControl`
- Breakdown parses **legacy** prompt headers → under canonical path knowledge buckets read **0** while facts still sent
- Production Tell Me returns `usage` in response; **not** persisted as per-user token meters
- `workspace_usage` / `analysesThisMonth`: **analysis counts**, not tokens
- No in-repo model $ pricing; **cannot** estimate real $ cost per user from persisted fields alone without external rates + token logs

---

## 9. Benchmark state

| Fact | Value |
| --- | --- |
| Suite | `lume-intelligence-benchmark-v1` |
| Worlds | 5 (Meridian, Northline, Harbor, Cascade, Quiet) |
| Cases | **45** |
| Model control | Pinned `gpt-4o-mini-2024-07-18`; `sameModelControl` |
| Lume input | MissionState → Tell Me (evals force canonical) |
| GPT input | Fair `contextDocument` (stage truth + full capture bodies) + short system |
| Isolation | Eval conversation `[]`; synthetic project ids |
| Scorer | Automated dimension bands + trust/critical hard fails; keyword/substring limitations |
| Known false-positive classes | Negation/forbidden matches; Quiet WCAG “undecided”; some Harbor cases |
| Trust wins now in suite | Ownership restraint, informal≠official, current vs historical, qualification preservation (0 trust/critical on recent controlled runs) |
| Purpose | Regression + Lume vs GPT comparison |
| Weak areas | Prioritisation nuance; §16 answer structure; UI confirmation flows; Capture write correctness; token bucket accuracy under canonical |

---

## 10. Current smart / intelligent UI

| Capability | Status |
| --- | --- |
| @person rendering (`PersonEntity`) | **Live** |
| Person selectors (Confirm owner select/add) | **Live** (Tell Me confirm flow) |
| Responsibility labels (`@Name · scope`) | **Live** / Partial (structured + people parse) |
| Date pickers | **Live** on Todos/Nudge/onboarding — **Not present** on Capture review cards |
| Date highlighting as entities | **Not present** |
| Status chips (todo/risk frames) | **Live** |
| Epistemic chips | **Partial** (structured panel; sparse) |
| Evidence reveal | **Live** when provenance on structured items |
| Source links (Tell Me) | **Live** (source list, not deep links) |
| Superseded/current presentation | **Partial** (structured lifecycle; limited UI) |
| Conflict presentation | **Not present** as dedicated UI |
| Needs Review (Capture) | **Live** |
| Needs confirmation (Tell Me) | **Live** in UI when payload has items; model asked on **canonical** system only |
| Confirm owner | **Live** |
| Inline Knowledge edit | **Live** |
| Undo | **Not present** as product undo |
| Autocomplete | **Not present** (suggestions are clickable chips, not typeahead) |
| Suggested questions | **Live** |
| Deterministic suggestions | **Live** |
| Dependency visualisation | **Not present** |
| Availability display | **Not present** as first-class UI |
| Freshness / Refresh Lume | **Live** |
| Intelligent project warnings inbox | **Not present** |

---

## 11. Suggestions / autocomplete current state

| Fact | Detail |
| --- | --- |
| Location | Tell Me empty state “Suggested for you” |
| AI cost | **None** |
| Sources | `buildCanonicalSuggestions` (structured responsibilities, milestones, waiting todos) + `buildSuggestedQuestions` (waiting/CAB/risks/stakeholders/open loops/meetings heuristics) |
| Templates | e.g. Who owns {scope}?; When is {milestone}?; What am I waiting on from {person}? |
| Fuzzy | Query filter on canonical builder (`includes`); not fuzzy search engine |
| Isolation | Project-scoped builders |
| Limit | 6 merged |
| Autocomplete | No live typeahead; click-to-ask only |
| Limitations | Sparse when no structured responsibilities; legacy heuristics dominate for many projects |

---

## 12. Data mutation safety

| Path | UI | AI? | Confirmation | Persist | History/provenance | Undo |
| --- | --- | --- | --- | --- | --- | --- |
| Capture apply | Review cards | Analyse AI; apply deterministic | Explicit approve | Bullet/todo/timeline/memory inserts (supabase) | History events; Why evidence not always DB provenance | No product undo |
| Knowledge quick-add | Knowledge | No | Implicit submit | `persistKnowledgeBullet` | Minimal | No |
| Knowledge full edit | Knowledge | No | Save | **In-memory / local only** — no full supabase rewrite | updatedAt | No |
| Confirm owner | Tell Me dialog | No | Explicit | Bullet + structured meta insert | `user_confirmation` provenance | No |
| Todo due / toggle | Frames | No | Immediate | Partial (due update may skip persist) | Events vary | No |
| Risk frame edit | Risks | No | Immediate | Often `replaceKnowledge` (supabase gap) | Limited | No |
| Coach accept | Coach results | Coach AI produced text | Explicit accept | Todo/suggestion/knowledge | Limited | No |
| New project | Onboarding review | AI assemble | User review then create | Bulk persist | — | — |

---

## 13. Current product navigation / IA

| Nav item | Form |
| --- | --- |
| Lume Overview | Full page `/` |
| Projects list + New Project | Sidebar |
| Project workspace | Full page `/projects/[id]` with Capture/Tell Me stage + frames + Knowledge |
| Capture | **Top intelligence action** (inline stage, not separate nav) |
| Tell Me | Sibling mode in same stage |
| Advise | Strip label; Coach **drawer** + results card |
| Knowledge | Project frame + sidebar “Knowledge” → `/memory` (older memory search page) |
| History | Sidebar `/history` |
| Captures | Sidebar `/captures` |
| Coaching | Sidebar `/coaching` (session history) |
| Evals | Sidebar if allowlisted |
| Account / auth | Separate |

**Naming inconsistencies (facts):** Advise vs Coach; Knowledge brief vs `/memory` “Knowledge”; Sidebar Knowledge ≠ only project Knowledge frame.

---

## 14. Technical debt relevant to this review

| Debt | Severity | Affected |
| --- | --- | --- |
| Overlapping truth channels (knowledge / risks / stakeholders / history / snapshot) | High | Tell Me cost & consistency |
| `LUME_CANONICAL_TRUTH` dual path | High | Prod vs eval divergence |
| Token breakdown headers mismatch canonical | Medium | Eval telemetry |
| `replaceKnowledge` / Knowledge edit not fully supabase-persisted | High | Data loss risk on refresh |
| `extractPeopleLines` / ownership regex polarity | High | Eval + people extraction |
| Local Capture/Tell Me fallbacks when no API key | Medium | Behaviour fork |
| Advise UI vs Coach code naming | Low | Cognitive |
| Stakeholder Capture → people bullet not always `stakeholders` table | Medium | Dual people model |
| Orphan `CaptureBar` mergeCapture path | Low | Dead/confusing code |
| Recommendations vs risks dual use in Capture context | Medium | Context assembly |

---

## 15. Proven vs experimental

| Capability | Production proven | Eval proven | Experimental | Known limitation |
| --- | --- | --- | --- | --- |
| Capture extraction/review | Yes (primary path) | Golden/dev | — | Coverage silent drops; content edit unused |
| Persistence (supabase) | Yes for creates | — | — | Full knowledge replace gap |
| Current vs historical | Soft (prompt + refine) | Yes (0 trust) | — | Not schema lifecycle for all rows |
| Ownership restraint | Prompt + filters | Yes | — | False invent risk if gaps wrong |
| Informal vs official | Prompt + prose | Yes | — | Not epistemic column on legacy |
| Qualification preservation | Semantic truncate | Yes | — | — |
| Canonical truth path | Code on main | PR38 live | **Default off in prod** | Recall regressions documented |
| Canonical cost reduction | — | PR38 −24% | Flagged | Completeness tradeoff |
| Deterministic suggestions | Live | Unit checks | — | Sparse without structured data |
| Confirm-owner loop | Live UI | Unit mutation test | Low production usage assumed | — |
| Structured Tell Me output | UI live | Canonical system asks | Legacy system does not ask model | — |
| Conversation isolation | Live | Source-checked | — | — |
| Evidence/provenance | Partial UI | — | Structured only | Legacy bullets lack provenance |
| Intelligent UI foundations | Partial live | — | — | Not full Knowledge Centre |

---

## 16. Final fact pack

### PRODUCT TODAY

Authenticated project workspace with Capture → Tell Me | Advise (Coach) intelligence strip; Knowledge brief; Todos/Risks/Timeline/Nudges/Meetings frames; History/Captures/Coaching pages; allowlisted Evals.

### AI TODAY

OpenAI chat on Capture analyse, Tell Me ask, Tell Me refresh (optional), Coach, New Project (×2); Whisper on transcribe. Default chat model pin `gpt-4o-mini-2024-07-18`. Suggestions: no AI.

### PROJECT TRUTH TODAY

Multiple stores; Knowledge section bullets are the main brief; stakeholders/todos/risks/milestones/memories/history/snapshots coexist; Slice 1 structured overlay optional; production Tell Me still defaults to multi-channel legacy assembly.

### TRUST / REVIEW TODAY

Capture review-gated for primary analyse path; Tell Me read-only; Confirm owner explicit; Coach accepts explicit; Knowledge manual edit user-driven; recent evals show 0 trust/critical with completeness regressions on canonical.

### UI INTELLIGENCE TODAY

PersonEntity, sparse EpistemicChip, EvidenceReveal, Confirm owner, Capture Needs Review, Tell Me noticed/needsConfirmation rendering, deterministic suggestions, freshness/refresh. No conflict resolver UI, dependency graph, or availability UI.

### TOKEN FOOTPRINT TODAY

Latest controlled: legacy ~49k suite / ~2.29× GPT; canonical eval ~37k / ~1.74× GPT. Avg ~831–1092 Lume tokens/question. Production per-user token $ not persisted.

### EXPERIMENTS CURRENTLY BEHIND FLAGS

`LUME_CANONICAL_TRUTH` (default **off**): compact canonical Tell Me path + canonical system schema. Evals force it on.

### KNOWN FAILURE MODES

Canonical recall gaps (contacts/roles/joint/compound risks/candidates); Tom polarity extraction; false unknown-owner gaps; Knowledge edit persist gap; token bucket mismatch; scorer negation FPs; Capture silent finding drops.

### SAFE ROLLBACK POINTS

- Canonical path: unset/`LUME_CANONICAL_TRUTH=0` → legacy Tell Me  
- Model: `OPENAI_MODEL` override  
- Git: `main` before #39 / #37 / #36 / #35 as needed  
- Migration #8 is additive nullable — does not remove legacy bullets  

---

CURRENT-STATE AUDIT COMPLETE
