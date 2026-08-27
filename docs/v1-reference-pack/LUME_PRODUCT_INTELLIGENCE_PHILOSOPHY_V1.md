# Lume Product & Intelligence Philosophy v1

**Status:** Canonical product/engineering philosophy  
**Date:** 19 August 2026  
**Purpose:** Stable reference for Lume V1 product decisions, intelligence behaviour, trust model, scope and implementation philosophy.

This is **not** an implementation plan. Individual PRs should comply with it rather than reinterpret Lume from scratch.

Mutable implementation status (what the code does now, which flags are on, which persistence gaps remain) lives in `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` and `docs/LUME_V1_KNOWN_DISCOVERIES.md`, not in this constitution. See `docs/README.md`.

---

## Executive overview

1. **Lume is a project-intelligence workspace for project managers who cannot realistically keep an entire changing project in working memory.**
2. **V1 is project-specific:** the user explicitly selects a project before using project intelligence; general portfolio intelligence is out of scope.
3. **Capture, Knowledge Centre and Advise are modes on the same project page**, not separate product pages; selecting a mode changes the main working frame.
4. **V1 is primarily Capture ↔ Knowledge Centre.** Advise remains visible as `Coming soon`, but further Advise development is parked and it may not be required for V1.
5. **Capture is the write/propose boundary:** messy text or voice is interpreted by AI, but every extracted item must be reviewed before anything from that Capture becomes maintained project truth.
6. **Knowledge Centre is the heart of V1:** Browse what Lume understands, Search stored knowledge deterministically, and use `✦ Ask Lume` when reasoning is actually useful.
7. **Trust beats apparent cleverness:** if ambiguity could materially change a fact, person, relationship, date, status, action or answer, Lume asks rather than guesses.
8. **Contradictions must be surfaced:** two individually plausible statements that cannot coexist should become a `Needs you` resolution, not silent winner-selection.
9. **The user-facing epistemic model is simple:** maintained knowledge, `✦ Lume noticed`, and `Needs you`.
10. **Smart UI is part of the intelligence architecture:** owners, dates, relationships, conflicts, evidence, assumptions and corrections should often be resolved through deterministic UI rather than more prompt engineering.
11. **Confirmed knowledge should look like normal knowledge.** AI High/Medium/Low confidence belongs mainly in Capture review, not permanently across Knowledge Centre.
12. **Every meaningful knowledge item should be inspectable**, revealing relevant capture history, provenance, previous values, assumptions, related people/dependencies and correction controls only when selected.
13. **Search, suggested questions and future autocomplete should be deterministic whenever stored information is enough.** The sparkle glyph means an action invokes AI.
14. **Durable knowledge must survive over time:** later captures that do not mention a still-current fact must not cause Lume to forget it.
15. **History is primarily evidence and chronology**, not a competing current-truth store that must be dumped into every AI request.
16. **The current architecture works but is fragmented:** the same semantic truth can exist in several stores, and the legacy AI path compensates with overlapping context.
17. **The first canonical experiment proved both sides of the problem:** cleaner context reduced tokens and retained trust, but an incomplete representation damaged recall. Do not turn that into endless benchmark case repair.
18. **Token minimisation is secondary to usefulness and trust at current economics.** Streamline the AI, but do not remove context that materially helps it.
19. **The static 45-case benchmark is a regression suite, not Lume's commercial proof.** Lume's meaningful advantage must be tested longitudinally across changing project information.
20. **Development may contain intermediate fixes, but every fix must be explicit, evidence-driven and scoped; no return to prompt/retrieval/scorer whack-a-mole.**

---

# 1. The problem Lume solves

The problem is not simply:

> I need an AI that can answer project-management questions.

General-purpose AI is already good at reading a well-prepared project dossier.

The real problem is that project information is continually dispersed across meetings, notes, dates, people, constraints, decisions, risks and half-remembered commitments. A PM cannot reliably hold all of that in working memory or continually rebuild a clean context document before every question.

Examples that have shaped Lume include:

- Who deals with the Snyk scan sign-off?
- I forgot Sally is off next week and I have nobody to do the UX.
- Do I have CAB prepared for project A or project B?
- Someone told me something and I am rifling through notes trying to find it.
- I forgot an availability or skill constraint and assumed somebody could take the work.
- I need to remember whose turn it is for BAU/release tasks.
- I need to tune back into a project or meeting quickly after my attention has drifted.
- I want to sound informed and prepared without manually reconstructing the project every time.

The core proposition remains:

> **You can't keep an entire project in your head. Lume can.**

This does not require omniscience. It requires a maintained external understanding that is unusually reliable, inspectable and easy to correct.

---

# 2. V1 product model

The intended project-page model is:

# **Capture | Knowledge Centre | Advise**

All three occupy the **same selected-project page**.

- Selecting **Capture** expands the Capture working frame across the available content width and pushes normal project frames down.
- Selecting **Knowledge Centre** expands the Knowledge Centre working frame across the same space and pushes normal project frames down.
- The selected working frame can be **minimised/collapsed** to return attention to the normal project frames.
- **Advise** remains visible as `Coming soon`; active development is parked.

The primary V1 product is therefore increasingly:

> **Capture ↔ Knowledge Centre**

with Advise a later judgement layer if the core loop proves strong enough.

---

# 3. Capture — WRITE / PROPOSE

Capture's job is:

> **Tell Lume what happened.**

It accepts messy human input rather than requiring the PM to maintain a formal database manually.

Inputs may include:

- typed notes;
- meeting updates;
- brain dumps;
- decisions;
- concerns/questions;
- copied project information;
- voice/transcription;
- dates;
- people and availability updates;
- commitments;
- risks;
- things the user is unsure about.

AI is appropriate here because the input is semantic and messy.

## Intended Capture flow

**Raw input**  
→ **source/transcript preserved**  
→ **AI proposes interpretations**  
→ **compare with what Lume already knows**  
→ **review everything**  
→ **clarify ambiguity/contradiction**  
→ **user confirms the complete review**  
→ **write approved changes to maintained project state**  
→ **preserve provenance/history**  
→ **Knowledge Centre immediately reflects the change**

Capture is the main boundary between probabilistic interpretation and maintained truth.

---

# 4. Capture review is mandatory

This decision is locked:

> **Nothing from a Capture is written into maintained project truth until the user has reviewed the complete extracted set and submitted/confirmed it.**

High-confidence items may be preselected or visually easy to approve, but they are not silently applied before review completion.

A good review experience might present:

- `High confidence` — likely correct, quick to approve;
- `Needs review` — user should inspect;
- `Needs you` — Lume cannot safely resolve the ambiguity;
- unmatched/unclear information where appropriate.

Confidence describes the **quality of the extraction**, not permanent truth. Once an item is approved, ordinary Knowledge should not remain covered in High/Medium/Low AI-confidence badges.

The review experience should be efficient enough that trust does not become friction:

> 6 ready · 2 need review · 1 needs you

but the user must still have seen the whole interpretation before submission.

---

# 5. Ambiguity and contradiction rule

The locked engineering interpretation is:

> **If ambiguity could materially change a stored fact, person, relationship, date, status, action or answer, Lume must ask. Harmless linguistic uncertainty that does not alter meaning does not require interruption.**

Examples:

- Two plausible people match “Tom from Finance” → ask which Tom.
- Security sign-off has no confirmed owner → do not infer one from somebody who merely discussed Security.
- Two credible go-live dates are present and cannot both represent the same current commitment → surface the conflict.

Contradictions are explicitly included in this rule.

Two statements may both have credible sources yet be mutually incompatible in practice. Lume should represent that as:

> `Needs you`

rather than silently choosing whichever is newer, more confidently worded or easiest for the model to use.

The user should trust:

> **Lume either knows, or asks.**

---

# 6. User-facing epistemic model

Internally Lume may carry richer metadata, but the experience should remain understandable.

## Known

Maintained project knowledge.

Examples:

- `@Priya Shah · CAB pack`
- `Go-live · 26 Aug`
- `One Snyk critical remains open`

Confirmed Knowledge should generally look calm and ordinary.

## ✦ Lume noticed

A supported implication, connection or potential issue that Lume has derived from known information.

Example:

> Ava is the only confirmed UX approver and is away shortly before the design freeze.

Possible actions may include:

- Add as risk;
- Add action;
- Ignore/dismiss.

A Lume observation does not silently become maintained truth, Risk or To Do.

## Needs you

A material gap, ambiguity or contradiction that requires PM resolution.

Examples:

- Security sign-off owner not confirmed.
- 24 Sep and 30 Sep both appear as credible current go-live claims.

Resolving it should improve future Search/Ask behaviour everywhere.

---

# 7. Knowledge Centre — READ / UNDERSTAND / INSPECT / CORRECT

Knowledge Centre is intended to become the heart of V1.

It answers:

> **How does Lume currently understand this project?**

It combines three related behaviours.

## Browse

Inspect maintained project understanding through structured, readable project frames and selectable items.

## Search

Find stored information directly.

- deterministic;
- fast;
- no AI call.

## ✦ Ask Lume

Reason over maintained project context.

- AI call;
- read-only;
- does not mutate Knowledge;
- may return Answer / Lume noticed / Needs you.

The Search/Ask distinction is a core interaction pattern and should remain visually obvious.

---

# 8. Knowledge Centre frames and items

The default viewport should be calmer than the earlier Mission-Control-style layouts.

The current approved direction is approximately three large frames visible first:

- **Current position**
- **Risks & blockers**
- **To Do**

Further frames continue **below the fold** and appear by normal scrolling; there is no artificial “More project knowledge” accordion/button.

Additional useful frames include:

- Decisions;
- Dependencies;
- Important dates/Timeline;
- People & context;
- Waiting & open loops;
- Meeting Prep if retained and stable;
- other existing project frames that remain genuinely useful.

Frames may grow vertically. Meaningful content should not be truncated just to maintain equal card height.

Individual items within frames are selectable objects, not prose wallpaper.

Selecting a relevant item can progressively reveal:

- complete context;
- current state/value;
- previous/superseded values;
- source Capture/meeting/manual confirmation;
- provenance/evidence;
- assumptions Lume is making;
- related people;
- dates;
- dependencies;
- linked risks/To Dos;
- history of changes;
- correction actions.

Only relevant fields should be shown; detail should be rich without making the default view busy.

---

# 9. People and relationships

People should preserve actual project relationships rather than be forced into generic RACI categories.

Useful relationship examples include:

- `@Ava Chen · UX design sign-off`
- `@Priya Shah · CAB pack`
- `@David Okonkwo · Security approval`
- `@Elena Voss · Harbor vendor contact`
- `@Ava Chen · Away 1–12 Sep`
- `@Helen + @Omar · HR onboarding process design`
- `Security sign-off · Owner not confirmed`

Relationships must remain scoped.

Someone owning UX design sign-off does not become a global project owner or the owner of Security.

A person may simultaneously be represented through distinct concepts such as:

- project role;
- scoped responsibility;
- approver/authority;
- contact;
- cover;
- joint responsibility;
- contributor;
- person the PM is waiting on;
- availability constraint.

---

# 10. Dates, priority and dependencies

## Dates

Dates should be explicit and understandable.

Use labels appropriate to their meaning:

- `Due 16 Aug`
- `Due tomorrow`
- `CAB · 21 Aug`
- `Away 1–12 Sep`
- `Current 26 Aug · Previously 19 Aug`

Do not call a date `Due` when it is not a due date.

Editable dates should use date pickers.

## Priority

Use RAG dots only where priority is meaningful:

- red = high;
- amber = medium;
- green = low;
- grey = no priority explicitly identified.

Do not repeat High/Medium/Low text beside the dot in ordinary Knowledge items.

## Dependencies

Prefer meaningful relationships rather than generic dependency labels:

- Journey build → depends on → UX design freeze
- Security approval → depends on → rollback evidence
- Integration testing → depends on → Harbor staging
- Technology readiness → depends on → identity-platform cutover

Confirmed dependencies become maintained understanding.

Potential dependencies inferred by AI should appear as `✦ Lume noticed` until confirmed where material.

A complex enterprise graph UI is not required for V1.

---

# 11. Search, suggestions and AI visual language

Search, suggested questions and future autocomplete should be deterministic whenever stored state is sufficient.

Examples:

- responsibility → `Who owns {scope}?`
- milestone → `When is {milestone}?`
- waiting item → `What am I waiting on from {person}?`
- dependency → `What is blocking {item}?`

Suggested questions should be visually quiet, not primary CTA buttons.

The small sparkle/intelligence glyph has a product meaning:

> **This action invokes AI.**

Use it for:

- `✦ Analyse`
- `✦ Ask Lume`
- `✦ Refresh`
- later `✦ Advise`

Do not use it for deterministic Search, Add, Edit, Confirm, Resolve, filters, project switching, date pickers or deterministic suggestion generation.

Capture should display the established blue AI glyph in the main mode selector because using Capture analysis is an AI-led mode.

---

# 12. Persistent project intelligence/status loop

A selected project should have a compact top status strip that reflects Lume's understanding rather than fabricated project KPIs.

Example direction:

> I know 18 things · I see 4 risks · I see 6 dependencies · Updated 12m ago

The exact counts must have meaningful definitions.

Avoid fake or undefined metrics such as “68% project progress.”

Top-right controls:

- `✦ Refresh` is a true button with the AI glyph;
- remaining AI allowance is shown separately in a framed, non-button element such as `36 actions left`;
- do not expose raw token counts to users.

Refresh reassesses derived intelligence; it does not silently rewrite project truth.

---

# 13. Master To Do — V1 cross-project exception

General portfolio management is out of scope, but Master To Do is an intentional exception because it solves a concrete personal workflow.

## Left: recorded To Dos

All explicitly stored To Dos across the user's projects, with deterministic sort/filter options such as:

- due date;
- project;
- priority;
- status;
- overdue.

## Right: ✦ Lume Thinks

Tentative things Lume thinks the user may need to do or be aware of based on stored project knowledge.

Examples:

- Security approval has no confirmed owner on Meridian.
- Ava is away before the Northline design freeze and no cover is confirmed.

The user can open the project, add a To Do or dismiss the suggestion.

These never silently become actions.

The panel shows last updated time and `✦ Refresh`.

---

# 14. New Project

Lume supports blank project creation and AI-assisted initial project setup.

The AI-assisted path should follow the same trust principle as Capture:

> AI interprets → user reviews → project is created.

The goal is to let the user enter the workspace with useful initial understanding rather than an empty shell, while keeping the user in control of what is treated as project truth.

---

# 15. Advise

Advise conceptually means:

> **What does Lume think I should do?**

Possible future behaviours include:

- What would you do next?
- Challenge my plan.
- What am I missing?

However, further Advise development is **parked**.

For V1 work:

- keep the mode visible as `Coming soon`;
- preserve reusable foundations where trivial;
- do not spend current product/engineering effort building a full Advise experience;
- revisit it after Capture + Knowledge Centre prove their value.

---

# 16. Existing features retained but not current focus

## Meeting Prep

Retain existing Meeting Prep functionality if stable/useful and expose it as a secondary project frame below the initial three.

Do not undertake a major rebuild during the current Capture/Knowledge Centre work.

If it cannot be brought to an acceptable quality level with proportionate effort, it may be disabled before launch.

## Timeline

Apply the same rule to the existing Timeline view if present:

- retain if stable/useful;
- secondary in the UI;
- no major current investment;
- disable before launch if quality is insufficient.

---

# 17. Current architecture — strengths

Lume is already a real SaaS rather than a conceptual prototype. It includes or has foundations for:

- real authentication/private workspaces;
- Supabase persistence;
- multi-project support;
- Capture;
- voice transcription;
- Capture review;
- Knowledge;
- Tell Me/Ask foundations;
- Risks;
- To Dos;
- Meeting Prep;
- Timeline/history concepts;
- History/Captures;
- new-project onboarding;
- billing/trial scaffolding;
- eval infrastructure;
- production deployment.

Important intelligence behaviours have also been demonstrated:

- current-vs-historical reasoning;
- ownership restraint;
- informal information remaining informal;
- qualification preservation;
- project conversation isolation;
- deterministic suggested questions;
- Confirm Owner correction loop;
- structured Answer / Lume noticed / Needs confirmation response UI;
- recent same-model controlled runs with 0 genuine trust failures and 0 critical failures.

These are assets and should not be discarded casually.

---

# 18. Current architecture — debt/problems

The same semantic fact can currently be represented across several stores, including:

- projects;
- knowledge_items;
- stakeholders;
- todos;
- risks;
- milestones;
- memories;
- capture_sessions;
- history_events;
- snapshots;
- recommendations;
- runtime/local client state.

Consequences include:

- duplicated truth;
- contradictory representations;
- larger/overlapping AI context;
- prompt rules that compensate for structural uncertainty;
- unclear authority;
- inconsistent persistence.

Durable principles (do not freeze temporary implementation status here):

- **Maintained Knowledge must persist durably and survive reload.** The primary Knowledge edit/replace path now does this. Remaining persistence gaps belong in Known Discoveries, not as a permanent rule that Knowledge editing is not persisted.
- **Explicit people identity belongs in durable stakeholder/person records.** Remaining Capture promotion of people prose is open debt (D-007), not a product decision to keep people as Knowledge-only.
- History remains evidence/chronology, not competing current truth.

Live implementation debt (Ask path defaults, feature flags, save-error UX, some risk/todo/new-project persist gaps, dual-store leftovers, telemetry labelling, Coach vs Advise naming) is tracked in:

- `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`
- `docs/LUME_V1_KNOWN_DISCOVERIES.md`

Those snapshots will change. Do not copy them back into this constitution.

These are architecture/product-debt issues, not an invitation to restart prompt whack-a-mole.

---

# 19. Canonical-truth experiment — interpretation

The controlled history includes:

## Model Tidy / legacy path

- Lume: 30/45
- GPT: 32/45
- Trust: 0
- Critical: 0
- Lume tokens: 49,157
- GPT tokens: 21,470

## Canonical Slice 1

- Lume: 23/45
- GPT: 30/45
- Trust: 0
- Critical: 0
- Lume tokens: 37,404
- GPT tokens: 21,452

The canonical path reduced Lume total tokens by roughly 24% while preserving trust, but genuine recall/completeness regressed.

Examples included:

- Elena vendor contact lost;
- joint Helen/Omar responsibility lost/poisoned by a false known gap;
- Technology risk/dependency chain compressed;
- Quiet budget/discovery/pilot context thinned;
- Tom ownership polarity contradiction;
- some CAB chase completeness lost.

The lesson is not “restore all old context” and not “keep tuning the same 45 questions.”

The lesson is:

> **Cleaner maintained state is promising, but canonical truth cannot simply be a thinner summary and should not become a second giant duplicate database.**

Where domain objects already exist—Todos, Risks, Milestones, People—prefer making them reliable and connectable rather than copying everything into another universal truth table.

Useful cross-cutting concepts likely include:

- scoped responsibility;
- dependency;
- availability;
- provenance;
- epistemic state;
- supersession;
- ambiguity;
- relationships between domain objects.

---

# 20. Deterministic code must not become a homemade language model

The Tom contradiction demonstrated the risk of extracting a positive relationship from:

> No record that Tom owns UX sign-off.

A growing regex/keyword system is not the answer.

Deterministic code should be used for things such as:

- IDs;
- project isolation;
- lifecycle;
- confirmed dates;
- confirmed relationships;
- provenance;
- Search;
- UI rendering;
- validation;
- deterministic suggestion templates;
- limited structural retrieval.

Natural-language interpretation should remain an AI task where needed, followed by user review before uncertain interpretations become truth.

Legacy prose does not need to be perfectly retro-converted into structured certainty.

---

# 21. Durable knowledge and History

A fundamental requirement is:

> **If Lume learned something that remains true, a later Capture that does not mention it must not cause Lume to forget it.**

Examples include current contacts, scoped responsibilities, dependencies, constraints and approved dates.

History should increasingly answer:

- What used to be true?
- What changed?
- When did it change?
- Why did it change?
- Where did Lume learn this?
- What did the source actually say?

It should serve as evidence/chronology rather than a competing current-truth channel shipped wholesale on every Ask request.

Historical evidence can be selected through provenance/supersession/change relationships when a question needs it.

---

# 22. Context and token policy

Token cost is not a primary V1 constraint at the currently observed request sizes.

The controlled averages were approximately:

- generic baseline: ~477 total tokens/question;
- canonical experimental Lume: ~831;
- trusted legacy Lume: ~1,092.

Optimise intelligently, but in this order:

1. remove obvious semantic duplication;
2. select relevant information;
3. represent it compactly without losing meaning;
4. avoid AI calls where deterministic behaviour is superior;
5. only then optimise minor token overhead.

Do not routinely truncate selected facts.

> **Fewer complete relevant semantic units are preferable to more truncated facts.**

Only generous defensive limits should exist for pathological input sizes.

---

# 23. Ask Lume architecture

Prefer the simplest architecture that works:

**Question**  
→ **deterministically identify relevant current project state/relationships**  
→ **include connected context needed for useful reasoning**  
→ **include historical evidence only when actually relevant**  
→ **one model call**  
→ **Answer / ✦ Lume noticed / Needs you / evidence references**

Ask remains read-only.

Do not starve the model of useful context merely to lower token counts.

Do not ship five overlapping versions of the same semantic fact either.

Agents, vectors and multi-pass reasoning are out of scope unless future evidence demonstrates a concrete need.

---

# 24. AI / deterministic / human boundary

## Deterministic

Prefer for:

- IDs/project scope;
- lifecycle/current/superseded state;
- confirmed dates;
- confirmed relationships;
- provenance links;
- Search;
- deterministic suggested questions;
- future autocomplete;
- filters/counts;
- UI rendering;
- user corrections.

## AI

Use for:

- messy Capture interpretation;
- candidate mutation extraction;
- semantic/contextual interpretation;
- implication detection (`Lume noticed`);
- natural-language synthesis;
- Ask reasoning;
- intelligence Refresh;
- future Advise.

## Human

Require for:

- materially ambiguous identity;
- mutually incompatible credible claims;
- unclear ownership/authority;
- whether a tentative inference becomes maintained truth;
- materially uncertain changes.

---

# 25. V1 in scope

Unless explicitly reconsidered because an existing implementation is too unstable:

- authentication/private workspaces;
- project list and explicit project selection;
- + New Project;
- blank project creation;
- AI-assisted new-project creation with review;
- text Capture;
- voice/transcription Capture;
- Capture analysis;
- mandatory review-everything flow;
- ambiguity/contradiction clarification;
- Knowledge Centre Browse;
- deterministic Knowledge Search;
- ✦ Ask Lume;
- Current position;
- To Do;
- Risks & blockers;
- Dependencies;
- Important dates/Timeline where stable;
- People & context;
- Decisions;
- Waiting/open loops;
- selectable Knowledge items/detail;
- evidence/provenance inspection;
- relevant history/change inspection;
- corrections;
- Needs you;
- ✦ Lume noticed;
- deterministic suggested questions;
- Master To Do;
- cross-project `✦ Lume Thinks` inside Master To Do;
- History;
- Captures;
- Meeting Prep if stable/useful;
- AI action allowance;
- ✦ Refresh;
- dark Ocean UI;
- persisted multi-user SaaS behaviour.

---

# 26. V1 out of scope / parked

Unless separately reopened:

- general portfolio intelligence;
- portfolio Overview;
- portfolio health/progress scoring;
- full Advise development;
- Coaching terminology/product;
- visible Evals for normal users;
- light mode;
- giant enterprise knowledge graph UI;
- autonomous agents;
- multi-step autonomous AI workflows;
- vector infrastructure without demonstrated need;
- multi-pass reasoning without demonstrated need;
- silent AI mutation of maintained truth;
- automatic owner guessing;
- large homemade regex/NLP truth engine;
- routine semantic truncation for cost reduction;
- generic AI warning inbox;
- badge-heavy epistemic UI;
- enterprise work-system integrations for V1;
- portfolio planning/roadmap management;
- arbitrary completion percentages;
- generic RACI system;
- rebuilding every domain object inside a second canonical-truth table.

## Themes

**Ocean is required and is the V1 visual baseline.**

Forest, Laser and Desset are optional only if they are genuinely trivial colour-token swaps with negligible QA/maintenance cost. They should not delay or complicate core product work. The motivation is light-weight fun/variety and reducing visual fatigue, not a launch requirement.

---

# 27. North star

Lume should feel like:

> **a project manager with unusually reliable memory.**

The desired response is:

> **Yes. That's exactly what I needed to know.**

The trust counterpart is:

> **If Lume doesn't know, it will ask rather than make something up.**

Those two reactions should govern architecture and product decisions.

---

# 28. Cursor operating principles

Future Cursor work should treat this document as binding product philosophy.

## Cursor should

- preserve settled product decisions;
- preserve project isolation;
- maintain review-before-truth;
- preserve provenance;
- distinguish maintained facts, inference and ambiguity;
- call out material contradictions;
- use deterministic mechanisms where sufficient;
- use AI where semantic reasoning genuinely adds value;
- preserve complete semantic meaning in selected context;
- keep changes narrowly scoped;
- state explicit non-goals;
- test the failure class being fixed;
- preserve rollback paths for experimental architecture;
- distinguish genuine regressions from evaluator artefacts;
- challenge implementation requests that conflict with this philosophy;
- always open the product-owner completion (final Cursor message, PR body, and any written report) with conversational Plain-English, even when the prompt does not ask for it (see `AGENTS.md` and Development & Evaluation Roadmap §19).

## Test-driven / behaviour-first development

For meaningful Lume behaviour changes, define the expected behaviour and regression risk **before** implementation.

Where practical:

1. write or update a test that fails for the intended reason;
2. implement the smallest correct change;
3. make the focused test pass;
4. run relevant adjacent regression tests;
5. run the broader deterministic suite (`npm test`);
6. perform a post-change scan for broken assumptions;
7. do not consider the task complete while relevant tests are failing.

Tests should protect **user-visible behaviour, project truth, persistence, identity, lifecycle, trust boundaries and data isolation** — not implementation trivia, mock choreography, or benchmark score chasing.

### Rules

- Do not casually rewrite tests merely because new implementation causes them to fail.
- First decide whether the code changed intentionally or a regression occurred.
- Expected behaviour changes require an explicit product decision.
- Known defects must not be enshrined as correct behaviour merely to make the suite green (use explicit skips / known-gap markers).
- Test burden should scale with change blast radius.
- Tiny visual/copy changes do not require disproportionate testing.
- Persistence / truth / identity / intelligence architecture changes require strong regression coverage.
- Keep AI evaluation separate from software regression testing.

## Cursor should not

- independently redefine or redesign Lume;
- add features merely because they are technically possible;
- treat individual benchmark questions as product requirements;
- add regex rules to mimic natural-language understanding;
- restore giant context dumps simply to improve a score;
- remove useful context simply to lower token counts;
- silently mutate maintained truth;
- invent ownership;
- turn `Lume noticed` into truth without user action;
- silently resolve credible contradictions;
- build Advise while it is parked;
- add portfolio intelligence to V1;
- expose Evals to users;
- resurrect light mode;
- reinterpret the agreed navigation/sidebar;
- change the approved visual system when asked for a functional delta;
- open a completion with git SHAs, “Starting main SHA”, checkout logs, numbered engineering checklists, dense bullets, commit-style summaries, or a slightly simpler translation of the technical list;
- skip the Plain-English lead because the prompt did not ask for a report.

---

# 29. What “fixing Lume” now means

It no longer means making Tell Me pass a few more benchmark cases.

It means proving this loop:

1. PM tells Lume what happened.
2. Lume interprets it intelligently.
3. Lume exposes every material interpretation for review.
4. Lume asks where meaning is materially ambiguous or contradictory.
5. User submits the reviewed Capture.
6. Approved changes become durable project understanding.
7. Previous truth remains inspectable where relevant.
8. Knowledge Centre presents the maintained understanding clearly.
9. Search retrieves stored information without AI.
10. Ask reasons over sufficient relevant context.
11. Lume distinguishes known truth from what it has merely noticed.
12. Corrections improve future answers.
13. The PM has to reconstruct less project context manually over time.

If Lume achieves that, it has a meaningful reason to exist even if generic GPT remains excellent at reading a perfectly prepared dossier.
