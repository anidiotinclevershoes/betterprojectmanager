# Coaching Product Investigation — Part 1

## Market Wedge, Product Definition, User Experience and Domain Fit

| | |
| --- | --- |
| **Status** | Investigation report. Authoritative input for Part 2. |
| **Date** | 27 August 2026 |
| **Repository branch inspected** | `main` |
| **Exact HEAD SHA inspected** | `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f` |
| **Branch this report was written on** | `cursor/coaching-product-investigation-part1-0f4e` |
| **Production changes made** | **None.** No code modified, no migrations, no refactors, no abstractions. |
| **Scope** | Market, product definition, UX, domain fit. Architecture, code reuse and implementation economics are Part 2. |

This report is deliberately unflattering in places. The prompt authorised challenging every assumption in it, and several assumptions did not survive contact with the evidence.

---

## Contents

- [A. Executive assessment](#a-executive-assessment)
- [B. Strongest bear case](#b-strongest-bear-case)
- [C. Assumptions confirmed and rejected](#c-assumptions-confirmed-and-rejected)
- [D. Market evidence](#d-market-evidence)
- [E. Exact ICP](#e-exact-icp)
- [F. Competitive gap](#f-competitive-gap)
- [G. Product proposition](#g-product-proposition)
- [H. Smallest compelling product](#h-smallest-compelling-product)
- [I. Core loop](#i-core-loop)
- [J. First-run and wow moment](#j-first-run-and-wow-moment)
- [K. Product semantics](#k-product-semantics)
- [L. UX and information architecture](#l-ux-and-information-architecture)
- [M. Domain and data model](#m-domain-and-data-model)
- [N. AI trust model](#n-ai-trust-model)
- [O. Failure modes](#o-failure-modes)
- [P. Privacy and compliance](#p-privacy-and-compliance)
- [Q. Longitudinal value and retention](#q-longitudinal-value-and-retention)
- [R. Competitive moat](#r-competitive-moat)
- [S. Pricing and economics](#s-pricing-and-economics)
- [T. Acquisition](#t-acquisition)
- [U. Brand and name shortlist](#u-brand-and-name-shortlist)
- [V. Landing proposition](#v-landing-proposition)
- [W. Validation experiment](#w-validation-experiment)
- [X. Coaching versus Lume](#x-coaching-versus-lume)
- [Y. Questions Part 2 must resolve technically](#y-questions-part-2-must-resolve-technically)
- [Appendix 1 — What Lume actually is, verified against code](#appendix-1--what-lume-actually-is-verified-against-code)
- [Appendix 2 — Evidence quality notes](#appendix-2--evidence-quality-notes)

---

## A. Executive assessment

### **WEAK OPPORTUNITY** — for the product as briefed

> **Note on this verdict.** An earlier draft of this report concluded *PROMISING — VALIDATE FIRST*. A deeper competitive sweep then found **six shipping products on the exact wedge**, a price floor of **$25/month for unlimited clients**, and **two venture-funded companies in this market shutting down within the last fourteen months**. The verdict is downgraded on evidence. The earlier reasoning is preserved where it still holds, and the specific things that changed are named in section C so the change is auditable rather than a mood swing.

The job is real. The product is not differentiated enough, arriving late enough, into a market small enough and price-compressed enough, to justify building it as a standalone self-serve subscription.

**First, the job is real and coaches are already doing it by hand.** The most persuasive evidence is not a complaint; it is a workaround. Practising coaches publicly describe maintaining a per-client "context file" they update after every session and paste into ChatGPT before the next one. When people are hand-rolling your product with a text file and a prompt, the job exists. The pain is not "I forget my clients" — coaches are offended by that framing. It is "reconstructing six months of a person costs me twenty minutes I don't have, and I still miss the thing that mattered."

**Second, the wedge is not crowded — it is occupied.** This is the finding that moved the verdict. It is not that competitors are adjacent or that they describe similar features differently. Six products ship the specific mechanism described in the brief — extract structure from sessions, hold it across months, brief the coach beforehand, answer questions across the whole history — and several market it in almost the brief's own words:

- **CoachRocks** runs a section headed **"Perfect client memory"**, promises *"Ask anything about any client — answered from every session you've ever had with them"*, and closes with *"Remember every session. Understand every client."* **$25/month, unlimited clients, plus a genuinely usable free tier at 3 clients.**
- **CoachUI** sells *"an always-updating client ledger"* where *"session 8 is analyzed in the context of sessions 1 through 7."*
- **Coachful**: *"AI coaching assistant that actually knows your clients"* and *"ChatGPT doesn't know your clients. Michelle does."*
- **CoachNova**: *"Walk into every session knowing where you left off"* — and, critically, *"The AI proposes. You approve. That's what coach-supervised means."*
- **SessionFlow**: *"grounded in your approved session notes."*
- **Kivo** (waitlist): *"All the little things you wished you remembered? Kivo does."*

Two independent products have converged on the identical sentence *"walk into every session knowing where you left off."* When that happens, the positioning is gone.

**Third, the differentiators identified in the earlier draft each turned out to be thinner than claimed.** The no-recording stance is real but partially available elsewhere — CoachRocks accepts unlimited manual transcript uploads alongside its recording. The approve-before-truth boundary is a genuine architectural difference, but CoachNova already markets "the AI proposes, you approve" and SessionFlow already says "your approved session notes", so the *language* is taken even where the *implementation* is not. Nobody exposes a typed, reviewable fact ledger with supersession and provenance — that gap is real — but it is a feature a competitor could ship in a sprint, not a moat.

**Fourth, the price has already compressed below the level this product needs.** CoachRocks Pro is $25/month with unlimited clients. Granola Business at $14 plus Claude Pro at $20 gets a competent coach perhaps 70% of the way for $34, with no vendor risk. The €39 the earlier draft proposed is now the *middle* of a range whose floor was set by someone else, and the floor has a free tier under it.

**Fifth — and this is the structural finding — this market has twice killed venture-scale attempts and rewarded only tiny, profitable ones.** Practice.do raised $10M and shut down on 3 November 2025, giving users roughly two weeks' notice and no read-only export. Profi raised $8M and closed on 31 December 2025. Meanwhile CoachAccountable has run for twelve years, Paperbell and Life Coach Hub for a decade or more, all bootstrapped and quiet. Every current AI-native entrant is one to three people: CoachNova publicly states three staff, **"around €350 a month in burn," and cash-flow positive**; Wundamental's Estonian register shows headcount falling from 2 to 1 and equity from €41.5k to €17.7k. The near-zero capital requirement means the entry rate will not slow, and the customer base has demonstrated twice that it cannot support anything larger than a lifestyle business.

**On the question the brief actually asks** — is this an unfair head start, or merely technically adaptable? The honest answer is now **neither, quite**. Lume's transferable assets are real and specific: the review-before-write trust boundary, the typed observation model, supersession with provenance, the ambiguity-becomes-a-question rule, project-scope isolation, and above all an evaluation harness that distinguishes *the model was wrong* from *we caught it* from *we let a wrong thing become truth*. No competitor in this space has that last thing. But an evaluation harness is an internal engineering asset that is completely illegible to a buyer comparing two $25 products, and Lume's own numbers currently argue against the reliability claim it would support: the published benchmark shows a **generic GPT baseline at 32/45 against Lume's 30/45** (legacy) and **23/45** (canonical), and the latest live evaluation records **LUME FAILURE** on exactly the identity-ambiguity cases that would be fatal here.

### What I would do instead

**Do not build the standalone product as briefed.** Being the seventh entrant, later, with a narrower feature set and no distribution advantage, into a market with a $25 price floor and two recent funded corpses, is not a good use of the codebase.

Three variants are worth more than the briefed product, in descending order of interest:

**1. Be the memory layer for CoachAccountable and Paperbell rather than replacing them.** This is the one genuinely open position found in the entire sweep, and it has been publicly invited. CoachAccountable's founder wrote in April 2026 that he is *"reluctant to grease those rails"* by adding AI, and then in August 2026 shipped the compromise — an API and webhooks explicitly so that *"[an agent] from whichever source can readily post whatever [to the] `Session.add` API."* Paperbell has no AI at all. Both have large installed bases, twelve-plus years of trust, and a stated intention not to compete. An integration play is smaller and less glamorous than a platform, but it inherits distribution instead of fighting for it, and distribution is the thing this market punishes you for lacking.

**2. Point the same capability at a different profession.** The retention argument that makes coaching better than project management applies at least as well to therapists and supervisors, independent financial advisers with recurring client reviews, non-executive directors across board portfolios, and clinicians with long-term caseloads. Several have better economics, harder regulatory moats and far less crowding. This investigation was scoped to coaching and answered that question; it is not evidence that coaching is the best available application, only that it beats the PM one.

**3. Proceed with the standalone product only if you have distribution the incumbents lack** — an existing audience of executive coaches, a relationship with ICF or EMCC, or a corporate-sponsor channel where SOC 2 and EU residency are procurement gates that a two-person competitor cannot pass. Note that Simply.Coach already claims SOC 2 Type II, HIPAA and GDPR on all plans *and* has AI notes in development, so even that gate is closing. Absent real distribution, this is a **NO-GO**.

If variant 3 is pursued anyway, the validation experiment in section W still applies, but its thresholds have been raised and it must now be run **against CoachRocks specifically** rather than against a generic notion of the competition.

### On ambition

Even the winning case is small. Of roughly 123,000 coach practitioners worldwide, the realistically addressable slice — English-working, independent, enough concurrent clients, willing to pay for a *second* subscription — is plausibly 15,000–40,000 people, now sharing a market with six competitors and a $25 floor. A very good outcome is a one-person business at €50k–€100k ARR. That is a legitimate thing to want. It is not a reason to spend a year of engineering, and the codebase deserves a better-chosen market.

---

## B. Strongest bear case

This section is written to kill the idea. It is not balanced on purpose.

### B1. The proposition is not "already taken" — it is being sold by six companies, and one of them has built your product

This is the argument that should decide the matter.

**CoachRocks is, functionally, the product described in this brief, already shipped, at $25/month with unlimited clients and a free tier at three.** Verbatim from its site: a section headed *"Perfect client memory"*; *"Ask anything about any client — answered from every session you've ever had with them"*; *"When you see a client every couple of weeks, the details blur — what they committed to, what shifted, what they said five sessions back. CoachRocks holds the full arc of each client's journey"*; *"Next-session prep — Walk in already knowing where you left off. Before each session you get a brief: last time's recap, a suggested agenda, and the patterns and blind spots to watch for."* It maps a client transformation timeline, accepts unlimited manual transcript uploads (so the no-recording path exists there too), states that client data is never used to train models, and offers a DPA on request.

The remaining differences are: no coach-approval step on extracted facts, and no explicit third-party-people model. Both are sprints, not moats.

Around it: **CoachUI** ($59/$119) sells *"an always-updating client ledger"* where *"session 8 is analyzed in the context of sessions 1 through 7"*. **Coachful** ($49) sells *"AI coaching assistant that actually knows your clients"* and per-client 30-second briefings. **CoachNova** (€19/active client) sells *"Walk into every session knowing where you left off"* — and already markets the approval boundary as *"The AI proposes. You approve."* **SessionFlow** ($29/$50, free in beta) already uses the phrase *"grounded in your approved session notes."* **Wundamental** (€29–€159) sells cross-session pattern detection and longitudinal dashboards. **Kivo** is on a waitlist with *"All the little things you wished you remembered? Kivo does."*

Two of these independently arrived at the identical sentence about walking into a session knowing where you left off. That is what an exhausted positioning looks like.

The timing is the sharpest part. Practice.do died in November 2025; CoachNova launched April 2026; Osmo launched 16 June 2026; CoachRocks' design case study is dated March 2026. **This went from thin to saturated in roughly four to eight months**, and the entry rate will not slow, because the capital requirement is near zero.

### B2. The free substitute is good enough, and getting better on someone else's roadmap

A coach can create one ChatGPT Project per client today. Projects have persistent per-project memory, take 25 file uploads on Plus and 40 on Pro, and are scoped so one client's context cannot bleed into another's. That is $20/month for a workable per-client memory system, from a brand the coach already trusts, with no migration and no new login. Claude Projects is equivalent.

The gap you are selling into is precisely the manual maintenance of the context file — thirty seconds of typing after each session, by the coach's own account. You are proposing to charge €39/month to remove thirty seconds of typing per session, roughly thirty times a month. That is a fifteen-minute-a-month saving priced at the cost of a session's parking. The value has to come from *quality* — from surfacing what the coach would have missed — and quality is exactly the thing you cannot demonstrate in an ad.

Meanwhile Granola sells for $14/month with a People directory, chat across every note involving a person, no bot in the meeting, audio deleted immediately after transcription, and SOC 2 Type 2. A coach who is comfortable with recording already has a cheaper, more mature, better-funded option that does 70% of this.

### B3. The market is small, poor, and the client counts in the brief are optimistic

The 2025 ICF Global Coaching Study puts the global coach population at 122,974, average annual coaching revenue at **$49,283**, average **12.4 active clients**, and **11.6 coaching hours per week**. The brief's "10–40 active clients" describes the *upper half* of the market; the top of that range is rare. Independent executive coaches in particular often run **8–20** concurrent clients, because the engagements are long and the hours are expensive.

Strip that down honestly. Of ~123,000 coaches: perhaps 55% do leadership/executive work, perhaps 60% work in English, perhaps half are genuinely independent rather than employed or in a firm, and perhaps a third carry enough concurrent clients for longitudinal memory to matter. That is on the order of **6,000–20,000 realistic prospects worldwide**, competing for their attention with six or more products. At €39/month, capturing 2% of the optimistic end is 400 customers and roughly €190k ARR gross — before churn, before CAC, before the fact that solo-professional SaaS churns hard.

### B4. Memory is not the coach's top problem, and the evidence does not claim it is

Search the coaching business literature and the ranked pains are client acquisition, pricing and underpricing, admin time in aggregate, and demonstrating ROI to sponsors. "I can't remember my clients" appears as a *sub-item of preparation*, usually resolved with the advice "spend five to ten minutes rereading your notes before the call."

That advice is the competitor. It costs nothing, it works, and it is what every coaching-craft article recommends. The honest version of the pitch is not "you forget" — it is "your ten minutes of rereading becomes ninety seconds and catches more." That is a real but modest claim, and modest claims convert badly on cold traffic.

### B5. Coaches are professionally trained *against* the thing you are selling

Coaching craft resists structure. The best practitioner writing on session notes says the useful format is three loose sections — themes, commitments, where to start next time — and warns that "too long, too clinical, or too generic, and coaches stop filling it in." Several coaches describe deliberately keeping notes sparse to protect presence and avoid pre-judging the next session.

A product whose core act is *converting a coach's prose into structured records that the coach must then approve* is, from that angle, an admin machine wearing an AI hat. Every approval click is a small tax on a professional who resents admin. If the extraction is 90% accurate over ten items, the coach corrects one item per session, thirty times a month — thirty small reminders that the tool is not quite right.

### B6. The confidentiality objection is real, load-bearing, and cuts both ways

The ICF Code of Ethics Standard 2.5 makes the coach responsible for their tools. One training body's published policy is blunt: **no** uploading or pasting session information — including the coach's own notes about real sessions — into AI. The NYC Bar issued a formal opinion in late 2025 warning that AI notetakers without strict consent risk breaching confidentiality duties. Illinois has legislated consent for AI transcription of psychotherapy; forty-plus related bills are moving.

The "we never record" wedge helps with the *client's* objection. It does not help with the objection that **the coach's own written notes about a named executive, plus named third parties who never consented, are being sent to a US model provider.** A cautious PCC coach with a corporate client base and a legal-adjacent sponsor will read your sub-processor list and decline. You will lose exactly the highest-value, highest-fee segment you were targeting.

### B7. Incumbents can bolt this on, and they own the customer and the data

Paperbell, CoachAccountable, Practice and Simply.Coach already hold the session notes, the goals, the actions, the client roster and the billing relationship. Adding "AI prep brief from this client's notes" is a quarter of work for them and requires no migration from the coach. They will do it, because every review article in the category now scores products on AI. Your structural advantage — approve-before-truth, supersession, provenance — is invisible in a feature comparison table.

### B8. Cadence works against habit formation

Executive coaching runs biweekly, sometimes monthly. A coach with fifteen clients touches the product about thirty times a month, in two-minute bursts, split across prep and debrief. That is a thin, easily broken habit with long gaps. Miss the debrief twice and the picture is stale; once the picture is stale the prep brief is wrong; once the prep brief is wrong once, trust is gone and the coach reverts to the Google Doc that is never wrong because it is never inferred.

### B9. Migration reluctance blocks the value curve

The product is worthless on session one and valuable at session twenty. New clients start at session one. Existing clients have their history in a Google Doc that the coach will not retype. So either the product only pays off in a year, or you must nail bulk import of unstructured historical notes — which is the hardest extraction problem in the product, on the messiest possible input, at the moment of least trust.

### B10. Lume's own numbers do not currently support the reliability claim

The repository's product philosophy records that on the controlled 45-case benchmark, a **generic GPT baseline scored 32/45 while Lume scored 30/45** on the legacy path and **23/45** after the canonical-truth refactor. The published Test Dashboard for the latest live Capture V2 evaluation records **LUME FAILURE** counts of 5, 9 and 16 across models — including `ambiguous-same-first-name → write — Must not silently CREATE another Brick` and `mixed-domains → write — Unresolved target became CREATE`.

Translated into the coaching domain: the pipeline currently, sometimes, silently creates a duplicate person when a first name is ambiguous. In a product holding twenty-five confidential client records, that is the single failure you cannot ship. It is fixable, and the fact that the harness *names* the failure is a genuine asset — but as of this HEAD, "Lume is more reliable than GPT" is not supported by Lume's own evidence.

### B11. Acquisition is expensive relative to the price point

At €39/month with realistic solo-professional churn, lifetime value is roughly €450–€650. Google Search in this category runs $2–$6 per click against incumbents with an affiliate army and far higher LTV; a realistic cost per paying customer from cold paid search is €150–€500. The margin for error is thin, and the organic alternative is blocked: the "best coaching software" SERP is saturated with AI-generated affiliate content farms. You cannot out-publish them and you cannot outbid them.

### B12. This market has killed venture attempts twice in fourteen months and rewards only tiny operators

**Practice.do — raised $10M, shut down 3 November 2025.** The CEO's notice: *"I am sad to tell you that we've made the decision to wind down Practice… The company was not where we needed it to be to sustain itself… After a failed acquisition process, the team has decided to put the company to rest."* Users got about two weeks' warning via an in-app banner, no read-only mode, no acquirer. Unexported session notes are gone.

**Profi — raised $8M, closed 31 December 2025.**

**VoxcoachAI** abandoned self-serve on 15 May 2026: *"We're closing direct self-service access to the platform. We're becoming a B2B partner."*

What survived: CoachAccountable (twelve years), Paperbell, Life Coach Hub (fifteen years) — all bootstrapped, all quiet, all profitable. And every current AI-native entrant is minuscule: CoachNova publicly reports three people, **"around €350 a month in burn," cash-flow positive**; Wundamental's Estonian register shows headcount 2 → 1 and equity €41,520 → €17,714; CoachRocks appears to be roughly two people who outsourced the design.

The inference is not "small teams can win here" — it is that **this customer base is low-ACV, high-churn and price-sensitive enough that it has repeatedly failed to support anything larger than one person's income**, and that entrants with real money behind them chose to die rather than keep going. Both deaths were practice-management suites rather than memory products, but they died of the customer, not the feature.

### B13. The price floor is already below the plan, and the substitute stack is cheaper still

CoachRocks Pro: **$25/month, unlimited clients**, with a free tier at three. Granola Business ($14) plus Claude Pro ($20) = **$34/month** for maybe 70% of the job with no vendor risk and no migration. SessionFlow is currently **free while in beta**.

A new entrant with a narrower product cannot price above that on trust it has not yet earned. The €39 proposed in section S was modelled before this floor was known, and it is now a premium price for the seventh-best-known option.

### B14. The creepiness risk is concentrated in the most attractive feature

"Themes and patterns across sessions" is the feature that makes the demo sing and the feature most likely to produce something a coach would be mortified to have on a screen when a client glances at it. The line between *"delegation has come up in four of the last six sessions"* and *"Sarah struggles to delegate"* is one prompt away, and models cross it unbidden. Ship it wrong once and the coach does not file a bug; they cancel, and they tell their supervision group.

---

## C. Assumptions confirmed and rejected

| # | Assumption in the brief | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Coaches keep client context in notes, Docs, Notion, Apple Notes or a CRM | **Confirmed** | Consistently described across practitioner and vendor sources; the five-app stack (Calendly, Stripe, Google Docs, Gmail, a spreadsheet) is the standard description |
| 2 | The relationships are long — months to years | **Confirmed** | Standard executive engagement is 6–12 months, 12–24 sessions, biweekly; C-suite 9–18 months |
| 3 | The customer is an individual with a card who can expense software | **Confirmed** | Independent practice; software is a business expense |
| 4 | Maintaining an evolving mental model across sessions is real work | **Confirmed** | Coaches describe maintaining a per-client "context file" updated after every session and pasted into ChatGPT before the next; craft literature universally prescribes a 5–10 minute pre-session reread |
| 5 | The pain is *not* scheduling/billing/contracts/portals | **Confirmed** | Comprehensively served by six-plus suites; no gap |
| 6 | Privacy sensitivity is high | **Confirmed** | ICF Standard 2.5 (April 2025) makes coaches accountable for their AI tools; ICF AI Coaching Framework (Nov 2024); training bodies banning session data in AI; NYC Bar opinion; US state legislation |
| 7 | Coaches carry approximately **10–40** active clients | **Rejected as stated** | ICF: average 12.4 active clients, 11.6 coaching hours/week. Independent executive coaches commonly 8–20. Revise the ICP band to **10–25** |
| 8 | Memory is the coach's *deeper* / primary pain | **Rejected** | Memory ranks below client acquisition, pricing and aggregate admin in every ranked source found. It is a real but second-tier pain, and it is felt as *preparation cost*, not as forgetting |
| 9 | This is an under-served gap | **Rejected, emphatically** | Six products ship the exact mechanism (CoachRocks, CoachUI, Coachful, CoachNova, SessionFlow, Wundamental), one more is on a waitlist (Kivo), price floor is $25/month unlimited with a free tier, and the category saturated in roughly four to eight months |
| 10 | "Remember every client like they're your only client" is a fresh proposition | **Rejected** | Substantively live competitor copy at Coachful *and* CoachRocks (*"Remember every client without remembering anything"*). Two competitors independently use the identical sentence *"walk into every session knowing where you left off"* |
| 10a | The market can support a new self-serve subscription at €29–€49 | **Rejected** | CoachRocks $25 unlimited + free tier; SessionFlow free in beta; Granola + Claude $34. Practice.do ($10M) and Profi ($8M) both shut down in 2025 |
| 10b | Human approval of AI output is an unclaimed position | **Rejected as positioning; survives narrowly as architecture** | CoachNova markets *"The AI proposes. You approve."*; SessionFlow says *"your approved session notes."* Nobody exposes a typed, superseding, provenance-linked fact ledger — but that is a sprint, not a moat |
| 10c | "Never in the room" is architecturally uncontested | **Partly rejected** | CoachRocks accepts unlimited manual transcript uploads; SessionFlow accepts voice-memo uploads. Recording is their default, not their only path |
| 10d | Modelling the client's *world* (named third parties, tracked relationship change) is unserved | **Confirmed** | No competitor found models the people around the client as durable entities. The one differentiator that strengthened under deeper search |
| 11 | Lume could solve this *substantially better* than the alternatives | **Not supported today; conditionally supportable** | Lume's own 45-case benchmark has generic GPT at 32/45 vs Lume 30/45 (legacy) and 23/45 (canonical). Latest live eval shows LUME FAILURE on identity-ambiguity cases. The *harness* is the asset; the *measured advantage* is not there yet |
| 12 | Coaches want cross-session pattern recognition | **Mixed — treat as a risk, not a feature** | Vendors sell it heavily; craft literature is ambivalent and warns against clinical framing. Recommend read-only, evidence-linked, non-personal (see section N) |
| 13 | Coaches will upload confidential client information | **Unresolved — segment-dependent** | Some already paste into ChatGPT; some are contractually or ethically forbidden. This splits the market and must be tested, not assumed |
| 14 | Willingness to pay €19–€49/month for a *second* subscription | **Unresolved — this is the thing to test** | Price anchors exist at $9–$99; nothing establishes that a memory-only companion clears the bar alongside an existing suite |

### C1. What changed between drafts, and why

Recorded explicitly so the verdict change is auditable rather than a change of mood. Four claims in the first draft did not survive the deeper competitive sweep:

| First draft claimed | Now known | Effect |
| --- | --- | --- |
| "Every AI-native competitor is transcript-first, so *never in the room* is uncontested" | **Partly wrong.** CoachRocks accepts unlimited manual transcript uploads alongside recording; SessionFlow accepts phone voice-memo uploads. The no-recording *path* exists at competitors even where recording is the default | Differentiator downgraded from architectural to positional |
| "Nobody separates proposal from truth" | **Wrong as stated.** CoachNova markets *"The AI proposes. You approve."*; SessionFlow says *"grounded in your approved session notes"*; Coachful gates write actions behind confirmation cards. Nobody exposes a *typed fact ledger* with supersession — that narrower gap survives | Differentiator narrowed to something a competitor could ship in a sprint |
| "Price band €29–€49 is defensible" | **Wrong.** CoachRocks is $25 unlimited with a free tier; SessionFlow is free in beta; Granola + Claude is $34 | Pricing plan invalidated |
| "The category is rapidly crowding" | **Understated.** It is occupied — six shipping products on the exact mechanism, saturated in four to eight months, and two funded companies in this market died in the preceding fourteen | Verdict downgraded |

One claim strengthened rather than weakened: **the client's world remains genuinely unmodelled.** No competitor found in the sweep models named third parties — the skip-level, the board, the peer who went quiet — as durable entities with tracked relationship change. Competitors model the *coachee*. That gap survived the deeper search, and it is the one place Lume's existing people-and-scoped-responsibility machinery has no analogue in the market.

One entirely new finding the brief did not anticipate: **CoachAccountable has publicly refused to build AI and then opened an API for someone else to do it.** Its founder wrote in April 2026 that he is *"reluctant to grease those rails,"* and in August 2026 shipped `Session.add` plus webhooks precisely so third-party agents could write in. Paperbell has no AI at all. That is an invitation, and it is the only uncontested commercial position this research found.

---

## D. Market evidence

### D1. Market size and shape

| Measure | Value | Source |
| --- | --- | --- |
| Coach practitioners worldwide | 122,974 (up 13% since 2023) | 2025 ICF Global Coaching Study (PwC-conducted, 10,000+ participants, 127 countries) |
| Coaches with active clients | 110,492 (90%) | Same |
| Global coaching revenue | $5.34bn (up 17%) | Same |
| Average annual coaching revenue per coach | $49,283 globally; ~$71,719 US | Same / derived reporting |
| Average active clients | 12.4 | Same |
| Average coaching hours per week | 11.6 | Same |
| Average one-hour fee (North America) | ~$234 | Same |
| Specialising in leadership/executive coaching | 54% (81% of Baby Boomer coaches, 66% of Millennials) | Same |
| Business/executive coaches worldwide | ~87,900 | Derived industry reporting |
| Typical executive engagement | 6–12 months, 12–24 sessions, biweekly | Multiple independent coaching-practice sources |
| Typical independent executive coach roster | 8–20 concurrent; full-time capacity 15–25 client hours/week | Multiple practice-building sources |

The relevant read: this is a **large population of small, poor businesses with a small high-value tail**. The tail — PCC/MCC coaches billing $300–$600 an hour with corporate sponsors — is where the money is, and it is also the most conservative, most referral-driven and hardest to reach through advertising.

### D2. Incumbent practice-management suites

| Product | Entry price | Model | Position |
| --- | --- | --- | --- |
| Simply.Coach | $9/mo (3 coachees) | Tiered by client count | Cheapest entry; stakeholder management for tripartite engagements |
| CoachAccountable | $20/mo (2 clients) → ~$70 (10) → ~$120 (20) → ~$400 (100) | Per active client | Deepest accountability/metrics engine; utilitarian UI; 30-day trial |
| CoachVantage | $29/mo | Unlimited contacts | Clean scheduling/contracts/invoicing |
| Delenta | $29/mo | Flat, tiered portals | Course builder, storefront |
| Practice | ~$35–39/mo | Flat | Polished all-in-one for 1:1 practices |
| Quenza | $25/mo (10 clients) | Tiered | Activity/Pathway delivery between sessions; HIPAA + GDPR |
| Paperbell | $47.50–57/mo | Flat, unlimited clients | Booking + packages + payments |
| Practice Better | ~$25/mo | Tiered | Health/wellness specialist |

None of these is a memory product. All of them own the customer relationship, the roster and the notes. **Their client-notes functionality is storage, not understanding** — a rich-text field attached to a session record, with tags and templates. That is the actual gap, and also the reason they can close it cheaply.

### D3. AI-native coaching products — the crowding evidence

This is the most important section of the research.

| Product | Pricing | What it does | Recording? |
| --- | --- | --- | --- |
| **Wundamental** | €29 / €59 / €99 / €159 per month; 3 free sessions | Records sessions; session recaps with progress tracking; ICF ACC/PCC/MCC competency benchmarking with transcript-linked evidence; **cross-session pattern detection**; **longitudinal client dashboard**; AI chat with full context across entire session history; client progress portal; sponsor ROI evidence; states GDPR-safe | **Yes — core** |
| **Coachful** | Not published in research | *"The coaching CRM that remembers your clients for you."* *"Your client memory is scattered across five different apps."* One client view with goals, notes, tags, tasks, intake; **AI briefing per client** pulling calls, tasks, habits, goals; *"Show up to every call already prepared."* *"Stop forgetting your clients."* | Calls summarised |
| **CoachNova** | **Free for 2 months with one client, then €19 per active client per month** (≈€380/month at 20 clients) | AI "twin" trained on the coach's sessions and archive; **themes tracked and counted** (their own screenshot shows *"avoidance · 3× · pacing · 2× · scope · new"* and *"Avoidance under pressure — 3 sessions"*); goals followed from session two into session six; commitments tracked ("Friday 90-min block · 3 of 4 held · since session 2"); nudges drafted in the coach's voice for the coach to sign off; monetises *former* clients at €50–500/month. Headline: **"Walk into every session knowing where you left off."** Claims 70+ coaches interviewed, 40 co-building, a named design cohort with photos and LinkedIn links, a cohort stock-option pool, and alignment with ICF and EMCC ethics codes | Session-derived |
| **Osmo** | Launched June 2026 | Captures and analyses coaching sessions in real time; automates admin; data-backed insights; claims up to 60% admin reduction. Founded by ex-NVIDIA product leader Antons Davis, San Francisco | **Yes — core** |
| **CoachBase** | Not published | Centralised client timeline with AI summaries; strong craft-led content marketing on session notes | Partial |
| **Kaido** | Not published | Session tracking, notes craft content | — |
| **AgentCoach (Ability.ai)** | Custom, 4–6 week build | Client-facing AI coach agent with comprehensive memory across interactions | N/A |

**Verdict on crowding: rapidly crowding, and the specific "client memory" positioning is already claimed.** Note the shared architectural commitment: with the partial exception of Coachful, every one of these begins with a recorded or transcribed session. That is the seam.

Three details from CoachNova's site are worth isolating because they change decisions elsewhere in this report.

**They own the obvious headline.** *"Walk into every session knowing where you left off."* This was, independently, the phrasing this investigation had arrived at as the strongest available proposition. It is taken. Section G and section V have been revised accordingly, and the collision is a useful warning: the obvious line in this category is obvious to everybody.

**They are already doing the thing section N warns against.** Their own product screenshots display a client tagged *"avoidance · 3×"* and a panel headed *"Tracked across this engagement — Avoidance under pressure · 3 sessions."* That is a psychological characterisation of a named individual, counted and displayed. It validates the risk described in section N, and it is a concrete differentiation opportunity: a product that will not do that, and says so, is making a claim a competitor cannot match without changing its own screenshots.

**Their price is far above the range in the brief.** €19 per *active client* per month means a coach with twenty clients pays around €380 a month. That is not a memory price; it is priced against *revenue expansion* (continuity income from former clients at €50–500 each). The read for section S is that coaches will discuss much larger numbers when the frame is revenue rather than time saved — but that a memory-only companion cannot borrow that anchor, because it does not make the coach any money.

Note also that CoachNova's competitive framing explicitly targets ChatGPT — *"Unsupervised. Flatters back. No coach in the loop"* — alongside the observation that *"1.1B people use ChatGPT weekly. 420M of those conversations are about life and work. No coach in any of them."* They have correctly identified that the real competitor is not other coaching software.

### D4. Adjacent substitutes

| Substitute | Cost | Could a coach use it as client memory today? | What breaks |
| --- | --- | --- | --- |
| **ChatGPT Projects** | Free (5 files) / $20 Plus (25 files) / Pro (40 files) | **Yes, genuinely.** One project per client, project-only memory prevents bleed, files persist across chats, chats reference each other | Coach maintains the context file by hand; no structure; no change history; no provenance; will confidently invent details; no roster view |
| **Claude Projects** | Pro/Max | Yes, equivalent; 30MB per file; RAG for larger bases | Same |
| **Granola** | Free tier / $14 per user/mo Business | Yes, if the coach records. **People and Companies directory** auto-built from calendar; chat scoped to a person's notes; no bot joins; audio deleted immediately after transcription; SOC 2 Type 2; MCP access on all tiers | Requires a calendar event and device audio; no structured commitments/goals; no supersession; no approval boundary; built for meetings, not relationships |
| **Otter / Fathom / Fireflies** | $8.33–$19 per user/mo | Partially | Bot joins the call (mostly); transcripts stored; sales-oriented |
| **Notion / Notion AI** | $8–15/user/mo | Yes, and many coaches do | Manual structure; breaks operationally past ~6 clients per multiple sources; no extraction |
| **Google Docs / Sheets / Apple Notes** | Free | Yes, and most coaches do | Everything is manual; search is textual |

The ChatGPT Projects line is the one that matters. **A coach paying $20/month already has a usable per-client memory system with scoped isolation.** Any pitch must survive the question "why not just make a ChatGPT project per client?" and the honest answer is: *because you have to maintain it, it has no record of what changed, and it will make things up about people it has never heard of.* That answer is true and it is demonstrable — but it is a quality argument, not a capability argument.

### D5. Practitioner voice — what coaches actually say

The most useful evidence is craft writing by practising coaches rather than vendor content. Recurring, quotable positions:

- **The context file already exists as a workaround.** One coach: *"If you don't have one of these yet, make one. It's a plain text document that contains their background, their stated goals, the themes that keep coming up, relevant history… I update mine after every session. Thirty seconds of notes. That file is what lets [the prompt] produce a prep that's actually about this client."* This is the single strongest signal in the whole research: the product is being hand-built by its own market.
- **Notes are for next time, not for the record.** *"Session notes aren't a record of what happened. They're prep for your next meeting."* And: *"Most coaches treat session notes like a transcript… Then they never look at those notes again because there's too much to scan through quickly."*
- **The reread ritual is universal and unresented.** *"Ten minutes before a session, open the client's record. Read the last session's notes. Review what they committed to."* This is your competitor and it is free.
- **Freshness decays fast.** *"After 24 hours, you're reconstructing. After 48 hours, you're fabricating."* This argues for a very fast post-session capture, and against any product that adds friction to it.
- **Structure kills adoption if overdone.** *"A bad template creates its own problem — too long, too clinical, or too generic, and coaches stop filling it in."*
- **AI belongs around the session, never in it.** *"Most coaches reach for AI in the wrong place first. They try to use it in session… The result is a worse session and a worse coach."* And: *"None of these go into a session. The session belongs to the client and to you."*
- **AI must not replace the coach's own noticing.** *"The summary is replacing your memory of the [session]. The fix is to write your own notes first, then run the AI summary against your notes, not the other way around."* This is an explicit endorsement of the coach-writes-first architecture and an explicit rejection of the transcript-first one.
- **Ambiguity must survive summarisation.** One coach describes tuning their prompt because *"I kept getting summaries that were too tidy, too resolved. Real sessions aren't resolved. They end mid-thought half the time. I needed it to hold the ambiguity."* That sentence is, almost verbatim, Lume's ambiguity philosophy.

**Honest limitation on this evidence.** Reddit was inaccessible during this research (403 on direct fetch), and a large share of the searchable material in this niche is AI-generated affiliate SEO content rather than practitioner voice. I have labelled sources in Appendix 2 and excluded the obvious content farms from the claims above. **I did not find first-hand practitioner posts describing memory failure as an acute, named, emotionally charged pain.** I found the workaround, the ritual and the craft advice. That absence is itself evidence, and it is why the verdict is "validate" rather than "build."

### D6. Ethics and regulatory movement (2024–2026)

- **ICF Code of Ethics, effective April 2025, Standard 2.5**: the coach must fulfil ethical and legal obligations *"directly and through any technology systems I may utilize (i.e. technology-assisted coaching tools, databases, platforms, software, and artificial intelligence)."* Standard 2.4 requires records to be maintained, stored and disposed of in a manner promoting confidentiality and complying with applicable law.
- **ICF AI Coaching Framework and Standards (Nov 2024)**: transparency and consent, confidentiality and secure handling, human accountability, bias awareness.
- **Training-body policy**, e.g. iACTcenter: *"NO to uploading or pasting Session Information into AI (recordings, transcripts, chat logs, session information notes, **or your notes about real sessions**)."* Note the last clause — it forbids exactly what this product does.
- **NYC Bar formal opinion, late 2025**: AI notetakers without strict client consent risk violating confidentiality duties.
- **Illinois Public Act 104-0054 (Aug 2025)**: written consent before AI recording/transcription of psychotherapy sessions; New York S.8484 proposed; 40+ related state bills in motion. Coaching is not therapy, but the norm is spreading.
- **EU AI Act Article 50** transparency obligations apply from **2 August 2026** — i.e. now.

This body of movement is simultaneously the single best argument *for* a no-recording, approval-gated product and a live constraint on any product touching client material at all.

---

## E. Exact ICP

### E1. Subsegment comparison

Scored 1 (poor) to 5 (excellent) for this specific product.

| Subsegment | Pain intensity | Recurring clients | Session frequency | Consequence of forgetting | Income | Software spend | Can expense | Privacy sensitivity (higher = worse) | Online targetability | Search intent | **Overall fit** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Executive coaches (C-suite/SVP)** | 5 | 2 (8–15) | 2 (biweekly–monthly) | 5 | 5 | 3 | 5 | 5 (worst) | 2 | 1 | **3.3** |
| **Leadership coaches (director–VP, org-embedded)** | 5 | 4 (12–25) | 4 (biweekly) | 5 | 4 | 4 | 5 | 4 | 4 | 2 | **4.2** |
| **Founder / startup coaches** | 5 | 4 (10–20) | 4 (biweekly–weekly) | 4 | 4 | 5 | 5 | 3 | 5 | 2 | **4.3** |
| **Business coaches (SME owners)** | 4 | 4 (15–30) | 4 | 3 | 4 | 4 | 5 | 3 | 4 | 3 | **3.8** |
| **Career / transition coaches** | 3 | 5 (12–25) | 4 | 2 | 3 | 3 | 4 | 3 | 5 | 4 | **3.4** |
| **Team coaches** | 5 | 1 (2–6 systems) | 1 | 5 | 4 | 3 | 5 | 4 | 2 | 1 | **2.7** |
| **ADHD / productivity coaches** | 4 | 5 (20–40) | 5 (weekly) | 3 | 2 | 2 | 3 | 4 | 4 | 3 | **3.4** |
| **Life coaches** | 3 | 4 | 4 | 2 | 1 | 2 | 2 | 5 (worst) | 4 | 3 | **2.7** |

Notes on the interesting cases:

- **Executive coaches score worse than expected.** Highest fees and highest consequence, but the lowest client counts, longest gaps, greatest privacy conservatism, near-zero software search intent (they buy by referral), and frequent tripartite sponsor complexity. They are the *aspiration*, not the beachhead.
- **Career coaches score worse than volume suggests.** Their engagements are 3–6 months and outcome-terminal. Longitudinal memory over years — the whole value proposition — barely applies. Reject as a target despite good targetability.
- **Life coaches** are the worst combination: lowest income, highest privacy sensitivity, strongest cultural resistance to structure.
- **ADHD/productivity coaches** are genuinely interesting on commitment-tracking and cadence, but the buyer is poorer and the domain drifts toward clinical adjacency and its regulation.
- **Founder/startup coaches** score highest on a criterion the brief did not list: **reachability and AI tolerance**. They are on LinkedIn and X, they buy software without a procurement conversation, and their clients' worlds are dense with named people, board dynamics, funding dates and role changes — the exact shape the product models best.

### E2. Recommended initial ICP

> **Independent leadership and executive coaches, working in English, who hold 10–25 concurrent 1:1 clients on 6–12 month engagements at a biweekly cadence; who bill £/$250+ per hour or the package equivalent; whose clients are senior leaders operating inside organisations, so the material is full of named third parties, politics and dates; who already keep written session notes in Google Docs, Notion or Apple Notes; and who do not record their sessions.**
>
> **Beachhead within that: coaches of technology-company leaders and founders** — because they are reachable on LinkedIn, tolerant of AI, quick to buy, and their clients' worlds change fastest.
>
> **Geography for the test: UK and Ireland first, then Netherlands, Nordics and Germany, then the US East Coast.** UK/IE because English-native, GDPR-literate (which turns your privacy posture into a selling point rather than a hurdle), a dense ICF chapter network, and a manageable time zone for founder-led sales.

### E3. Explicit non-targets for v1

Life coaches. Health and wellness coaches (Practice Better owns them and HIPAA changes the build). Career/outplacement coaches (engagements too short). Team and systemic coaches (wrong unit of memory). Internal/employed coaches (procurement, and their employer buys the suite). Coaching firms and networks (multi-coach permissions is a different product). Coaches who already record every session (they are Wundamental's and Granola's customers, and converting them means arguing them out of a workflow that works).

---

## F. Competitive gap

**This section was substantially rewritten after the deeper competitive sweep.** Three of the four gaps claimed in the first draft turned out to be thinner than stated. What follows is the honest remainder, ordered by how much of it survives contact with CoachRocks.

### F0. What is not a gap — stated first, because the list is long

Session notes. Templates. AI session summaries. Pre-session prep briefs. Cross-session Q&A over a client's whole history. Longitudinal client timelines. Theme and pattern detection. Goal tracking. Commitment tracking. Client portals. Scheduling, billing, contracts, courses. ICF competency feedback. Sponsor ROI reporting.

Every one of these ships today, most of them at $25–$59/month. Do not build them and do not claim them.

### F1. Nobody serves the coach who will never record — **downgraded**

The first draft called this architectural and uncontested. It is neither, quite.

It is true that Wundamental, Osmo and CoachNova are transcript-first, that Wundamental's ICF benchmarking *requires* a transcript to cite evidence against markers, and that the professional norm is hardening — ICF Standard 2.5, training bodies banning session material in AI, the NYC Bar opinion, clients declining bots, and coach craft writing that says plainly *"AI belongs around the session, not in it."*

But **CoachRocks accepts unlimited manual transcript uploads on both its free and paid tiers**, and SessionFlow accepts phone voice-memo uploads. A coach who refuses to record can already use them. Recording is their default, not their gate.

What survives is narrower and rhetorical rather than structural: no competitor *leads* with never being in the room, and none can say the whole sentence — *"nothing you say is recorded or transcribed, and nothing about you is stored that I haven't personally read and approved."* That is a marketing position with real value in ICF and training-school channels. It is not a defence.

### F2. Nobody models the client's world — **the one gap that strengthened**

Every competitor models the *coachee*: their goals, their progress, their commitments, their journey arc. That is the coaching-textbook model, and it is incomplete for executive work.

Executive coaching is substantially about **other people**: the skip-level who controls the promotion, the peer who went quiet, the new CEO, the board member with the opinion, the direct report being managed out, the reorg in November. A coach's real preparation question is not "how is Sarah progressing against goal two?" It is "what is going on with Martin, and did she have that conversation?"

Lume already models exactly this: durable person identity, **scoped** responsibilities (owning UX sign-off does not make you the project owner), relationship supersession, availability windows, and a hard rule that two people with the same name are two people. That machinery has no analogue anywhere in the coaching software market.

The sharpest positioning line available: **"Coaching software tracks your client. It doesn't track the people around them."**

### F3. Nobody separates proposal from truth — **downgraded to a narrow architectural remainder**

The first draft claimed this outright. The claim was wrong as stated. **CoachNova already markets** *"Nothing reaches your client without your review. Ever. The AI proposes. You approve. That's what coach-supervised means."* **SessionFlow already says** *"grounded in your approved session notes."* **Coachful** gates data-changing actions behind confirmation cards.

The distinction that survives is real but fine-grained, and hard to sell. Those products approve **summaries** (an editable draft) or **outbound messages** (a confirmation card). None exposes a **typed, reviewable fact ledger** — goals, commitments, people, dates, decisions and concerns as individually approved records, each with a lifecycle, a supersession pointer and provenance. CoachUI's *"always-updating client ledger"* is the closest and it is genuinely close; the difference is that theirs updates itself and the coach never sees the ledger as a set of decisions.

Be honest about what that is worth: it is better engineering, it produces a materially better record, and **CoachRocks could ship a version of it in a sprint.** It is a reason the product would be good. It is not a reason it would survive.

### F4. Nobody can answer change-over-time questions properly — **partly holds**

"What has changed about her relationship with Martin?" and "when did she first mention leaving?" are not summarisation questions. They require that every fact carries a lifecycle (`current` / `superseded` / `historical`), a `supersedes` pointer, and provenance back to the sentence in the note that produced it — recorded at write time, not reconstructed later.

A competitor who stores a summary per session can search the summaries. They cannot tell you the date a belief changed, or show you the exact sentence that changed it, because they never modelled beliefs as things that change. Lume did, from the beginning, and it is the single most transferable piece of the data model.

### F4b. The one genuinely open commercial position: be the memory layer, not the platform

This did not appear in the first draft and it is the most valuable finding in the section.

**CoachAccountable has publicly refused to build AI, and then built the door for someone else to.** Founder John Larson, April 2026: *"I don't think coaches using AI for coaching their clients particularly benefits clients… so I'm reluctant to grease those rails for thousands of coaches by adding such AI shortcuts."* Four months later, on 17 August 2026, he shipped the compromise — an API and webhooks explicitly framed for third-party AI: *"I've heard interest from numerous note takers… it doesn't make sense for me to build full-on integrations with each one. But because AI knows how to AI, [an agent] from whichever source can readily post whatever [to the] `Session.add` API."*

**Paperbell has no AI whatsoever** — none on its pricing page, none in its feature list — and a large installed base.

Both have run for a decade or more, both are trusted, and neither intends to compete on this. Their customers are exactly the ICP in section E, already paying, already keeping session notes, and already inside a system with an open write API.

This is smaller and less glamorous than a platform. It is also the only route found in this research that inherits distribution rather than fighting six competitors for it, in a market that has twice punished companies for lacking distribution. It changes the product from "the seventh client-memory app" to "the thing that makes the tool you already trust remember," which is a much easier sentence to sell and a much harder one for CoachRocks to copy — because CoachRocks needs you to leave the platform, not enrich it.

The obvious counter is dependency risk: you would be building on someone else's API, at their discretion, with their churn. That is a real cost and it caps the outcome. It is still better than the alternative.

### F4a. A fifth, smaller gap: restraint as a feature

Related to F3 but worth separating, because it is marketable in a way the others are not. Competitors are actively racing toward characterising the client — counted themes, tracked traits, progress arcs, ROI evidence. A product that publicly commits to *not* doing that (see section N) can make a promise none of them can:

> *"This organises what you write. It does not assess, diagnose, score or form opinions about your clients."*

That sentence is a differentiator, an ethics position, and a roadmap constraint at the same time. Its value is that it is costly to say — a competitor who has already shipped theme-tagging cannot adopt it without deleting a feature from their homepage.

### F5. Explicitly not gaps

Session notes. Templates. AI session summaries. Pre-session briefs *in general* (Coachful ships one). Goal tracking with progress bars. Commitment/accountability tracking (CoachAccountable's entire product). Client portals. Scheduling. Billing. Contracts. Course delivery. ICF competency feedback. Sponsor ROI reporting. Do not build any of these and do not claim any of them.

---

## G. Product proposition

### G1. The candidate proposition, tested

> *"Remember every client like they're your only client."*

**Reject.** Three reasons. It is substantively Coachful's live headline, so it is a collision rather than a position. It implies the software does the remembering, which is exactly the framing that makes a coach uneasy — the relationship is theirs. And "remember" is a capability claim that every competitor also makes, so it does not differentiate.

The brief's alternative ad line — *"Your client remembers what they told you six months ago. Do you?"* — is a strong **hook** and a weak **proposition**. It is accusatory, and coaching culture is built on non-judgement; a profession that prizes unconditional positive regard will notice being shamed by an advert. Test it as a high-variance ad headline; do not build the brand on it.

### G2. A near-miss worth recording

This investigation independently arrived at *"Walk into every session like they're your only client"* as the strongest available line — and then found that CoachNova's live site reads **"Walk into every session knowing where you left off."** Same verb, same moment, same promise. The obvious line in this category is obvious to everybody, which is itself a measure of how crowded it has become. Both the hero and the natural tagline ("Where we left off") are therefore unavailable, and the recommendation below is the revised one.

### G3. Recommended proposition

> **Everything they've told you. Ready before you are.**
>
> Write a few lines after each session. Before the next one, get the whole picture back — what they committed to, who's in their world, what's changed, and what you left unfinished.
>
> **We're never in the room. Nothing enters a client's picture until you've approved it.**

Why this survives where the alternatives do not. It puts the *client's disclosures* in the subject position rather than the coach's memory, which sidesteps the accusation entirely — nobody is being told they forget. "Ready before you are" carries the whole product in four words: it is already done, and it is waiting. It does not collide with any competitor copy found in this research. And the third line does the differentiation in fifteen words, unprompted, which matters because the differentiation is the part competitors cannot copy.

The strongest alternative, and the better line for search traffic where intent is already formed, is **"Six months of context. Sixty seconds."**

### G4. The one-sentence version

> **The place a coach keeps what they know about each client, so that six months of context takes sixty seconds to get back.**

### G5. What the product is emphatically not

Not a CRM. Not a practice-management suite. Not a scheduling or billing tool. Not a client portal — the client never logs in and never sees anything. Not an AI coach — it never speaks to the client. Not a notetaker — it is not in the room. Not a supervision or competency-assessment tool. Not a reporting tool for sponsors.

That last exclusion is deliberate and worth defending. Sponsor-facing ROI reporting is what Wundamental sells and it is tempting revenue, but it converts the product from *the coach's private thinking space* into *evidence about the client*, which changes the consent conversation, the confidentiality posture and possibly the EU AI Act risk classification. Stay out.

---

## H. Smallest compelling product

The test for inclusion: **would a coach with fifteen clients pay €39 a month for this alone, with nothing else in the product?**

### H1. In scope

**1. The client picture.** One page per client showing what the product currently understands: a short prose paragraph of where they are now; what changed since last session; open commitments (theirs and yours); dates in the next six weeks; goals; the people in their world; unresolved concerns; and the session list. Everything on it is inspectable — click any statement and see which session it came from and what the note actually said.

**2. Session note in, structured change out.** The coach types, pastes or dictates after a session. The product proposes changes in plain language. Ambiguous things become questions. The coach approves. Approved changes become the picture. This is the only way information enters the product on the primary path.

**3. Prepare me.** One action on the client page produces a short prose brief, readable in ninety seconds, printable, and available on a phone.

**4. Ask, scoped to one client.** Free-text questions over that client's whole history, answered with dates and citations back to the source note. Read-only; asking never changes the picture.

**5. Bulk first-load.** Paste or upload existing notes for a client — several sessions at once — and get a picture immediately. This is an onboarding feature, but it is load-bearing for activation and cannot be deferred.

**6. Archive and export.** End an engagement without losing the picture; reopen it if the client returns; export everything as readable files at any time; delete a client completely and verifiably.

### H2. Explicitly out of scope for v1

Cross-client anything, including a portfolio view, cross-client search, or "your week ahead". Themes and patterns as a persisted feature (see section N — read-only observations only, if at all). Any client-facing surface. Scheduling, calendar sync, billing, invoicing, contracts, intake forms. Recording or transcription of sessions. Group and team coaching. Multi-coach accounts and permissions. Goal progress scoring, dashboards, charts, or any numeric representation of a human being. Sponsor reporting. Mobile apps (responsive web only). Integrations of any kind, including Notion and Google Docs sync. Email or Slack ingestion. Reminders and notifications — including, especially, "you haven't written up Tuesday's session."

### H3. The three judgement calls

**Is Session a first-class durable entity? Yes.** This is the most important domain decision in the report and it is argued in section M. Everything the coach thinks about is anchored to "the session on the 14th."

**Does the coach have to approve everything? No — but everything is shown.** Unambiguous items arrive pre-approved and are dismissed with one glance; ambiguous items block. The philosophy Lume already holds — the user must have *seen* the whole interpretation before submission, even if most of it is one click — is correct here and should carry over unchanged.

**Is dictation in v1? Yes.** Not session recording — a sixty-to-ninety-second spoken debrief by the coach, in the car, after the call. It is the single highest-leverage input because it collapses the friction at the exact moment the craft literature says the note must be written ("after 48 hours you're fabricating"). It is also cheap: ninety seconds of Whisper-class transcription is fractions of a cent, where a sixty-minute session recording would be a hundred times that and would break both the margin and the positioning.

---

## I. Core loop

### I1. Initial client setup — once, target under four minutes

The coach enters a name and pastes whatever already exists: last session's notes, a Google Doc, three years of scribbles. There is no form, no intake wizard, no goal-setting step, no required fields beyond the name. If they have two or three past sessions, the product asks for them — because two sessions is the minimum for "what changed", and "what changed" is the moment the product stops looking like a summariser.

### I2. Before the session — target ninety seconds

Open the client, read the brief. On a phone between calls, or on a laptop while the Zoom link loads. The brief should be readable without scrolling on a laptop, and it should read like a colleague briefing you, not like a dashboard.

### I3. During the session — nothing

This is a designed absence and it should be stated in the marketing. The product is closed. No note-taking surface, no live prompts, no recording, no "coach assist". The craft literature is unanimous and the ethics bodies agree; being the product that is proudly *not* in the room is a position, not a limitation.

### I4. After the session — target sixty to ninety seconds

Open the client, hit the note action, type or dictate 100–300 words in whatever shape the coach naturally writes. Proposals appear grouped by meaning. Most are pre-ticked. One or two may ask a question. One button saves.

Ninety seconds is the hard budget. The competitor is a Google Doc and a keyboard, which takes about sixty. If the product is slower than typing into a doc, the loop breaks and nothing else matters.

### I5. Between sessions — occasional, unscheduled

Two behaviours. Adding a note when something happens outside a session (the client emails; the coach remembers something in the shower). And asking a question — *"which commitments are still open?"*, *"when did she first mention leaving?"* This is low-frequency and that is fine; it is the behaviour that produces the "I couldn't have got that anywhere else" moment.

### I6. Ongoing review — deliberately none

There is no weekly review ritual, no inbox to clear, no hygiene prompts, no "you have 4 unreviewed items". Any product for self-employed professionals that accumulates a queue will be abandoned when the queue gets embarrassing. If something needs the coach's judgement, it waits inside the next session note for that client and appears at exactly the moment the coach is already thinking about that person.

### I7. Closing and archive

Engagements end. Archive the engagement; the picture is preserved and read-only; the client moves to a collapsed section of the list; they stop counting against the plan limit. If the client returns in eighteen months — which is common, and is the thing CoachNova is monetising — reopening restores everything.

### I8. What would make this fail because it asks too much

Ranked by how quickly it kills the product:

1. **Any requirement during the session.** Instant failure.
2. **A review queue that accumulates across clients.** The coach opens it, sees 34 items, and never opens it again.
3. **Structured entry: fields, dropdowns, required tags, goal-setting wizards.** This turns the product into the admin the coach is paying to avoid.
4. **Post-session capture that takes longer than typing into a doc.** The loop must be faster than the incumbent behaviour, not merely better.
5. **Requiring historical migration before any value appears.** The coach will not retype a year of notes on a promise.
6. **Correction rate above roughly one item in ten.** Above that, the approval step stops feeling like confirmation and starts feeling like proofreading someone else's work.
7. **Notifications and nudges, especially about overdue write-ups.** Coaches already feel behind. A product that adds guilt gets cancelled.
8. **Anything the client has to do.** No portal, no forms, no consent flows the coach has to administer beyond a paragraph they paste into their own agreement.

---

## J. First-run and wow moment

### J1. The design constraint

The coach must not have to build a CRM, and must not be shown an empty state. They also should not be shown a sample client *first* — samples read as demos, and a demo is something you watch rather than something that is yours. Show the sample only as an escape hatch for the hesitant.

### J2. The sequence

**First screen after signup.** No dashboard, no tour, no checklist. One question, centred: **"Which client shall we start with?"** A name field. Below it, a large text area: *"Paste anything you've got about them — your last session's notes, a doc, three years of scribbles. Messy is completely fine."* Two quiet links underneath: *dictate instead* and *show me an example client first*.

**First action.** They paste. Realistically 200–2,000 words of imperfect prose. No format required, no template, no instruction about what to include.

**First extraction.** The product reads it and comes back with proposals in plain language grouped by meaning, not by entity type:

> *Sarah is aiming for the VP Product role, decision expected in the autumn.*
> *She committed to speaking to Martin before your next session.*
> *Martin — you've mentioned him as her skip-level. Is that right, or a different Martin?*
> *The board presentation is on 3 September.*
> *She's worried the reorg will move her team under Finance.*

**First review.** Four of the five arrive ticked. One asks a question and cannot be saved until answered. The coach clicks once and saves.

**First picture.** The client page appears, populated. It is not a form the coach filled in — it is a page that assembled itself out of something they wrote badly on a train.

**The prompt for the second paste.** Immediately, quietly: *"Got an earlier session? Paste that too — it's how I learn what's changed."* This is the most important line in onboarding, because everything genuinely differentiated requires two points in time.

**First wow.** They paste session one. The product does not just add facts — it **reconciles**:

> *Since 14 May:*
> *Her target moved from the VP Engineering role to a lateral move into Product.*
> *Martin went from "blocking her" to "more supportive" — she said that on 11 June.*
> *Two commitments from 14 May are still open.*

Every one of those statements is clickable, and clicking shows the exact sentence in the exact note on the exact date that produced it.

### J3. Activation event

Not signup. Not first client. Not first extraction.

> **The coach approves an extraction from a *second* session for the same client, and then opens Prepare Me.**

That is the moment both halves of the loop have closed and the product has done something the coach could not have done by rereading. Instrument it, report it weekly, and optimise everything upstream toward it.

### J4. Why this beats Notes + ChatGPT in the first ten minutes

ChatGPT will summarise anything you paste, and it will do it well. Three things it will not do in those ten minutes:

**It will not reconcile two sessions into a diff unless you ask it to, and it will not remember the answer next month.** The coach would have to paste both notes into a fresh chat and phrase the comparison. Here it happens because two notes exist.

**It will not show you where a claim came from.** ChatGPT's summary is a wall of confident prose with no seams. This product's every statement traces to a sentence in a dated note. When a coach is about to walk into a room and say "last time you said you'd talk to Martin," the difference between *the AI told me* and *here is the sentence, from 14 May* is the difference between using it and not.

> **Correction — this does not currently work in Lume, and it is the central demo.** Verification of the code found that Capture writes provenance as `[{ type: "capture", at: <timestamp> }]` with the optional `id` field **left unset**. The `capture_sessions` table stores the raw transcript, but durable facts are not foreign-keyed to it, and todos, risks and milestones have no provenance column at all. So the product can today say *"learned from a Capture"* and *when*, but it **cannot** show you the sentence that produced a fact.
>
> That is a small schema change and a discipline change, not a redesign — but it is load-bearing for the entire proposition in this section, and it is currently absent. It is raised as question Y9a.

**It will invent Martin.** Ask a model who Martin is and it will oblige. This product's answer to an ambiguous Martin is a question, and the coach who watches it *decline to guess* in minute four learns something about it that no amount of accurate output would teach.

The compressed demo answer, then: **paste two sessions, watch it tell you what changed, click a statement, see the sentence.** Provenance is the wow. Everything else is table stakes by 2026.

---

## K. Product semantics

Lume's vocabulary is programme-management vocabulary and most of it must not survive. Renaming mechanically would produce a product that reads like a PMO tool with a soft colour palette, which is the single most likely way to lose this audience in the first thirty seconds.

### K1. Recommended vocabulary

| Concept | Lume term | **Recommended** | Rejected, and why |
| --- | --- | --- | --- |
| The person being coached | Project | **Client** (nav, everywhere) | *Coachee* — jargon, and coaches actively disagree about it. *Case* — clinical. *Account* — corporate. *Subject* — clinical and cold |
| The contracted period of work | — | **Engagement** (secondary; visible on the client page, never in nav) | *Programme* — corporate. *Contract* — commercial framing |
| Writing up a session | Capture | **Add session note**; the surface is *"After the session"* | *Capture* — surveillance-flavoured, and it is engineering vocabulary. *Log* — clerical. *Remember* — twee, and it flatters the software. *Update* — vague |
| The accumulated understanding | Knowledge Centre | **The picture** — page heading *"Where Sarah is now"*; nav label *Picture* | *Client memory* — implies the software owns the person. *Profile* — CRM. *Record* — clinical. *Dossier* — sinister. *Knowledge base* — corporate |
| Things people said they'd do | To Do | **Commitments** (the client's) and **My follow-ups** (the coach's) — two labels, because the owner matters more than the item | *Actions* — corporate/PM. *Tasks* — admin. *Homework* — patronising. *Accountability items* — heavy, and it is CoachAccountable's language |
| Unresolved worries | Risk | **Watching** — frame heading *"Things I'm watching"* | *Risk* — implies the client is a risk to be managed. *Blocker* — PM. *Issue* — support ticket. *Red flag* — judgemental. *Concern* is acceptable as a fallback |
| What the client is working toward | Milestone | **Goals** — separated from dates | *Objective* / *OKR* / *KPI* — corporate. *Outcome* — acceptable but abstract |
| Calendar-relevant facts | Milestone / Timeline | **Important dates** — frame heading *"Coming up"* | Conflating goals and dates, which Lume currently does |
| The people around the client | Stakeholder | **People** — frame heading *"People in her world"* | *Stakeholder* — the single worst word to carry across; it is corporate, and it reduces a person's boss to a delivery input. *Relationships* as a nav item — too intimate, reads like HR |
| Pre-session briefing | Meeting Prep | **Prepare me** (the action) → *Session prep* (the page) | *Briefing* — corporate. *Pre-call* — sales |
| Chronology | History | **Timeline** (the list) and **What's changed** (the diff) | *Journey* — coaching cliché, used by every competitor. *Audit trail* / *Changelog* — engineering |
| Asking across a client's history | Tell Me / Ask Lume | **Ask** | *Chat* — trivialising. *Copilot* / *Assistant* — generic. Any product-name-as-verb |
| AI observations | ✦ Lume noticed | **Worth revisiting** | *Insights* — empty. *AI suggests* — foregrounds the machine. *Patterns detected* — surveillance |
| Blocked ambiguity | Needs you | **Needs you** — keep it, it is excellent | Alternatives if needed: *Check this*, *One thing to confirm*. Never *Error*, never *Conflict* |
| Recurring topics | — | **Keeps coming up** | *Themes* — clinical drift. *Patterns* — pseudo-psychological. Prefer a verb phrase to a noun, because nouns become labels and labels become diagnoses |
| Catch-up | Catch Me Up | **Catch me up** — keep, as the lighter mid-engagement variant of *Prepare me* | — |

### K2. Words to ban outright

From PM: stakeholder, RACI, dependency, blocker, sprint, backlog, milestone, workstream, status (healthy/watch/at-risk), delivery, escalation.

From clinical practice: case, subject, presentation, intervention, treatment, diagnosis, assessment, progress note, clinical, session record.

From analytics: score, index, health, sentiment, engagement rate, progress percentage, benchmark, ROI, trend, at-risk client.

From AI marketing: AI-powered, intelligence engine, insights, deep learning, digital twin, second brain, knowledge graph.

The three most dangerous — because they are the ones a product team drifts into without noticing — are **status on a person**, **score on a person**, and **profile**. Any of them, shipped once, tells the coach this software regards their client as a record.

### K3. How coaches actually talk

Observed register from craft writing: *"where we left off"*, *"what they committed to"*, *"the thread"*, *"what's alive for them"*, *"open loops"*, *"what I noticed"*, *"my read"*, *"what I want to return to"*, *"where to start next time"*, *"holding it"*, *"unfinished"*.

Two are directly usable. **"Where to start next time"** is a widely recommended note section and would make an excellent, unmistakably native, prep-brief heading. **"My read"** is exactly the right label for coach-authored interpretation, and it does the epistemic work automatically — it marks the content as the coach's opinion, not the product's finding.

---

## L. UX and information architecture

Lume's Capture | Knowledge Centre | Advise mode bar should **not** survive. It is an engineering artefact that turns writing a note into *going to a place*, when it should be a *moment*. It also gives equal billing to three things of unequal importance.

Descriptions below are wireframe-level prose, as requested.

### L1. Top-level navigation

Two items and an account menu. **Clients** and **Ask**. Nothing else — no dashboard, no home, no reports, no settings in the primary rail. On a laptop this is a slim left rail; on a phone it collapses into the header.

The absence of a dashboard is deliberate. A dashboard for fifteen human beings is a control panel for people, and it is the fastest route to the product feeling clinical.

### L2. Client list

A single calm vertical list, **sorted by next session** rather than alphabetically, because that is the order the coach's week actually has. Each row is one line high plus a subordinate line: the client's name in normal weight; underneath, in muted text, the single sentence of where they are now; on the right, the next session if known ("Thu 10:00") and, when relevant, one quiet marker — a small dot meaning there is something unreviewed, never a count, never a badge, never red.

At the top, a single search field that filters by name and searches text across all clients. At the bottom, a collapsed row reading "Past clients (14)" that expands into archived engagements. The primary action, a single button in the top right, reads **Add a client** — not "New client", not a plus icon alone.

No cards. No avatars generated from initials in coloured circles. No status pills. The list should look like a well-kept notebook index, not a CRM.

### L3. The client page

One continuous scrolling page, no tabs, no accordions. The order is the order a coach's mind moves in during the two minutes before a call.

**At the very top**, the client's name, the engagement in small text beneath it ("Engagement 2 · started March · session 9 of 12"), and two persistent actions on the right: **Prepare me** as the primary, and **Add session note** as the secondary. These two never scroll out of reach — on a laptop they pin to the top of the viewport once the header passes; on a phone the note action becomes a floating button.

**Where Sarah is now.** Three or four sentences of prose, not bullets. Generated from the picture, editable by the coach — and once edited, held as the coach's own words until they choose to regenerate. This paragraph is the single most-read object in the product and it should read like something a thoughtful colleague wrote, not like a summary.

**Since last time.** Only appears when there is something. A short dated list of what changed, in the form *"Her target moved from VP Engineering to Product — 11 June"*, with the previous value visible on hover or tap. Suppressed entirely for a first session, which avoids the empty-state problem.

**Open commitments.** Two subtly separated groups under one heading: hers, and yours. Each line carries the date it was made and the session it came from, and — critically — a quiet marker when a commitment has survived more than two sessions without being mentioned again, phrased as *"made 14 May · not mentioned since"* rather than as an overdue warning. Checking one off is a single click; the product never assumes completion from silence.

**Coming up.** Dates in the next six weeks, as a short dated list. Board presentations, reviews, holidays, reorg dates, her daughter's exams if she mentioned them. Nothing outside six weeks unless the coach expands it.

**Goals.** One to three, in her words wherever possible, each with the date it was set. Clicking one reveals its history: what it was before, when it changed, and the sentence that changed it. Goals are prose, never progress bars.

**People in her world.** Small cards in a two- or three-column grid. Each card: name, one line of relationship in natural language (*"her skip-level — controls the promotion decision"*), and, when it exists, one line of what recently changed (*"she said he's been more supportive — 11 June"*). Cards with recent changes carry a subtle marker. Clicking a card opens a drawer with everything the record holds about that person and every session they were mentioned in.

**Watching.** Unresolved concerns, as prose lines. Resolving one is a single action and the resolved item moves into the timeline rather than vanishing.

**Keeps coming up.** Read-only observations with evidence links, individually dismissible, and — per section N — always phrased about the record rather than about the person. If the safeguards in section N cannot be made to hold, this frame does not ship.

**Sessions.** Reverse-chronological, one line each: date, and the first clause of what the session was about. Clicking opens a drawer showing the coach's original note exactly as written, alongside what was extracted from it and what the coach approved. This drawer is where trust is repaired when something is wrong, so it must be easy to reach and honest about provenance — including, per Lume's existing honesty-note pattern, saying plainly when provenance is missing rather than inventing it.

### L4. Writing a session note

A full-height sheet sliding over the client page, not a separate route — because the coach is thinking about Sarah and should not lose Sarah.

**Top:** "Session with Sarah — Thursday 14 August" with an editable date, because notes get written on Saturday.

**Middle:** one large, quiet text area with a placeholder that gives permission rather than instruction: *"However you normally write it. Fragments are fine."* A microphone button for dictation, which transcribes into the same field and remains editable.

**Bottom:** one button, **Read this**.

Then the same sheet transitions to review. Proposals are grouped by meaning, in the order a coach would care:

> **She committed to**
> — Speak to Martin before the next session ✓
>
> **Something changed**
> — Her target: VP Engineering → lateral move into Product ✓
>
> **New dates**
> — Board presentation, 3 September ✓
>
> **I need to ask you**
> — Is this the Martin who is her skip-level, or someone else? [ Same Martin ] [ Different person ] [ Skip this ]

Ticked items are one line each with a check on the left. Unticking is one click. Any line expands on click to show the sentence in the note it came from. The blocking questions float to the top of the review and are the only things preventing the single closing button, **Save to Sarah's picture**.

Review lives here and nowhere else. There is no separate review inbox, because a queue is an admin surface and admin surfaces get abandoned.

### L5. Session prep

A single, quiet, printable page. Prose, in second person, in the register of a colleague:

> *You last spoke on 14 May, six weeks ago.*
>
> *She's decided against pushing for VP Engineering and is exploring a lateral move into Product — that shifted on 11 June, having been the opposite in March.*
>
> *She committed to speaking to Martin before this session and hasn't mentioned it since. Two other commitments from 14 May are still open.*
>
> *Her board presentation is on 3 September. She was anxious about it in April.*
>
> **Where you might start**
> *— How the Martin conversation went.*
> *— Whether the Product move still feels right after six weeks.*

Three or four short paragraphs and two or three suggested openings, phrased as possibilities rather than instructions. No cards, no icons, no confidence indicators, no headings beyond the one. It must fit on a phone screen with one scroll and print onto one side of A4, because a meaningful number of coaches will print it.

### L6. Ask

Reached two ways: the top-level nav item, and a quiet field at the bottom of a client page. Client-scoped by default, with the client's name pre-filled and removable.

Answers are short prose with dates, and every factual claim is a link back to the session that produced it. When the record does not support an answer, the product says so — *"Nothing in Sarah's record mentions the Chicago move"* — and does not speculate. When the record is contradictory, it says that too, and offers to resolve it.

Below the field, three or four deterministically generated suggested questions drawn from what actually exists in that client's record — *"Which commitments are still open?"*, *"What's changed since March?"*, *"What has she said about Martin?"* — rendered as quiet text links, not buttons. Lume already builds these deterministically and the pattern should carry over.

### L7. Mobile

Two things only, and they should be excellent: **read the prep brief**, and **dictate a note**. Both are things coaches do standing up — in a corridor, in a car park, on a train. Everything else, including review of anything ambiguous, is available but not optimised; a dictated note on mobile can be saved as a draft and reviewed properly later, which is better than forcing a fiddly approval flow on a phone.

### L8. Cards, timelines, tables and charts

Cards for people, because a person is a bounded thing with a face-shaped amount of information. A simple dated list for sessions and for dates. Prose for the current picture, the prep brief and Ask answers. Expandable lines for commitments and goals.

**Never a table.** Tables make people into rows.
**Never a chart.** There is nothing about a human being's development that is honestly representable as a line going up.
**Never a progress bar.** Every competitor has one and every one of them is a lie.

### L9. How AI appears

Lume's sparkle convention — the glyph means *this action invokes AI* — is a genuinely good piece of product design and should carry over unchanged. AI is visible in exactly three places: **Read this** (extraction), **Prepare me** (synthesis), and **Ask** (reasoning). Everywhere else the product is a calm document that happens to be well organised.

No chat bubble in the corner. No "AI is thinking" animations beyond a plain progress indicator. No confidence percentages on the client page — confidence is a review-time concept and, as Lume's own philosophy insists, once something is approved it should look like ordinary knowledge, not like an AI alert.

### L10. Avoiding the administrative feeling

Four rules, in priority order.

**The coach should never see an empty form.** Everything is created by writing prose about a session. There is an "add manually" affordance for corrections, but it lives in a detail drawer, not on the primary path.

**Nothing accumulates.** No queue, no inbox, no unread count, no overdue state. The only pending thing is inside the next note for that client.

**Nothing is red.** Not overdue commitments, not unresolved concerns, not stale clients. Muted markers only. Red is for errors, and a human being's life is not an error state.

**The product never tells the coach they are behind.** No streaks, no "you haven't written up 3 sessions", no completeness meters. The coach is a self-employed professional carrying a great deal; adding a scold loses them permanently.

---

## M. Domain and data model

The critical section. The headline conclusion is that the most tempting mapping is wrong.

### M1. Project ≠ Client

The obvious move — rename `project` to `client` — breaks on the first renewal. Coaches routinely run a second engagement with the same person, sometimes a year later, sometimes in a new company. If Client is a Project, either the memory is severed at the engagement boundary (destroying the compounding value that is the entire retention thesis) or engagements are conflated and the coach cannot tell which contract a commitment belonged to.

The correct shape has **three** levels where Lume has two:

```
Practice (Lume: workspace)          the coach's account
  └── Client (NEW — a person)       durable identity; survives engagements
        └── Engagement (Lume: project)   a contracted period
              └── Session (NEW as first-class)   a dated conversation
```

Everything durable hangs off **Client**, not Engagement. Engagement is a *period label* and a scoping device for contracts, cadence and archiving — not the owner of truth. This is a genuine structural difference from Lume, where `project_id` is the scoping key on almost every row and where the whole application filters by selected project.

Encouragingly, Lume's own convergence decisions already point the right way: Part C §C7 records a binding target of **workspace-scoped Person identity with project-scoped participation** — which is structurally the same insight — with the correct identity principles already reasoned out (stable IDs own identity; a name is not identity; same-name people must remain representable; no unique-name constraint; ambiguous name-only resolution fails closed). That slice is **decided but not built**. Coaching would be its forcing function.

### M2. Session must be first-class

Yes, unambiguously, and this is the second-largest change.

Three reasons. The coach's entire mental model is anchored to sessions — "we talked about that in June", "that was two sessions ago". Chronology *is* the product: "since last time", "when did she first say that", and "not mentioned since" are all session-relative and cannot be computed from timestamps alone, because a note written on Saturday describes Thursday's session. And provenance needs a session anchor to be meaningful to a human; "learned from capture #4a7f" is useless, "you wrote this after the session on 14 May" is the whole trust mechanism.

In Lume, `capture_sessions` exists but is documented as underused relative to client-side lists (open discovery D-013). Here it becomes a core table with a session date distinct from the note's creation date, a sequence number within the engagement, the raw note preserved verbatim, and the set of changes approved from it.

### M3. Entity-by-entity translation

For each existing Lume entity: **reuse unchanged**, **terminology-only**, **schema extension**, **domain replacement**, or **discard**.

| Lume entity | Coaching concept | Classification | Reasoning |
| --- | --- | --- | --- |
| `workspaces` / `workspace_members` / `profiles` | Practice / coach account | **Reuse unchanged** | Single-user-first with a membership model already in place. Coaching is single-user; the membership layer is harmless and useful if a coach ever adds an assistant |
| `projects` | **Engagement** | **Terminology + schema extension** | Needs `client_id`, `started_at`, `ended_at`, `cadence`, `sessions_contracted`, `archived`. Loses `code`, `currentFocus`, `status` |
| `projects.status` (HEALTHY / WATCH / AT_RISK) | — | **Discard, permanently** | A RAG status on a human being. The single most damaging thing that could survive the port. Must be deleted, not renamed |
| — | **Client** (person) | **New entity** | The durable identity above engagement. Structurally the same as Part C §C7's `people` table, and the same identity principles apply verbatim |
| `stakeholders` (project-scoped person + role) | **People in the client's world** | **Reuse, terminology-only** | The best fit in the whole model. Scoped, non-global, no unique-name constraint, `personId` not name as identity. Semantics translate directly: *"@Ava Chen · UX design sign-off"* → *"Martin Reeves · her skip-level, owns the promotion decision"* |
| `knowledge_items` + canonical metadata (`kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta`, `provenance`) | **The client picture** | **Reuse, with an extended `epistemic` enum** | The single most valuable transfer. Supersession plus provenance plus lifecycle is precisely what "what changed and when" requires, and no competitor has it. Needs a new epistemic value for reported speech (M4) |
| `knowledge_items.kind = responsibility` | Scoped relationship facts about people | **Reuse, terminology-only** | *"who owns what"* → *"who is what to her, and what they control"*. Multi-owner and share-vs-replace semantics carry over |
| `todos` | **Commitments** and **My follow-ups** | **Schema extension** | Needs a hard owner axis: `client` / `coach` / `third_party`. Lume's `waitingOn` is a *text name*, not a foreign key, which is inadequate here — attributing a commitment to the wrong person is a top-three failure mode |
| `todos.kind` (ACTION / WAITING / CHASE / REMINDER) | — | **Domain replacement** | Replace with an owner axis plus a simple open/closed state. REMINDER is unimplemented in Lume and unwanted here |
| `risks` (+ `open`/`watch`/`resolved`/`accepted`) | **Watching** / concerns | **Reuse, terminology-only** | The four-state lifecycle maps cleanly, including *accepted* — "she knows and has decided to live with it" is a real coaching state. The rule that a resolved item must never resurrect from prose is directly relevant |
| `milestones` (`MissionState.timeline`) | **Important dates** | **Reuse, terminology-only** | Board presentations, reviews, holidays, reorg dates, start dates. Add a `source` distinguishing client-stated from coach-inferred |
| — | **Goals** | **New entity, built on the knowledge supersession pattern** | Lume has no goal object; `milestones` are dates and `todos` are actions. Goals are durable, versioned intentions that change slowly and whose *history of change* is coaching gold. Model as first-class with `supersedes_id`, reusing the existing lifecycle machinery rather than inventing a second one |
| `knowledge.sections.decisions` / structured `decision` | **Decisions** | **Reuse, terminology-only** | "She decided not to apply for the VP role." Meaningful, dated, occasionally reversed — supersession applies |
| `capture_sessions` | **Session** | **Schema extension, promoted to first-class** | Currently underused (D-013). Needs a session date distinct from creation date, sequence within engagement, verbatim note, approved-changes set |
| `memories` | Raw note archive / evidence | **Reuse unchanged** | Evidence store, not current truth. Correct as-is |
| `history_events` | **Timeline / What's changed** | **Reuse, but the persistence gap must close** | Currently many events never persist (D-004). Tolerable in a PM tool; **fatal** in a product whose promise is "it remembered." This is a hard prerequisite, not a nice-to-have |
| `recommendations` (✦ Lume noticed) | **Worth revisiting** | **Reuse, terminology-only** | Suggestion that never silently becomes truth. Exactly right. Note that accept/dismiss is currently memory-only (D-003) and would resurrect dismissed suggestions on reload — unacceptable here |
| `knowledge_items.kind = availability` | Client availability / leave | **Reuse, low priority** | Occasionally relevant ("she's on sabbatical in August"). Keep the structure, do not invest |
| `knowledge_items.kind = dependency` | — | **Discard** | Project-delivery concept. Under-modelled in Lume anyway (D-020) and meaningless here |
| `meetings` / Meeting Prep | Session prep | **Domain replacement** | The *feature* survives as Prepare Me; the *entity* does not. Sessions are the meetings, and Lume's `meetings` table is a separate legacy surface |
| `releases` / release playbook | — | **Discard** | Release-operations specific |
| `project_intelligence_snapshots` | — | **Discard for v1** | Derived compression, ignored on Lume's canonical path. Do not port a cache before there is a load problem |
| `workspace_usage` (analysis meter) | AI allowance | **Reuse, but must become a real entitlement** | Currently a local meter, not a Stripe entitlement (D-024) |
| Billing tables (`billing_customers`, `subscriptions`, `billing_events`) | Billing | **Reuse unchanged** | Stripe scaffolding exists. Needs active-client-limit enforcement |
| — | **Recurring topics** ("keeps coming up") | **New, and deliberately not durable truth** | See section N. AI read-only observations over the record, never persisted as facts about the person |

### M4. How goals and commitments evolve

**Goals** change slowly and meaningfully, and the *change* is the interesting object. A goal is never edited in place. Setting a new goal supersedes the old one, carrying `supersedes_id`, the session it changed in, and — where the note supports it — the reason. This makes *"what has she said about the VP role over time?"* a structural query rather than a search, and it is why goals should reuse the `knowledge_items` supersession pattern rather than being a simple mutable row.

**Commitments** have a lifecycle Lume's todos do not model: *made → mentioned again → done / abandoned / quietly forgotten*. That last state is the coaching-specific one and it is valuable — a commitment made three sessions ago and never mentioned since is exactly what a coach wants surfaced. Crucially, the product must **never infer completion from silence**, and it must never infer abandonment either. It reports the observable fact ("made 14 May, not mentioned since") and lets the coach decide what that means. Deciding what silence means is the coach's job, not the software's.

### M5. How people relate to clients

Third parties are **per-client**, not global. Two clients may both have a boss called Martin and they are different Martins; even if by coincidence they are the same human, the coach must not be shown a merged view, because the two engagements are confidential from each other. This is exactly Lume's current project-scoped stakeholder model, and its existing prohibition on fuzzy-merging similar names is not a limitation here — it is a **confidentiality requirement**.

Within a client, a person carries: a durable id, a display name, a natural-language relationship line, zero or more scoped facts (each with its own lifecycle and provenance), and their mention history. Relationship *changes* are supersessions, which is what makes *"what has changed about her relationship with Martin?"* answerable.

Two coaching-specific requirements Lume does not have. **Reported speech must be structural.** The record must be able to hold *"Sarah says Martin has become more supportive"* and must never flatten it to *"Martin is more supportive"* — the client's perception of a third party is the coaching material, and the difference matters both epistemically and legally. Lume's `epistemic` enum should gain a `reported` value, and the serialiser must preserve the attribution into every prompt and every rendering. **Partial identity must be allowed.** Coaches routinely refer to "her CFO" or "M." without a full name. The product must support role-only and initial-only people as durable entities, rather than forcing a name it does not have — which, incidentally, is also the best available mitigation for the third-party data problem in section P.

### M6. Themes and patterns — the classification decision

Of the four options in the brief — durable structured truth, coach-confirmed interpretation, AI read-only observations, or excluded — the recommendation is **AI read-only observations, never durable, with a hard constraint on what they may describe**, and a willingness to exclude them entirely if the constraint cannot be enforced.

Not durable truth, because a theme is an interpretation and interpretations that harden into stored facts about a person are the definition of profiling. Not coach-confirmed either, at least not in v1: the moment a coach clicks "confirm" on *"struggles with delegation"*, the product has helped them write a psychological judgement into a permanent record about a named executive, and has invited them to prepare the next session around a label rather than a person.

The workable form is an observation computed on demand, describing the **record** rather than the **person**, always evidence-linked, always dismissible:

> ✅ *"Delegation has come up in 4 of the last 6 sessions."*
> ✅ *"Martin has been mentioned in every session since March."*
> ✅ *"Three commitments about difficult conversations have gone unmentioned."*
> ❌ *"Sarah struggles with delegation."*
> ❌ *"She shows a pattern of conflict avoidance."*
> ❌ *"Her confidence appears to be declining."*

The valid ones are countable statements about what is in the record. The invalid ones are claims about a person's psychology. That distinction is enforceable in the prompt, testable in evaluation, and auditable after generation — Lume already has an `src/ai/domain/audits/` layer to hang it on. If it cannot be held reliably, the frame does not ship, and the product loses a demo feature and keeps its licence to operate.

### M7. Summary of net domain change

| Change | Size |
| --- | --- |
| New: **Client** as durable identity above Engagement | Large — but structurally the same as Lume's already-decided Part C §C7 slice |
| New: **Session** as first-class with its own date | Medium — promotes an existing underused table |
| New: **Goal** as a versioned entity | Medium — reuses existing supersession machinery |
| Extended: commitment **owner** axis, replacing a text `waitingOn` | Small but correctness-critical |
| Extended: `epistemic` gains **reported** | Small but correctness-critical, and must flow through the serialiser |
| Reused essentially unchanged | Knowledge with canonical metadata; people and scoped facts; risks lifecycle; dates; decisions; memories; recommendations; workspace, auth, RLS and billing |
| Discarded | Project status, dependencies, releases, meetings-as-entity, snapshots, `todos.kind` |

The encouraging read: the *epistemically hard* parts — supersession, provenance, lifecycle, scoped relationships, ambiguity, isolation — transfer almost unchanged, and they are the parts that take a year to get right. The parts needing new work are ordinary relational modelling.

---

## N. AI trust model

Coaching material is layered in a way project material is not: a single sentence in a note can contain a fact, a report of someone else's behaviour, and the coach's private hypothesis. The trust model must separate those layers *in the data*, not merely in the prompt.

### N1. Five tiers

**Tier 1 — Explicit fact about the client or their circumstances.**
*"The board presentation moved to Friday."* *"She was promoted to VP in March."*
AI may extract and propose. Arrives pre-approved. Stored as ordinary current truth with provenance and a lifecycle. Contradiction with an existing fact triggers supersession or, if both are credible, a question.

**Tier 2 — Explicit commitment.**
*"I'll speak to Martin before the next session."*
AI may extract and propose, **but the owner is never inferred silently**. If the note does not make clear who committed, it becomes a question. Recording a coach's suggestion as a client's commitment is a top-three failure and must fail closed. Stored with owner, the session it was made in, and a verbatim fragment.

**Tier 3 — Reported context (the coaching-specific tier).**
*"Sarah says Martin has become more supportive."*
AI may extract, **and must preserve the attribution structurally**. Stored with `epistemic = reported` and the reporter recorded. It must never be rendered, summarised, retrieved or serialised into a prompt as an unattributed fact about Martin. This is not presentation polish: it is the difference between a record of what a client perceives and a file of allegations about a named third party who never consented to being described.

**Tier 4 — Coach interpretation.**
*"Sarah may be avoiding delegation."*
AI may **never author** this. It may only store it when the coach wrote it, and it must be labelled — *"my read"* — and visually distinguished from everything else. When the coach's note contains such a line, the product extracts it *as an interpretation*, preserving the hedge; it must never launder *"she may be avoiding"* into *"she avoids"*. Coach interpretations do not participate in supersession as facts and are never used to answer factual questions.

**Tier 5 — Psychological inference.**
*"She has low self-esteem."* *"He is a narcissist."* *"Her anxiety is worsening."*
**Prohibited.** Not gated, not flagged, not approvable — the AI must not produce it at all. Enforce at three levels: an explicit prohibition in the domain document; a deny-list validator over proposed statements covering trait language, clinical vocabulary and mental-state claims about anyone; and a post-generation audit pass. A violation is a build-failing test case, not a bug report.

### N2. Summary table

| Category | AI may extract | AI may suggest | Must be labelled | Requires approval | Prohibited |
| --- | --- | --- | --- | --- | --- |
| Explicit fact | ✅ | ✅ | — | Pre-approved, reviewable | — |
| Explicit commitment (owner clear) | ✅ | ✅ | Owner always shown | Pre-approved, reviewable | — |
| Explicit commitment (owner unclear) | ✅ | — | — | **Blocking question** | — |
| Reported context | ✅ | ✅ | **Always attributed** | Pre-approved, reviewable | Rendering as unattributed fact |
| Change to a person's role or relationship | ✅ | ✅ | Previous value shown | Pre-approved, reviewable | Inferring from a single ambiguous mention |
| Contradiction between credible claims | ✅ (detect) | — | — | **Blocking question** | Silent winner-selection |
| Coach interpretation, coach-authored | ✅ (preserving hedges) | — | **"My read"** | Explicit | Removing the hedge |
| Coach interpretation, AI-authored | ❌ | ❌ | — | — | **Prohibited** |
| Recurring-topic observation about the record | ✅ (on demand) | ✅ | Evidence-linked | Never persisted | Statements about the person |
| Psychological / clinical inference | ❌ | ❌ | — | — | **Prohibited** |
| Emotional-state claim about a third party | ❌ | ❌ | — | — | **Prohibited** |
| Prediction about client behaviour | ❌ | ❌ | — | — | **Prohibited** |

### N3. Does a Themes feature risk pseudo-psychological profiling?

Yes — it is the single largest ethical and commercial risk in the product, and it is concentrated in the feature most likely to sell it.

The mechanism is drift. A model asked to identify patterns across twelve sessions will, unprompted, produce trait language, because trait language is how the training corpus discusses recurring human behaviour. *"Delegation came up four times"* becomes *"a pattern of over-control"* becomes *"she struggles to trust her team"* in three unremarkable prompt iterations. Nobody decides to build a profiling tool; the product drifts into one.

**This is not hypothetical, and a competitor has already arrived at the far end of the drift.** CoachNova's own marketing screenshots show a named client tagged *"avoidance · 3× · pacing · 2× · scope · new"*, under a panel headed *"Tracked across this engagement — Avoidance under pressure · 3 sessions."* That is a counted psychological characterisation of an individual, displayed as a product feature, by a company that also states alignment with the ICF and EMCC ethics codes. Whether or not it causes them a problem, it establishes two things: the drift is real and it happens to serious teams, and there is a clear, currently unoccupied position on the other side of it.

The consequence is not embarrassment. A coach whose screen displays an AI-generated psychological characterisation of a named executive has, depending on jurisdiction, created a document that could be disclosable, that they are not qualified to have authored, and that would end the coaching relationship if the client saw it.

**Safeguards, all required:**

1. **Structural constraint, not stylistic guidance.** Observations must reference a countable property of the record — number of sessions, dates, mention counts. If an observation cannot cite a count and at least two source sessions, it is not emitted.
2. **Deny-list validator** over trait, clinical, diagnostic and mental-state vocabulary, applied to every generated statement about any named person, with build-failing tests.
3. **Never persisted.** Computed on demand, dismissible, never stored as a fact about the client, never fed back into extraction context. Non-persistence is the strongest available protection because it prevents accumulation and it makes deletion trivial.
4. **The coach's own words are exempt and clearly theirs.** If a coach writes an interpretation, it is stored as theirs, labelled as theirs, and never restated by the product as its own finding.
5. **A visible, plain-English boundary statement** in the product and on the marketing site: *"This product organises what you write. It does not assess, diagnose, score or form opinions about your clients."* Say it publicly so that it constrains the roadmap.
6. **A permanent kill switch.** If the observations frame cannot pass its audit suite, it ships disabled. The product must be viable without it — and per section H, it is.

---

## O. Failure modes

Ranked by how much damage a single occurrence does. In a confidential-by-nature product bought on trust by a referral-driven professional community, severity is measured in cancellations and in what gets said in a supervision group, not in support tickets.

### O1. Catastrophic — one occurrence can end the business

**1. Cross-client contamination.** A fact, person, commitment or date from one client appears in another client's picture, prep brief or Ask answer. This is a confidentiality breach committed by the tool the coach chose, it is reportable under their own ethics code, and it is unrecoverable as a relationship. It is also the failure most likely to be *discovered in front of a client*.

**2. Psychological inference presented as the product's finding.** Section N. Ends the relationship and creates a document nobody wants to exist.

**3. Misattributed commitment.** The coach's own suggestion recorded as the client's commitment, or one person's commitment attached to another. The coach walks in and says *"last time you said you'd talk to Martin"* and the client says *"no, you suggested that and I said I'd think about it."* The coach looks careless in the exact moment the product was supposed to make them look prepared — which is a precise inversion of the value proposition.

### O2. Severe — destroys trust in the product, probably recoverable once

**4. Stale information presented as current.** A superseded goal, a resolved concern, a former role. Silent decay is worse than an obvious error because the coach cannot tell which parts to distrust.

**5. Speculation hardened into fact.** *"She might leave"* → *"She is leaving."* *"She's thinking about the VP role"* → *"Her goal is the VP role."* The removal of a hedge is a small textual act with a large semantic consequence, and it is one of the most common LLM failures.

**6. Fabricated relationship change.** *"Her relationship with Martin has improved"* when the note said only that they had lunch. This invents interpersonal content about a third party out of nothing.

**7. "Agreed" when it was only discussed.** Coaching conversations are full of explored options. Recording exploration as decision misrepresents the client's autonomy, which is close to a professional-values violation, not merely an accuracy problem.

### O3. Moderate — irritating, erodes confidence over time

**8. Duplicate person from an ambiguous name.** Two Martins, or "M." matched to the wrong person. **Lume currently fails this**: the published dashboard records `ambiguous-same-first-name → write — Must not silently CREATE another Brick` classified as **LUME FAILURE**. This must be closed before a paying coach sees the product.

**9. Lost or wrong chronology.** Notes written days later, back-dated notes, sessions entered out of order. Everything differentiating depends on order being right.

**10. Over-conservatism.** The mirror-image failure, and a real one: the current live eval shows several cases where the pipeline held at *Needs you* on inputs that expected a confident path. Ten questions per note trains the coach to click through without reading, which destroys the value of the approval boundary while keeping all of its cost.

**11. Wrong date normalisation.** "Next Thursday" resolved against the note's creation date rather than the session date.

### O4. Does Lume's reliability philosophy map naturally?

**Yes — the philosophy maps unusually well; the current implementation does not yet meet it.**

Mapping strongly:

- *"If ambiguity could materially change a stored fact, person, relationship, date, status, action or answer, Lume must ask"* is a near-perfect statement of what a coaching product needs, written for a different domain.
- *"Contradictions must be surfaced… not silent winner-selection"* addresses failures 4, 5 and 7 directly.
- *"If Lume learned something that remains true, a later Capture that does not mention it must not cause Lume to forget it"* is the durability guarantee the whole retention thesis depends on.
- *"A name is not identity… if name-only resolution is ambiguous, fail closed"* is exactly failure 8.
- **"Every project-domain mutation must verify that the target durable object belongs to the intended project before mutation"** (open discovery D-035, with a dedicated verification script) is *literally* the cross-client contamination invariant. It is the most valuable single line of inherited engineering in this entire assessment.
- The **MODEL FAILURE / LUME CATCH / LUME FAILURE** taxonomy is the right way to measure this domain, and it is rare. A caught model error is a *success* of the trust boundary; conflating the two — as every competitor's "accuracy" claim does — makes the safety property unmeasurable.

Not yet met:

- The most recent published live evaluation shows LUME FAILURE counts of 5, 9 and 16 across models, including identity-ambiguity and unresolved-target-becomes-CREATE. (These rows are labelled scorer v1; a v3 scorer exists in the repository, so the current figures may differ — see section Y.)
- Several persistence gaps are tolerable in a PM tool and not here: history events that do not survive reload (D-004), optimistic writes that can silently fail (D-005, partially addressed), and dismissed suggestions that resurrect (D-003). A product whose promise is *"it remembered"* cannot forget on reload.

The honest summary: **Lume has the right theory of reliability and the right instrumentation to prove it, and does not yet have the numbers.** That is a far better position than having good numbers and no theory — the theory and the harness are the expensive parts — but it must not be sold as a present-tense advantage, and section W's validation must not promise accuracy the product cannot yet deliver.

---

## P. Privacy and compliance

Proportionate assessment. The conclusion is that privacy **does not block** an individual-first product, materially **shapes** it, and — handled explicitly — is one of the few genuine differentiators available.

### P1. Roles

The coach is the **data controller** for their client records. The product is a **processor**. Model providers are **sub-processors**. This is uncontroversial and it means the compliance burden is mostly the coach's — but ICF Standard 2.5 makes them accountable for choosing you, so they will ask, and a clear answer converts.

### P2. What is actually in the data

Ordinary personal data about the client: name, employer, role, career intentions, working relationships. Frequently commercially confidential information about the client's employer: reorganisations, unannounced departures, board dynamics, acquisitions. Occasionally special-category data under Article 9: health, mental health, pregnancy, religious belief, sexual orientation, trade-union membership — executive coaching strays into all of these without intending to.

Coaching notes are **not** health records by default, which is a meaningful difference from the therapy-tooling market and means HIPAA-equivalent architecture is not required. But the product must be designed on the assumption that Article 9 material *will* appear, which argues for data minimisation, EU/UK hosting, no-training terms, and genuinely verifiable deletion.

### P3. The under-discussed blocker: third parties

This is the most serious finding in this section and it is largely absent from competitor marketing.

The product will hold named, dated, opinionated material about people who are not its users and not its users' clients: *"Martin is threatened by her"*, *"the CFO is being managed out"*, *"the new CEO doesn't rate the leadership team."* These are data subjects. They have not consented, they do not know the record exists, and there is no practical way to serve them an Article 14 notice. They have, in principle, rights of access.

The realistic mitigations, none of which eliminate the exposure:

- **Store third-party statements as attributed reports, never as assertions.** *"Sarah says Martin has become more supportive"* is a record of the client's perception — arguably data about Sarah as much as about Martin. Unattributed, it is an assertion about Martin. This makes section N's tier 3 a compliance mechanism, not just an epistemic nicety.
- **First-class support for role-only and initial-only people.** Let the coach record "her skip-level" or "M." and have it work as a durable entity. Some coaches will use this by default and it materially reduces identifiability.
- **Do not build third-party profiles that outlive the engagement.** Per-client scoping is already required for confidentiality; it also limits accumulation.
- **Delete means delete.** Deleting a client removes the third parties recorded within it, with a documented backup window.
- **Do not build cross-client person resolution.** Ever. It would create a genuine dossier on named executives across multiple coaching relationships, and it is the one feature that would turn a defensible product into an indefensible one.

### P4. Consent and the coaching agreement

ICF Standard 2.5 makes disclosure an ethical duty. The practical consequence is a small product feature with outsized value: **ship a one-page, plain-English data summary and a paste-ready clause for the coach's own coaching agreement.** Something like:

> *"I write my own notes after each of our sessions. I use a private tool that helps me organise them so I can prepare properly. Our sessions are never recorded or transcribed. I review everything the tool records. No part of your information is used to train AI models. You can ask me at any time what is held, and to have it deleted."*

That paragraph removes the coach's largest adoption barrier — the conversation they are dreading — and it is a page of copy, not engineering.

### P5. Recording

Do not build it. Not in v1, not in v3. It is the differentiator, it is the ethical high ground, it collapses the transcription cost line (ninety seconds of dictation versus sixty minutes of session), and reversing the decision later would forfeit the position for a feature four competitors already sell better.

### P6. Retention, deletion, export

Per-client hard delete with a verified cascade across every table and a documented backup window. Whole-account delete. Coach-configurable retention on engagement archive. Full export in a readable format at any time, unauthenticated by anything but login, with no dark patterns.

Note a relevant asymmetry in Lume today: project deletion is permanent with no archive or undo (D-027), which is good for erasure and bad for accidents. Coaching needs both — archive as the normal path, verified hard delete as the deliberate one — and there is currently no export at all.

### P7. Sub-processors and residency

Publish the list. Sign a real DPA. Obtain contractual no-training terms. Offer EU/UK data residency for the application database from day one — UK and EU coaches will ask, and being able to say yes is worth more than the hosting inconvenience costs. The model provider is the hard part: if EU-only inference is unavailable at acceptable quality, say so plainly rather than obscuring it, and note the SCC/UK-Addendum position in the DPA.

### P8. EU AI Act

Article 50 transparency obligations apply from **2 August 2026**. The product is a downstream provider of a limited-risk system built on a general-purpose model; it is not a GPAI provider and Articles 51–55 do not apply. Obligations are disclosure-level: be clear that AI is involved and that content is AI-generated. The product already does this visibly through the sparkle convention. Low burden.

One boundary worth defending: **Annex III high-risk includes employment and worker-management systems, including decisions affecting promotion.** A coach's private notes are plainly not that. A product that generated sponsor-facing reports on an employee's development could edge toward it. This is an additional, independent reason not to build the sponsor-reporting feature Wundamental sells.

### P9. Jurisdictional differences that matter at launch

**UK and Ireland:** the recommended launch market. ICO registration is a coach obligation, not the product's. GDPR literacy is a selling point. £40/year ICO fee is a known quantity for these professionals.
**EU:** same substance; residency expectations higher, particularly Germany and the Netherlands.
**US:** no federal equivalent; state-level movement is concentrated on psychotherapy and on recording consent. All-party consent states (California, Florida, Illinois, Massachusetts, Pennsylvania and others) are irrelevant to a product that never records — which is worth saying explicitly in US marketing.
**Anywhere:** the coach's own professional-body obligations travel with them.

### P10. Verdict

**Privacy and compliance do not materially damage the opportunity, and on balance improve it.** The obligations are ordinary for a B2B SaaS holding confidential professional data; none is a structural blocker for an individual-first product. Two caveats. The third-party data question in P3 is a genuine constraint that must shape the data model rather than being papered over in a policy page. And a conservative minority of the highest-value segment — coaches with corporate sponsors, legal-adjacent clients, or a training body that forbids AI outright — will not buy at any price and should be written off rather than pursued.

---

## Q. Longitudinal value and retention

### Q1. The value curve

**After session 1.** Effectively zero. The coach can read their own note. This is the danger zone and the reason bulk first-load matters: pasting three historical sessions during onboarding jumps the coach past it in ten minutes.

**After 5 sessions (~2–3 months).** The first real moment. Two or three commitments are open, a couple of goals have shifted, four or five people are established, and *"since last time"* has real content. The prep brief starts beating a reread — mostly on speed, and occasionally by surfacing something the coach had genuinely dropped. Retention is decided here.

**After 20 sessions (~9–12 months).** The corpus exceeds working memory. *"When did she first mention leaving?"* becomes answerable and nothing else the coach owns can answer it. Commitments that quietly died are visible. The evolution of a relationship with a named person is traceable across a year. Switching cost is now real, because it is not the data that is hard to move — it is the *structure*, and export produces prose, not a picture.

**After 50 sessions / multiple clients / a year of practice.** With fifteen to twenty clients at biweekly cadence, that is roughly 400–500 sessions of structured history. Reconstructing it is impossible. This is the asset, and it is the entire reason coaching is a better retention market than project management.

### Q2. What can be safely surfaced as the record deepens

| Capability | Safe? | Condition |
| --- | --- | --- |
| Unresolved loops | ✅ | Report observable fact ("not mentioned since 14 May"), never infer abandonment |
| Repeated commitments | ✅ | Countable: "she has committed to this three times" |
| Evolving goals | ✅ | Supersession chain with dates and sources |
| Important relationships | ✅ | Attributed reported speech only |
| Changes of opinion | ✅ | "In March she said X; in June, Y" — both sourced, no interpretation of the change |
| Recurring topics | ⚠️ | Only as counts over the record, with the section N safeguards |
| Patterns across time | ❌ | Not as characterisations. Only as countable observations |
| Emotional trajectory | ❌ | Never. No sentiment, no mood tracking, no wellbeing trend |
| Cross-client patterns | ❌ | Never. Confidentiality, and it is the dossier failure mode |

### Q3. What makes the coach unwilling to lose it

In descending order of strength: the accumulated corpus itself, which cannot be reconstructed; the corrections and clarifications they personally made, which represent hundreds of small judgements; the reliability of the prep ritual once it is load-bearing before every call; and — weakest but real — the professional embarrassment of walking into a session less prepared than they were last month.

Note what is *not* on that list: the software. Nothing about the interface is hard to leave. The lock-in is entirely the record, which is why export must be generous (it costs nothing, because the structure does not travel) and why the record must never be lost, corrupted or silently wrong.

### Q4. Churn moments

**Week one.** Setup felt like data entry. By far the largest bucket, and the reason onboarding is a single paste.
**Sessions 2–4.** The prep brief was not better than rereading. The proposition failed at first contact.
**Any single trust break.** One cross-client leak, one invented relationship, one wrong-Martin — cancellation without a support ticket.
**Month two to three, silently.** Two clients get written up, thirteen do not, the pictures go stale, the briefs go wrong, the coach stops opening it. This is the most likely churn mode and the hardest to detect. It argues for a genuinely fast capture path and against any notification that draws attention to the gap.
**Practice contraction.** Clients end, the roster halves, €39 stops feeling proportionate. Mitigate with a lower tier rather than losing them.
**Annual renewal.** They reassess against whatever ChatGPT can do by then.

### Q5. Engagement decay and archive

Biweekly cadence means roughly thirty short interactions a month for a fifteen-client practice. That is sufficient for habit only if it is welded to the session ritual — prep before, debrief after — and only if both are faster than the alternative. There is no plausible daily-use version of this product and attempts to manufacture one (digests, streaks, weekly reviews) will backfire with this audience.

Archive is a core behaviour, not an edge case: a third or more of a coach's clients are between engagements at any time. Archived clients must not count toward plan limits, must remain readable and askable, and must reopen intact. There is a real business here in what CoachNova has spotted — former clients return — and archive is what makes that valuable rather than a storage cost.

### Q6. Portability expectations

Professionals who hold confidential material about named third parties will ask what happens if the company disappears. Answer it before they ask: one-click export per client and for the whole practice, in Markdown plus JSON, including raw notes, the current picture and the full change history. This is a trust *feature* with a marketing return, and it costs almost nothing in defensibility because the structure does not survive export anyway.

---

## R. Competitive moat

### R1. AI is not a moat

Stated plainly so it does not creep back in. The models are commodity, available to every competitor at the same price, improving on someone else's roadmap.

### R2. Candidate sources of defensibility, honestly rated

| Source | Real? | Durable? | Assessment |
| --- | --- | --- | --- |
| **Persistent structured client memory** | Yes | Per-customer, not per-market | A genuine switching cost that compounds monthly. It does not stop anyone entering; it makes your existing customers hard to take |
| **Reliable change history and provenance** | Yes | **Strongest technical position** | Requires having stored things correctly from day one. A competitor bolting AI onto existing notes cannot retroactively produce "she first said this on 14 May" over a corpus they never structured |
| **Source and evidence linkage** | Yes | Medium | Same argument; also the most demonstrable thing in a sales conversation |
| **Human approval boundary** | Yes | Medium | Copyable as a philosophy in a quarter, but it determines the data model, so copying it late is genuinely expensive |
| **Longitudinal briefing** | Yes | **Low** | Coachful already ships an AI briefing. Table stakes within a year |
| **Relationship and third-party context** | Yes | Medium-high | The least-served need, and the hardest to add later because it changes the schema. Currently uncontested |
| **No-recording posture** | Yes | Medium | Copyable as *positioning* instantly; not copyable *architecturally* by anyone whose value chain starts with a transcript |
| **Workflow fit** | Yes | Low | Shallow |
| **Trust and reputation inside a small professional community** | Yes | **Highest, and slowest** | Coaches buy on referral from other coaches, supervisors and training schools. For a product this size, this is the actual moat, and it cannot be bought |
| **Evaluation harness and failure taxonomy** | Yes | Medium, invisible | Genuine engineering advantage, worth years of avoided incidents, and completely illegible to a buyer. Treat as an internal asset, never as marketing |

### R3. Could a competitor reproduce most of the user value within twelve months?

**Yes. Most of it. Say so plainly rather than pretending otherwise.**

- **Coachful and CoachNova have already reproduced the pitch** and are shipping AI briefings against a client record today.
- **ChatGPT and Claude** will keep improving per-project memory. A coach running one project per client already gets perhaps 60–70% of the value for $20/month, and the gap narrows every quarter without anyone deciding to compete with you.
- **Granola** could add per-person goals and open commitments on top of its existing People view in a quarter, and it already has the notes, the funding and the distribution.
- **Paperbell, CoachAccountable, Practice and Simply.Coach** can add an AI prep brief over notes they already store, for customers they already bill, with no migration. Their version will be worse and it will win on convenience.

### R4. What actually remains distinctive after twelve months

Three things, in order:

**The structured change record.** Not "AI summaries of past sessions" but a dated, superseding, provenance-linked account of what was true when. Competitors who summarise per session are architecturally unable to produce it, and retrofitting requires re-extracting their whole corpus under a data model they do not have.

**The no-recording stance, held credibly over time.** Its value grows if professional norms keep hardening, and it is a position the transcript-first competitors cannot occupy without abandoning their product.

**The client's world.** Named third parties, scoped relationships, tracked change in those relationships. Nobody is doing it, it is what executive coaching is actually about, and it is a schema-level commitment rather than a feature.

### R5. Conclusion

**There is no durable moat. There is a twelve-to-twenty-four-month head start on structure and trust, and one compounding asset — the per-customer record plus reputation inside a small professional community.**

Plan accordingly. This is a product to run profitably and narrowly, not one to defend or to scale into a category. Concretely, that means: do not raise money on a defensibility story; do not spend on brand advertising against better-funded entrants; go deep with a small number of coaches who will refer; and accept that the ceiling is a few hundred customers and a good living rather than a market.

---

## S. Pricing and economics

### S1. Price anchors in the coach's head

Simply.Coach $9 · Granola $14 · CoachNova €19 per active client · CoachAccountable $20 (2 clients) rising to ~$70 (10) and ~$120 (20) · ChatGPT Plus $20 · Quenza $25 · Delenta and CoachVantage $29 · Wundamental €29 → €99 · Practice ~$35–39 · Paperbell $47.50–57.

Two constraints follow. This product is a **companion**, not a suite replacement, so it competes for a *second* subscription slot alongside something the coach already pays for — which caps the price. And it must not be cheap: €9–€19 signals a toy to a professional billing $300 an hour.

One anchor deserves separating out, because it is easy to misread. CoachNova charges **€19 per active client per month**, which is roughly **€380 a month** for a twenty-client practice — an order of magnitude above anything else in the category. That is not a memory price. It is priced against *revenue expansion*: their pitch is that former clients keep paying €50–500 a month for continued access, so the subscription funds itself several times over. The lesson is that coaches will discuss large numbers **when the product makes them money**, and the trap is concluding that this product can borrow that anchor. It cannot. A memory-only companion saves time and improves preparedness; it does not generate revenue, and pricing it as though it did would fail loudly.

### S1a. The floor, discovered late

The deeper competitive sweep found the price floor is already below the plan this section originally proposed, and it is defended by a free tier:

| Competitor | Price | Clients |
| --- | --- | --- |
| **CoachRocks Free** | **$0** | 3 active, 10 AI questions/mo, unlimited manual uploads |
| **CoachRocks Pro** | **$25/mo** | **Unlimited**, 300 AI questions/mo |
| SessionFlow | **Free while in beta**; then $29 (3 clients) / $50 unlimited | |
| Granola Business + Claude Pro | **$34/mo** | Unlimited, ~70% of the job |
| Coachful | $49/mo | Unlimited |
| CoachUI | $59/mo (5 clients) / $119 unlimited | |

**The €39 recommendation below was modelled before this was known and should be treated as invalidated.** A seventh entrant with a narrower feature set and no brand cannot open above the best-known competitor's unlimited-client price. Realistically the standalone product would have to launch at **€19–€25** to be considered at all, which roughly halves every figure in the economics table and pushes the 200-customer case down to around €4,000 MRR — below the level that supports one full-time person once churn and acquisition are paid for.

This is a large part of why section A downgrades the verdict. The remainder of this section is retained because it is still the right *method*, and because the integration variant in F4b prices differently: a memory layer sold to an existing CoachAccountable or Paperbell customer is an add-on to a tool they already trust, which supports a €15–€25 add-on price against a much lower CAC.

### S2. Recommendation *(superseded by S1a for the standalone product; retained as method)*

**One plan. €39 per month, or €390 per year. Up to 25 active clients. Archived clients don't count. Cancel any time. Export everything.**

A single plan is a deliberate choice: pricing tables invite comparison shopping and imply the cheap tier is the real product. Add a €69 tier at 60 active clients only when someone asks, and consider a €19 "up to 5 clients" tier only if the validation shows part-time coaches converting and full-price coaches are not being cannibalised.

Test €29 / €39 / €49 in validation. My expectation is that €39 and €49 convert similarly and €29 converts worse, because in this market price is a quality signal — but that is a hypothesis, and it is cheap to test.

**Free trial: 30 days, no card.** Long, because the value curve needs at least two sessions with the same client, and a fortnightly coach needs a month to get there. No card, because a suspicious professional audience abandons at a card wall and because CoachAccountable's 30-day no-card trial has set the category expectation.

### S3. Unit costs

Per active coach per month, assuming 15 active clients at biweekly cadence — about 30 sessions.

| Line | Assumption | Monthly cost |
| --- | --- | --- |
| Extraction | 30 captures; ~8k tokens in (current picture + note), ~2k out; efficient mid-tier model | €0.30 – €0.80 |
| Extraction, frontier model | If reliability requires it: 5–10× | €2.00 – €7.00 |
| Prep briefs | 30 briefs; similar context, shorter output | €0.30 – €0.70 |
| Ask | ~30 queries; larger context | €0.50 – €1.50 |
| Dictation | 30 × ~2 min at Whisper-class rates | €0.30 – €0.50 |
| Storage and bandwidth | Text only; a heavy year is single-digit MB | < €0.10 |
| **AI + storage subtotal** | Efficient model | **€1.40 – €3.10** |
| **AI + storage subtotal** | Frontier model | **€3.10 – €9.70** |

Note the counterfactual that keeps the margin: **session recording would cost €10–€20 per user per month in transcription alone** (15 clients × 2 sessions × 60 minutes). Not recording is a positioning decision that also happens to protect roughly a third of the gross margin.

Fixed infrastructure is small — hosting and managed Postgres in the €45–€90/month range up to a few hundred users, plus €30–€60 of tooling. The real cost is **support**: self-employed professionals email, and they email about their clients' data. Budget 0.3–0.5 hours per user per month in year one, falling to perhaps 0.1 as documentation matures.

### S4. Approximate economics at €39/month

Ranges, deliberately. Assumes a mix of efficient and frontier model usage, and treats founder time as unpaid.

| Paying users | MRR | ARR | AI + storage | Fixed infra + tools | **Gross margin** | Support load (hrs/mo) | Monthly contribution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **25** | €975 | €11.7k | €50 – €200 | €80 – €150 | **~78 – 87%** | 8 – 13 | €650 – €830 |
| **50** | €1,950 | €23.4k | €100 – €400 | €100 – €180 | **~78 – 87%** | 15 – 25 | €1,400 – €1,750 |
| **100** | €3,900 | €46.8k | €200 – €800 | €130 – €250 | **~78 – 87%** | 25 – 45 | €2,900 – €3,550 |
| **200** | €7,800 | €93.6k | €400 – €1,600 | €200 – €400 | **~78 – 87%** | 40 – 80 | €5,900 – €7,200 |

Gross margin is healthy and roughly constant. The economics are not constrained by cost of goods; they are constrained by **churn and acquisition**, and the table above is misleading unless read alongside them.

### S5. The number that actually matters

At a plausible early monthly churn of 4–8% for solo-professional SaaS, holding 200 customers requires acquiring **8–16 new customers every month, forever**. At a realistic blended CAC of €80–€250 (heavily weighted to founder-led selling and community channels, since paid search is marginal at this LTV), that is €600–€4,000 per month of acquisition effort just to stand still.

Set against a monthly contribution of €5,900–€7,200 at 200 users, the business supports one full-time person comfortably and a second only at the top of the range. **This is a one-to-two-person business at maturity.** It is a good one. It is not more than that, and resourcing it as though it were will destroy it.

Two levers materially improve this and both should be tested early: **annual billing** (€390 up front removes twelve churn decisions and improves cash flow), and **archive-friendly limits** (a coach whose roster shrinks should downgrade rather than cancel).

---

## T. Acquisition

### T1. Channel assessment

| Channel | Targetability | Intent | Cost | Verdict |
| --- | --- | --- | --- | --- |
| **LinkedIn, founder-led 1:1** | Very high — independent exec coaches are identifiable by title, credential and posting behaviour | Created, not captured | Time only | **Primary.** The only channel that also teaches you what to build |
| **ICF chapter newsletters and events** | Very high | Low but warm | **$25–$150/month for a newsletter placement to 700–3,000 coaches at ~60% open rates; $250–$2,500 event sponsorship** | **Strong and badly underpriced.** Dozens of chapters, each individually contractable |
| **Coach training schools and mentor coaches** | Very high | High trust | Partnership / revenue share | **Strong.** PCC/MCC programmes and supervision groups are where referral trust originates |
| **Coaching newsletters and communities** | High | Medium | €200–€1,000 per placement | **Test.** A handful of respected practitioner newsletters |
| **Google Search, exact-match long tail** | Medium | **Highest** | $2–$6 CPC in education/coaching; SaaS terms higher | **Test small.** Real intent on "coaching session notes software", but bidding against suites with far higher LTV |
| **YouTube** | Medium | Medium | Sponsorship | **Later.** "My coaching tech stack" creators exist but audiences are small |
| **Content and SEO** | Low | Medium | Time | **Avoid as primary.** The SERP is saturated with AI-generated affiliate content. You cannot out-publish it |
| **Coaching directories** | Low | **Wrong audience** | Varies | **No.** Directories serve buyers *of* coaching |
| **Meta and Instagram** | Low | Low | $1–$4 CPC | **No.** Life-coach audience, wrong segment, wrong price point |
| **Podcast sponsorship** | Medium | Low | €500–€3,000 | **Later** |

The two headline findings. **ICF chapter advertising is extraordinarily cheap for the precision it offers** — a hundred dollars puts you in front of a thousand credentialed coaches with a 60% open rate, and there are chapters in more than eighty countries, each contractable individually. And **paid search is marginal**: at an LTV around €500 and a realistic cost per paying customer of €150–€500, the channel breaks roughly even before churn, which means it can be a supplement but never the engine.

### T2. Acquisition propositions, ranked

**1. "Everything they've told you. Ready before you are."**
Outcome-led, appeals to professional pride, avoids accusation, and — importantly — collides with nothing found in this research. The recommended default.

**2. "Six months of context. Sixty seconds."**
Clean, quantified, benefit-forward. Likely the best-converting line on search traffic, where intent is already formed and the reader wants to know what it does, fast.

**3. "Never in the room. Never lose the thread."**
The differentiator in eight words. Only fully legible to coaches who have already worried about AI notetakers — but that is a growing, self-selecting group, and this line converts them hard. The best line for ICF chapter and training-school audiences, where the ethics conversation is live.

**4. "Coaching software tracks your client. It doesn't track the people around them."**
The sharpest *competitive* line, aimed at coaches who already own a suite and are wondering why they need anything else. Narrow, but it wins the comparison directly and nobody else can run it.

**5. "Your client remembers what they told you six months ago. Do you?"** *(from the brief)*
High-variance. It will earn attention because it stings. It stings because it accuses a professional of a lapse in the thing they are proudest of, in a profession culturally committed to non-judgement. Expect a good click-through rate and a poor conversion rate, and expect a proportion of the audience to dislike you for it. **Test it precisely because it is high-variance** — it may well win on cold traffic — but do not make it the brand.

**6. "Stop rereading three months of notes before every call."**
Pain-first and very concrete. Works well as an ad body line under any of the above. Weak as a hero because it describes a chore rather than an outcome.

**7. "Walk into every session like they're your only client."** *(now unavailable)*
Recorded here only to note that it is out. CoachNova's live headline is *"Walk into every session knowing where you left off"*, which is close enough that running this would read as imitation to anyone who had seen both. Same reasoning retires the natural tagline *"Where we left off."*

Note that the recommended ranking puts *pride* and *time* above *accusation* and *fear*. That is a judgement about this audience specifically: coaches are self-employed professionals whose entire craft is holding people without judging them, and marketing that judges them will be noticed as such.

### T3. Buying cycle

Short by B2B standards and longer than consumer. Expect one to three weeks: a coach sees it, tries it on one client, and either abandons it that week or converts within a month. The dominant factor is not deliberation — it is **cadence**. A fortnightly coach physically cannot evaluate the core loop in fewer than three weeks, which is why the trial must be thirty days and why any fourteen-day trial would misrepresent the product.

---

## U. Brand and name shortlist

**Not legal trademark clearance.** These are commercial-conflict and availability *signals* only. Formal clearance is required before any commitment.

### U1. The right naming territory

The proposition is *holding continuity on someone else's behalf, so the coach can be fully present*. That points away from three tempting territories and toward one.

Avoid **memory and recall** words directly (Recall, Remember, Memoir, Mnemo). They foreground the software's memory, which implies the coach's is deficient, and they collide with a crowded AI-memory category.

Avoid **brain, mind and cognition** words entirely. Clinical adjacency is fatal here.

Avoid **coach-prefixed constructions** (CoachX, XCoach). The market already has CoachAccountable, CoachVantage, CoachNova, Coachful, CoachBase, Coaching Loft and more; a coach-prefixed name is instantly generic and confusable.

**Target territory: continuity and holding.** Words that suggest a thread being kept, a place where things are held, or steady attention over time. This is native coaching language — coaches speak of *holding* a client, of *the thread*, of *what's alive*. It is warm without being soft, professional without being corporate, and it describes the product's actual job rather than its mechanism.

### U2. Candidates by territory

**Continuity and thread**
Throughline · Thread · Throughline's shorter cousin *Throughway* · Sequel · Continua · Weft · Warp · Ravel

**Holding and keeping**
Keepsake (rejected on sentiment) · Holdfast · Kept · Steward · Custody (rejected — carceral) · Cairn · Ledger (rejected — accounting)

**Attention and presence**
Attend · Present (unsearchable) · Regard · Noticed · Tend · Vigil (rejected — funereal)

**Place and depth**
Anchorage · Harbour · Wellspring · Depth · Reservoir · Fathom (taken)

**Light and clarity** *(the Lume territory)*
Lumen · Beacon · Clerestory · Limn

**Coined, pronounceable**
Recolla · Contexa · Perenn · Sesso · Anteia · Corran

**Coaching-native phrase-names**
Where We Left Off · Last Time · Before The Session

### U3. Assessment, after registry and conflict checks

Domain status below is from **RDAP** (Verisign for `.com`, Identity Digital for `.ai` and `.coach`, Google Registry for `.app`) and port-43 whois for `.co`, each validated against a known-registered control and a known-free control. Note that the `rdap.org` aggregator returns false negatives for `.co` — it reports 404 for `google.co` — so it was discarded for that TLD. A sample was cross-validated against independent whois and the two methods agreed. Registration was then separated from *use* by fetching each domain and reading its title.

#### Strongest

**Ballast** — the recommendation.

Ballast is the weight carried low in the hull that lets a vessel hold its line in weather. It is not cargo, it does not steer, and it is never seen — it is the thing that makes the skipper's own judgement reliable. That is precisely the product's relationship to the coach, and it is warm without being soft, professional without being corporate, and entirely free of clinical or surveillance flavour.

No coaching product, platform or coach-facing tool exists under the name. The live software use is `ballast.now`, a CLI scoring code durability from git history — different category, small team. Ballast Lane Applications is a dev agency, a two-word services mark. The notable trademark presence is BALLAST POINT (Reg. #3475098), registered in Nice **Class 32 (light beverages)** and **Class 40** — beer, comfortably distant from software Classes 9 and 42, though that distance is exactly what an attorney should confirm.

**`ballast.coach` is available** (RDAP 404). `ballast.com` (1995, live), `ballast.ai` (registered 2024), `ballast.app` (2025) and `ballast.co` (2020) are all taken, as are the get/use/hq/try variants. For a coach-facing product, `.coach` is arguably the better address anyway.

**Weft** — strong second.

The weft is the thread carried back and forth across the fixed warp; without it you have parallel strands, with it you have cloth. Individual sessions are the warp. Short, one syllable, unmistakably pronounceable, quietly literate, and it names continuity without ever saying "memory."

No coaching product found — a genuine negative result, since "Weft coaching" returns only weaving. Conflicts are confined to AI developer tooling (`weavemind.ai` uses Weft as an orchestration language; `weftcli.com` is a developer CLI), which is a different buyer entirely and none of it large.

**`weft.coach` is available.** Best signal of the exercise: **`weft.ai` is openly for sale** — it returns HTTP 200 with the title *"Weft.ai for sale | Spaceship.com"* — so the `.ai` is acquirable rather than held by a competitor. `weft.com` is registered (1999) but does not respond at all.

#### Potentially usable

**Limn** has the cleanest domain position found — `limn.coach` and `limnhq.com` both confirmed unregistered — and no coaching conflict. It fails on pronounceability: the `n` is silent, so most people will misread it, and a name coaches cannot confidently say will not be passed on by word of mouth, which is the primary channel here.

**Tenon** (`tenon.coach` available; good joinery metaphor) is blocked in spirit by Tenon.io, an accessibility-testing SaaS acquired by Level Access in 2021 and still trading — a live B2B software brand with a corporate owner.

**Whetstone** (`whetstone.coach` available; exactly right metaphor — sharpens the practitioner, is not the practitioner) carries category history: Whetstone Education was a teacher-observation and instructional-coaching platform, acquired by SchoolMint in 2021 and sold on to Level Data in 2025, since renamed "Grow." The brand is being retired in coaching software, which helps, but residual association and possibly-live marks remain. Three syllables is also long.

**Keepsake, Steward, Poise, Salient, Sounding, Plumbline, Solen, Verso** all have `.coach` free and no coaching conflict, and all fail on register. *Keepsake* is sentimental and backward-looking. *Steward* edges toward patronising and reads as governance software. *Poise* is a major US incontinence brand. *Salient* is consultant-dry. *Sounding* and *Plumbline* both read as measurement, tipping toward the evaluative feel the brief ruled out. *Solen*, *Verso* and *Nyra* say nothing and would cost full freight to build meaning into.

#### Reject — conflicted

**Throughline** — the first draft's lead candidate, and **disqualified on category grounds.** `throughlinesolutions.com` sells *"Executive AI Coaching"* — literally this category with AI attached. `findyourthroughline.com` is a leadership coaching LLC. `throughlinecare.com` is a mental-health crisis product (*"Privacy-first. Clinically grounded."*) — precisely the clinical adjacency to avoid. Agile 2 Academy asserts "Throughline™" for an AI agent platform. Plus Throughline Labs, throughlineplatform.com and a live throughline.com. **`throughline.coach` is already registered** — someone in coaching has taken it. This name is not available in any meaningful sense.

**Vellum** — `vellum.ai` reads *"Your Personal Intelligence — An assistant that knows you deeply, evolves alongside you… Powered by memory that remembers the way you do."* That is this proposition almost word for word. Fatal.

**Mneme** — collides inside the AI-memory category (`mnemeai.com` iOS notes app; two separate open-source "memory layer" projects) and sits phonetically next to Mem. Also unpronounceable to most English speakers.

**Fathom** — a major AI notetaker, routinely benchmarked against Granola and Otter. `fathom.coach` already registered. Unusable.

**Cairn** — the first draft's second choice, and crowded *in category*: `cairnleadership.com` sells executive team coaching; `getcairnapp.com` is an AI journaling app for founders with *"Deep cross-month pattern analysis"*. `cairn.coach` and all six fallbacks are registered.

**Holdfast** — the first draft's dark horse. `holdfastai.com` is an AI dispatch product that *"delivers a complete dispatch brief"* — overlapping language. A HoldFast men's-health app has an AI coaching feature. `holdfast.coach` registered; `holdfast.ai` is listed for sale. Also a well-known video game.

**Attune** (`attune.ai` is an active healthcare AI company; clinical drag) · **Perenna** (`perenna.com` is a UK mortgage bank — unhelpful for a UK-facing B2B product; also shares the Latinate house style of Delenta and Ovida) · **Lumen** (lighting, health tech, metabolic devices; and confusingly close to Lume) · **Beacon**, **Thread**, **Sequel**, **Harbour**, **Anchorage** (crowded, owned, or SEO-poisoned) · anything beginning **Coach** · anything containing **AI**, **GPT**, **Mind**, **Brain**, **Memory** or **Recall**.

### U4. Recommendation

**Lead: Ballast.** Take `ballast.coach`.
**Alternative: Weft.** Take `weft.coach`, and open a conversation on `weft.ai`, which is actively listed for sale.

Both are cheap to secure and neither has a coaching conflict. Put both in front of a trademark attorney for Class 9/42 clearance before spending anything on identity. **Nothing in this section is legal clearance** — no trademark register was searched systematically, no classes analysed, no common-law rights assessed.

Pair either with a tagline that does the work. *"Where we left off"* is unavailable — it is inside CoachNova's headline. Use **"Nothing lost between sessions."**

### U5. Why the territory changed

The first draft recommended the **continuity/thread** territory and picked the most literal word in it. That word turned out to be taken five times over, including by a firm selling Executive AI Coaching — which is itself the lesson. Continuity is still the right territory, because it names what the coach actually sells: an eighteen-month relationship whose value is that session eleven knows what session two committed to. The failure being fixed is not forgetting facts; it is the engagement fraying into disconnected hours.

But the *abstract thread nouns* in that territory are exhausted. Adding a **concrete, physical, steadying object** — Ballast, Weft — keeps continuity's meaning while restoring distinctiveness.

Three territories were ruled out along the way. **Memory** is the most contested naming space in AI right now (Mem, Mneme, Vellum, Rewind, Limitless, Personal.ai), it describes the mechanism rather than the coach's benefit, and "a system that remembers everything about a person" is one bad framing from surveillance. **Depth, attention and presence** describe what the coach already does, so claiming them is subtly insulting; and the measurement words in that family make the tool sound like it is assessing the client. **Holding and keeping** is both faintly clinical — it borrows from therapeutic "holding" — and already in use by the nearest competitor, whose copy reads *"clients feel held across the whole engagement."*

---

## V. Landing proposition

The site must sell the outcome. It must not explain language models, must not use the word "leverage", and must not contain a feature grid above the fold.

### V1. Hero

> # Everything they've told you. Ready before you are.
>
> Write a few lines after each session. Before the next one, get the whole picture back — what they committed to, who's in their world, what's changed, and what you left unfinished.
>
> **[ Start with one client ]**  ·  30 days free, no card
>
> *We're never in the room. Nothing enters a client's picture until you've approved it.*

The CTA describes the first action rather than the transaction. "Start with one client" is honest about what happens next, sets an achievable expectation, and removes the implied obligation to migrate a practice.

### V2. The pain, immediately below

> You remember Sarah's promotion.
>
> You don't remember that she promised to speak to Martin, that it was six weeks ago, or that she hasn't mentioned him since.

Three lines, no icons, no bullets. It names a specific forgetting that every coach has experienced, without calling them forgetful.

### V3. The demo — the centrepiece

A forty-second silent loop, no narration, no interface tour, autoplaying muted with captions.

1. **A coach types four scrappy lines** into a plain text box — visibly imperfect, mid-sentence, the way people actually write. *"good session. she's off the VP thing now — thinking sideways into product?? says martin's been better lately. board thing is sept 3. still hasn't spoken to him."*
2. **Six proposals appear** in plain language. Five have ticks. One asks: *"Is this the same Martin as her skip-level, or a different Martin?"* The cursor clicks **Same Martin**. Then **Save to Sarah's picture**.
3. **Cut to six weeks later.** The coach clicks **Prepare me for Sarah**. A short brief appears — and the caption highlights the line *"She committed to speaking to Martin on 14 May and hasn't mentioned it since."*
4. **The coach types a question:** *"when did she first mention leaving?"* The answer appears with a date, and then **the exact sentence from the original note, dated**.

**End card:** *"Nothing was recorded. Nothing was saved without her coach's say-so."*

That sequence sells provenance, restraint and payoff without a single word about AI. Step 2 is the most important frame in the whole site, because watching software *decline to guess* is more persuasive than watching it be right.

### V4. Trust and privacy

Headed **"What happens to what you write"**, in plain sentences rather than badges:

> We are never in the room. No recording, no transcription, no bot joining your calls.
>
> You write your own notes, as you always have. We help you organise them.
>
> Nothing is used to train AI models. Ever, by contract.
>
> Your data is stored in the UK/EU. Here is our data processing agreement.
>
> Delete a client and everything goes — their picture, their notes, everyone mentioned in them.
>
> Export everything, any time, in a format you can read without us.
>
> **And a paragraph you can paste into your coaching agreement, so the conversation with your client is easy.**

That last line is the conversion mechanism. It solves the coach's actual blocker, which is not whether the tool is safe but whether they can explain it.

### V5. Differentiation

A short, honest, four-line comparison — honest because coaches will check:

> **vs. your notes app** — it keeps everything. You still have to read it.
> **vs. ChatGPT** — you have to maintain the file. And it will invent Martin.
> **vs. an AI notetaker** — it has to be in the room. We never are.
> **vs. your coaching platform** — it stores your notes. It doesn't understand them.

### V6. Pricing

One number, one paragraph, no table:

> **€39 a month.** Up to 25 active clients. Archived clients don't count. Cancel any time, export everything.
>
> 30 days free. No card.

### V7. What the site must not contain

A feature grid above the fold. Logos of companies that have not used it. Testimonials that do not exist. Anything about parameters, models, embeddings or "advanced AI". A progress chart. A stock photograph of two people at a whiteboard. The word "insights". A chatbot in the corner.

---

## W. Validation experiment

The objective is to test **willingness to pay and habit formation**, not interest. Surveys and waitlists are excluded because they measure neither.

### W0. Do this first, this week, for £0

Before spending anything on the experiment below, spend two hours on the cheapest test available:

**Sign up for CoachRocks' free tier. Load three real anonymised clients with three sessions each. Use its prep briefs and its client-memory chat.** Then do the same on SessionFlow, which is currently free in beta, and on Coachful's trial.

Then answer one question honestly: *is the thing I would build meaningfully better than this, for a coach who does not care about my architecture?*

If the answer is no, stop — sections W1 to W7 are moot and you have saved six weeks and €3,000. If the answer is yes, you will have learned exactly which two or three differences matter, which is the only sound basis for the landing page. Either way this is the highest-value hour in the whole plan, and the first draft of this report failed to propose it because it did not yet know CoachRocks existed.

Note also that the experiment below must now be run **against a named competitor** rather than against a generic notion of the alternatives, and the price tested must be **€19–€25**, not €39 — see S1a.

### W1. Design

**An interactive demo, a real price, a real checkout, and a concierge behind it.**

**The demo is the experiment.** A single page containing a fully working, no-signup, fictional client — *Sarah Okafor, VP Engineering* — with nine sessions of pre-built history. Any visitor can, in three minutes: read her picture; click **Prepare me for Sarah** and get a real brief; paste a session note and watch real extraction propose real changes including one genuine clarifying question; and ask *"when did she first mention leaving?"* and get an answer with the source sentence.

This must be genuinely working software, not a video and not a Figma prototype, because the entire hypothesis is that the *quality of understanding* is the value. A mockup tests the pitch. A working demo tests the product.

**The offer is real.** A Stripe checkout at the test price, framed as: *"Founding cohort — 20 places. First month free. I'll import your existing client notes for you, personally, before you start."*

**The delivery is concierge.** For the first twenty customers, the founder personally takes whatever notes they have — Google Docs, exports, screenshots, a phone call — and builds their clients' pictures by hand using the tooling. This removes the migration barrier, which section B identified as a primary blocker, and it converts the riskiest technical requirement (bulk import of messy history) into a human process that can be learned before it is automated.

### W2. Budget: €2,000 – €3,500 over six weeks

| Line | Spend | Rationale |
| --- | --- | --- |
| ICF chapter newsletter placements | €600 | 6–8 chapters × 1 month. Cheapest precise reach available |
| Google Search, exact match, long tail only | €900 | Test whether search intent converts at all |
| One or two practitioner-newsletter sponsorships | €400 | Warm audience, credible endorsement context |
| Landing page, demo hosting, Stripe, analytics | €300 | |
| Buffer | €300 – €1,300 | Double what works in weeks 4–6 |
| **LinkedIn outreach** | **€0** | 200 personalised messages, 30 fifteen-minute conversations. Highest-value line and it costs only time |

Deliberately **no Meta spend**. Wrong audience.

### W3. Audience

Independent leadership and executive coaches, English-working, credentialed or credentialing, UK and Ireland first, then Netherlands, Nordics, Germany, then US East Coast. Filtered on LinkedIn by title, ICF credential, and evidence of an independent practice. Excluded: life coaches, health coaches, career coaches, internal coaches, and coaching firms.

### W4. Metrics

**Primary: paid conversions from a cold, non-personal channel.** Warm conversions from the founder's own network prove politeness, not demand. The channel breakdown matters more than the total.

**Secondary, in order of importance:**
- **Day-30 activity of the founding cohort** — did they open the app before a session in week four? This is the real signal and the one most likely to fail.
- **Demo completion rate** — what proportion of visitors ran the *"when did she first mention leaving?"* query? This measures whether the differentiated capability is legible.
- Second-client rate — did they add a second client unprompted?
- Unprompted import requests — did anyone ask to bring more than five clients?

**Tertiary:** cost per paid conversion by channel; price-point conversion differences.

### W5. Thresholds, over six weeks and roughly 600–1,200 qualified visitors

| Outcome | Definition | Action |
| --- | --- | --- |
| **Strong** | ≥25 paid at €19–€25, **≥10 of them from cold channels**; ≥65% of the cohort active at day 30; ≥5 unsolicited requests to import real clients; demo completion ≥35%; **and at least 3 who say unprompted that they looked at CoachRocks and chose this** | **Build.** Proceed to Part 2's technical assessment |
| **Ambiguous** | 12–24 paid; day-30 activity 40–65%; conversions concentrated in warm channels | **Stop and reconsider the integration variant in F4b.** Do not run another cycle of the same experiment |
| **Weak** | <12 paid; **or** day-30 activity <35% regardless of signup volume; **or** all conversions from personal network | **NO-GO.** Stop |

**Thresholds were raised from the first draft** because the competitive picture changed: at a €19–€25 price the same revenue requires more customers, and in a market with a free-tier competitor a signup is weaker evidence than it was. The added CoachRocks-comparison criterion exists because "would have bought something" and "chose this over the incumbent" are different findings, and only the second one justifies building.

The asymmetry is deliberate. **High signups with poor day-30 retention is a weak result, not an ambiguous one.** The demo is designed to be impressive and impressiveness converts; a coach who signs up, gets their notes imported for free, and does not open the app before a session a month later has told you the habit does not form. That is the most informative failure available and it should be respected rather than explained away.

### W6. What would justify a technical prototype

≥12 paying customers, ≥55% of them active at day 30, and at least three who spontaneously ask to import more than five clients. Below that, iterate the offer; do not write code.

### W7. Cheap version if even €2,000 is too much

Cut paid channels entirely, spend €300 on the landing page and demo hosting, and run only LinkedIn outreach and two ICF chapter newsletters. The thresholds scale down proportionally: 8 paid with ≥4 cold, ≥60% at day 30. Slower and noisier, but the core signal — will a stranger enter a card, and will they still be using it in a month — survives intact.

---

## X. Coaching versus Lume

### X1. Comparison

| Dimension | **Lume for individual PMs** | **Coaching client memory** | Winner |
| --- | --- | --- | --- |
| **Pain** | Real, but partly absorbed by the organisation — Jira, Confluence, a delivery manager, a team who also remember | Real, and the coach is genuinely alone with the record. Nobody else holds it | **Coaching** |
| **Customer clarity** | Poor. "Individual PM" is a role inside a company; it is ambiguous whether they buy personally or their employer buys | Good. A self-employed professional with a company card and purchasing autonomy | **Coaching** |
| **Willingness to pay** | Low personally. PMs expect their employer to buy tools, and employers buy Jira, not a second brain for one person | Moderate and defensible. €39 is roughly eight minutes of billable time and is an ordinary business expense | **Coaching** |
| **Acquisition** | Hard. No targetable channel; PMs are inside companies and the tool market is dominated by incumbents with enterprise motions | Cheaper and far more targetable — ICF chapters at $25–$150, identifiable individuals on LinkedIn, training schools. But the audience is small and six competitors are already courting it | **Coaching, narrowly** |
| **Competition** | Atlassian, Notion, Linear, Monday, Granola, ChatGPT, plus every AI-second-brain startup. The most crowded category in software | Six shipping products on the exact mechanism, a $25 unlimited-client floor with a free tier beneath it, plus ChatGPT and Granola. Countable, but *occupied*, and two funded entrants died here in fourteen months | **Draw — both are bad** |
| **Retention** | **Weak, and structurally so.** A PM changes project every 6–18 months and the accumulated memory dies with the project. The value curve resets, permanently | **Strong, and structurally so.** Client relationships run for years, engagements repeat, and the record compounds across the whole practice | **Coaching, decisively** |
| **Privacy** | Corporate IP. The employer's security team will block a personal tool holding project data, and the PM cannot authorise it | The coach owns the confidentiality obligation and can decide alone. Real third-party-data exposure, but no gatekeeper | **Coaching** |
| **Differentiation** | Very hard. "AI second brain for work" is undifferentiable, and the incumbents already own the workflow surface | Narrower and clearer. The no-recording, approve-before-truth, model-the-client's-world combination is currently unoccupied | **Coaching** |
| **Speed to first 25 customers** | Slow. No channel, no community, no referral mechanism | Faster. Identifiable individuals, warm community channels, founder-led selling works | **Coaching** |
| **Path to 100–200** | Unclear. There is no obvious route from 25 individual PMs to 200 | Plausible but contested. Requires beating six competitors on trust within a community that talks to itself | **Coaching** |
| **Strategic upside** | Larger nominal TAM, but no credible route to capturing it | Smaller TAM, realistically capped around €50k–€100k ARR for a focused solo product | **Lume nominally; coaching in practice** |

### X2. The answer

> **Coaching is a genuinely better market for Lume's underlying intelligence than individual project managers — not because it is bigger, but because the customer exists as a purchasable individual, the value is legible in one sentence, and the memory compounds instead of resetting. That does not make it a good market. It makes it a better bad one.**

Both propositions can be true at once and the report should not blur them. Coaching wins nine of the eleven dimensions below. It also has six shipping competitors, a $25 price floor, a free tier under that floor, and two venture-funded corpses from the last fourteen months. Winning a comparison against a market you had already decided against is a low bar.

The decisive argument is **retention**, and it is structural rather than a matter of execution. Lume's core capability is maintaining durable truth about a long-lived subject. For a project manager, the subject dies every twelve to eighteen months and the accumulated value dies with it — which means the product must re-earn its value repeatedly and can never build a switching cost. For a coach, the subject is a human relationship that runs for years, recurs after gaps, and accumulates across an entire practice. The same technology, pointed at a subject that persists, produces a fundamentally different retention curve.

The secondary argument is **customer clarity**. "An individual project manager who buys software with their own money for their work life" is a customer who mostly does not exist. "An independent executive coach" is a customer who demonstrably exists, is enumerable, and already buys three or four subscriptions.

So: better, and genuinely so — not merely another plausible application. But **better is not big**. Coaching wins nine of eleven dimensions and loses the one that determines the size of the outcome. The honest framing is that this is a route to a *real, focused, profitable product with defensible retention*, not a route to a large company. If the objective is a large company, neither of these is the answer and this investigation has not found one.

### X3. Two caveats against forcing the conclusion

**Coaching does not inherit Lume's reliability as an advantage — only its instrumentation.** Section B10 and section O4 are unresolved. Until the current LUME FAILURE rate is measured under the v3 scorer and driven to something near zero on identity-ambiguity cases, "more reliable" is a claim about architecture rather than about behaviour, and it should not appear in marketing.

**A third option exists and was not examined here, and after the competitive findings it is the one I would examine next.** The same capability pointed at other long-lived, individually-owned, relationship-heavy subjects — independent therapists and clinical supervisors, financial advisers with recurring client reviews, agents and talent managers, non-executive directors across board portfolios, physiotherapists and clinicians with long-term caseloads. Several have better economics, harder regulatory moats and far less crowding than coaching.

The test that would have caught the coaching problem before three days of work is worth stating as a reusable filter: **before assessing a market, search for the product's own headline.** If two independent competitors are already running your sentence, the analysis is over. That check takes ten minutes and it is now the first thing that should happen in any successor to this investigation.

---

## Y. Questions Part 2 must resolve technically

Ordered by how much they would change the decision.

### Y1. Reliability gate — the blocking question

**What is the current LUME FAILURE rate under the v3 scorer, and what rate is acceptable before a paying coach touches confidential client data?** The published dashboard rows are scorer v1 and show 5–16 Lume failures per model, including `ambiguous-same-first-name → write` and `mixed-domains → write — Unresolved target became CREATE`. Part 2 must produce a current number and a **numeric ship gate**. My proposal, for challenge: zero LUME FAILURE on any cross-client or identity-ambiguity case, and under 2% on all others. If that gate is unreachable at acceptable cost, the product should not ship regardless of what validation says.

### Y2. Cross-client isolation — the existential invariant

`verify-d035-project-isolation.ts` and the D-035 rule ("every project-domain mutation must verify that the target durable object belongs to the intended project") transfer directly and are the highest-value inherited asset. Is project-scope isolation *sufficient* for client confidentiality, or does client scope need something stronger — a distinct RLS predicate, a per-client key, a belt-and-braces assertion at the serialisation boundary as well as the mutation boundary? What does the test suite need to look like to make this claim credibly?

### Y3. Reuse measurement, not reuse assertion

Quantify it. Of ~65,000 lines across 347 TypeScript files and roughly fifty `verify:*` scripts, how much survives a domain change **unchanged**, how much with **terminology only**, and how much **not at all**? My hypothesis for testing: `src/ai/domain` (the domain document, dictionary, prompt assembler and audits), `src/lib/capture-v2` (observations, validation, resolution), `src/lib/capture/apply` (the planner and legal-domain dispatcher), the knowledge identity and reconcile layer, the people identity and share-vs-replace logic, and the auth/RLS/billing foundation are largely portable; the Ocean UI shell, `ocean-frames`, the mode bar, releases, meetings and the seed/demo layer are not.

### Y4. Fork, extract, or parameterise

Three options with very different costs: hard-fork the repository; extract the AI and trust layers into a shared package consumed by two apps; or parameterise a single codebase by domain. Note that Lume's own constitution explicitly rejects speculative shared abstractions and lists "Generic Truth Engine" and "Entity-Everything table" as things not to build. Part 2 should cost all three honestly and should probably recommend the fork, but must show the working.

### Y5. How far does the existing domain abstraction actually get you?

`src/ai/domain` separates a domain document (`project-domain.md`), a term dictionary, a typed entity/operation vocabulary and a sectioned prompt assembler (`role`, `domain`, `dictionary`, `context`, `capture`, `schema`). Likewise `CaptureObservationV2` is parameterised by string unions of domains and dispositions and is otherwise domain-neutral.

**But note the correction in A1.10a: Capture V2 does not use that assembler for its live model call.** It builds its own short prompt in `src/lib/capture-v2/prompt.ts`; the assembler serves the *legacy* path and is invoked by V2 only for metrics. So writing a `coaching-domain.md` would reconfigure the extractor that is being retired, not the one that is the target. The experiment is still worth running — swap the domain vocabulary, rewrite the V2 prompt for coaching, and measure extraction quality on real coaching notes — but it is a somewhat larger experiment than the first draft assumed, and Part 2 should decide whether the assembler is worth pointing V2 at or whether it should be deleted with the legacy path.

### Y6. Client above engagement

Part C §C7 already decides workspace-scoped Person identity with project-scoped participation, including the correct identity principles, and it is unbuilt. Is coaching the forcing function? What does the migration from `stakeholders` look like, and — critically — does the coaching product need it on day one, or can it launch with client-as-project and migrate later without data loss?

### Y7. Session as a first-class entity

`capture_sessions` exists and is underused (D-013). Does it become Session, or is Session new? Session date must be distinct from note creation date, and sequence within engagement must be explicit. What does this do to provenance rendering and to the "since last time" query?

### Y8. Commitment ownership

`todos.waitingOn` is a text name, not a foreign key. Coaching needs a hard `client` / `coach` / `third_party` owner axis, and misattribution is a top-three failure mode. Schema change, and what does it do to the apply dispatcher's legal-domain checks?

### Y9. Reported speech through the whole pipeline

Adding `reported` to the `epistemic` enum is trivial. The real question is whether the attribution survives extraction, validation, storage, `serializeCanonicalTruth`, the prompt, the answer, and the rendering — end to end, under test. If it can be lost anywhere in that chain, the product will eventually state that Martin is unsupportive.

### Y9a. Provenance to the source sentence — newly identified as blocking

Verification found that Capture writes provenance without a source id, that no durable fact is foreign-keyed to `capture_sessions`, and that todos, risks and milestones have no provenance column at all. **The product cannot currently show the sentence that produced a fact**, which is the centrepiece of the demo in sections J and V and the clearest thing ChatGPT cannot do.

What does it cost to make every durable fact traceable to a session and, ideally, to a character range within the stored note? This is probably a small schema change plus discipline at every write site — but it must be costed, because the proposition depends on it.

### Y9b. Relative-date resolution

There is no chrono-style normaliser. *"Next Friday"*, *"a fortnight ago"* and *"before the board thing"* are unresolved, and the session date differs from the note-creation date. What is the smallest correct approach — model-side normalisation against an explicitly supplied session date, a deterministic library, or both with a reconciliation check?

### Y9c. Document import

`addFileName` exists with no caller and there is no file input. Section H treats bulk first-load of existing notes as load-bearing for activation, and the concierge validation in section W depends on it. This is new work.

### Y10. Goals

New first-class entity, or `knowledge_items` with `kind = goal` and existing supersession? Evaluate against the actual query: *"what has she said about the VP role over eight months?"*

### Y11. The coaching evaluation corpus

Lume's evaluation worlds are Candyland, Toyworld and GamingStudio5000. Coaching needs three worlds with twenty-plus **stacked** sessions each, containing deliberately planted ambiguities: two Martins, a hedge that must not harden, a superseded goal, a commitment that goes quiet, a contradiction across four months, a psychological-inference trap, and a cross-client bait case. **This is probably the highest-value early engineering work in the entire programme** and Part 2 should cost it explicitly.

### Y12. Persistence debt that becomes fatal

D-004 (many history events never persist), D-003 (dismissed suggestions resurrect on reload), and the remaining optimistic-write paths under D-005 are tolerable in a PM tool and fatal in a product whose entire promise is *"it remembered."* What is the cost to close them, and can any of the product ship before they are closed?

### Y13. Model choice and unit cost, measured

Section S estimates €1.40–€9.70 per user per month depending on model tier. Measure it: real token counts for extraction against a twenty-session picture with a 300-word note, for a prep brief, and for an Ask. Does the Y1 reliability gate require a frontier model, and if so, what does that do to the margin at €39?

### Y14. Deletion, export and residency

Verified per-client hard delete with cascade across every table plus a documented backup window; whole-practice export in Markdown and JSON; EU/UK residency for the application database. Lume has permanent project delete (D-027, no archive) and no export. Coaching needs archive *and* verified erasure *and* export, which is three things where there is currently one.

### Y15. Billing entitlements

Stripe scaffolding exists but "actions left" is a local analysis meter rather than a Stripe entitlement (D-024), and billing tables are missing from the generated database types (D-012). What is needed for real active-client-limit enforcement and archive-aware counting?

### Y16. Frontend — reuse or rebuild

Section L concludes the Ocean shell and the Capture/Knowledge/Advise mode bar are wrong for this product. Is any of the frontend reusable, or is the honest answer a fresh Next.js app consuming the same libraries? Include the drawer pattern, the deterministic suggested-question generator and the sparkle convention in the assessment — those specific pieces are worth keeping.

### Y17. Can the validation cohort run on Lume itself?

The most economically interesting question in Part 2. Could the twenty-customer concierge cohort in section W be served by a renamed, flag-gated Lume behind a login, with the founder doing extraction manually where the pipeline is weak? If so, what is the **smallest safe** change set — client isolation, terminology, hiding PM-specific frames, disabling Coach and Advise — and does it stay inside the "no speculative abstractions" rule? A yes here would cut the cost of validation by an order of magnitude.

### Y18. Test-suite portability

Which of the ~50 `verify:*` scripts are domain-coupled and which are infrastructure? Estimate the rewrite. `verify-rls-policies`, `verify-tenant-isolation`, `verify-phase2-auth`, `verify-production-config` and `verify-d035-project-isolation` look portable; `verify-risk-lifecycle`, `verify-people-entities`, `verify-ocean-*` and `verify-new-project*` look coupled.

---

## Appendix 1 — What Lume actually is, verified against code

Inspected at branch `main`, HEAD `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f`. Where documentation and code disagree, the code and the repository's own current-architecture handoff are treated as authoritative and the disagreement is noted.

### A1.1 Shape

Next.js 16.2.11 (App Router) · React 19.2.4 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Stripe 18.5 · deployed on Vercel. Approximately **65,126 lines across 347 TypeScript/TSX files**. Notably, **no AI SDK dependency** — model calls are made directly.

Eight migrations: `workspace_schema`, `tenant_rls`, `fix_grants_and_membership_helper`, `phase2_ensure_personal_workspace`, `billing_foundation`, `project_intelligence_snapshots`, `eval_runs`, `knowledge_canonical_metadata`.

### A1.2 Documentation reliability

The repository maintains an explicit **documentation authority hierarchy** (`docs/README.md`) which is unusually disciplined: a stable product constitution, a current-architecture handoff, a living known-defects register, then historical handovers that must not be treated as current. The root `README.md` is explicitly marked stale and describes a localStorage-era product that no longer exists.

**Documentation/code disagreements found and how they resolve:**

- The root `README.md` describes localStorage persistence and a demo-user login gate. Superseded — production uses Supabase Auth and Postgres. The README says so itself.
- `docs/MISSION.md` describes "Mission Control … AI Chief Project Officer, Executive Coach and Second Brain" and references `src/lib/mission.ts`, `src/lib/coach.ts`, `src/lib/release-playbook.ts`. Those files exist, but the current product constitution parks the Coach surface and lists "Coaching terminology/product" as explicitly out of V1 scope. **The word "coaching" in this repository refers to advising the project manager, not to professional coaches** — worth flagging because it will otherwise confuse Part 2.
- The 19 August Project Truth Architecture Audit is explicitly recorded as partly stale, particularly on Risks, People persistence and Confirm Owner.
- The handoff itself records that `src/types/database.ts` lags the migrations (D-012), so generated types are not a reliable table inventory.

The handoff is candid about its own limits, maintains a numbered defect register with severity and target stage, and includes a list of "dangerous assumptions future developers should not make". This is materially better documentation hygiene than most production codebases.

### A1.3 Data model

Runtime state is a single in-memory `MissionState` (`src/lib/types.ts`) which is a **hydrate/mutate cache** over durable Postgres tables when `persistenceMode === "supabase"`, and the durable authority only in local mode.

Durable tables: `workspaces`, `workspace_members`, `profiles`, `projects`, `stakeholders`, `todos`, `risks`, `knowledge_items`, `milestones`, `memories`, `recommendations`, `meetings`, `releases`, `history_events`, `capture_sessions`, `coach_sessions`, `project_intelligence_snapshots`, `workspace_usage`, and billing tables.

Durable truth is **normalised relational rows, not a JSON document.** `project_intelligence_snapshots` exists but is a derived compression that the canonical Ask path ignores. This matters for Part 2: there is no giant state blob to untangle.

The most valuable object is `knowledge_items`, which carries a canonical metadata overlay on the same rows (added by the August migration): `kind` (`fact | responsibility | decision | risk | date | dependency | availability | open_loop | ambiguity`), `epistemic` (`confirmed | pending | informal | suggested | inferred | conflicting | unknown | legacy`), `lifecycle` (`current | superseded | historical`), `supersedes_id`, `meta`, `provenance`. Current truth is `lifecycle = 'current'`.

Identity discipline is strong and explicit: never match by array index; match order is exact body, then stable UUID, then unique deterministic wording-edit, then insert-new-and-delete-unmatched — with the stated principle *"prefer losing inferred identity to transferring metadata to the wrong item."*

### A1.4 Authentication, tenancy and RLS

Supabase Auth in production (`@supabase/ssr`), with demo-JWT and no-auth modes retained for local development. Every product table carries `workspace_id` with RLS enforced through an `is_workspace_member` membership helper. Projects belong to a workspace rather than to a user.

An important and correctly documented subtlety: **workspace RLS is not a per-project ACL.** Application code must keep `projectId` filters even where RLS would permit access to other projects in the same workspace. This is exactly the property that would need strengthening for per-client confidentiality.

### A1.5 Capture and AI extraction

Two pipelines exist behind a flag, which the repository explicitly treats as temporary.

**Legacy** (`LUME_CAPTURE_V2` unset — current default): an OpenAI findings path with a local regex fallback.

**Capture V2** (`src/lib/capture-v2`, ~1,490 lines): the decided V1 target. The model emits atomic **observations** rather than mutations:

```ts
export type CaptureObservationV2 = {
  id: string;
  statement: string;
  evidence: string;
  domain: ObservationDomain;        // person | responsibility | risk | milestone |
                                    // todo | availability | knowledge | decision |
                                    // commentary | unknown
  disposition: ObservationDisposition; // update_existing | create_new | no_change |
                                       // ambiguous | merge | commentary | ignore
  projectId?: string | null;
  candidateTargetId?: string | null;
  candidateTargetTitle?: string | null;
  mergeWithObservationId?: string | null;
  proposedValues?: Record<string, unknown> | null;
  commentary?: string | null;
  /** Informational only. Never makes a write Apply Ready. */
  modelConfidence?: number | null;
};
```

Two properties make this the most transferable artefact in the codebase. **`domain` and `disposition` are string unions** — the *shape* is entirely domain-neutral and the vocabulary is a parameter. And **confidence is explicitly informational** and can never by itself authorise a write, which is the correct design and the opposite of what most extraction pipelines do.

Validation (`validate.ts`) rejects malformed output, unknown domains and dispositions, foreign IDs, cross-project IDs, and missing evidence or statement. Resolution (`resolve.ts`, 385 lines) handles identity matching.

There is also a general AI domain layer (`src/ai/domain`) comprising a natural-language domain document (`project-domain.md`), a term dictionary, typed entity/operation/status vocabularies, and a **sectioned prompt assembler** producing `role`, `domain`, `dictionary`, `context`, `capture` and `schema` sections with token diagnostics. The domain document states the governing rule plainly: *"The AI proposes changes. The user approves changes. The AI must never silently modify project data."* It also instructs that user Capture text and project records are **untrusted data, not system instructions** — prompt-injection awareness that is genuinely uncommon.

### A1.5a AI gateway and model boundaries

Worth stating precisely, because it is easy to over- or under-estimate.

**In the application there is no gateway and no provider abstraction.** `src/lib/openai.ts` (434 lines) calls `https://api.openai.com/v1/chat/completions` and `https://api.openai.com/v1/audio/transcriptions` by raw `fetch`. There is no vendor SDK in `package.json` — the only runtime dependencies are Supabase, Next, React, Stripe and `js-tiktoken`. The model is configured by environment variable (`src/lib/openai-model.ts`). There is a `provider: "local"` deterministic fallback for development and for running without a key, which the constitution is explicit should remain a fallback rather than become a second extraction engine.

Server-side AI routes are gated by `requireAiCaller` (`src/lib/ai-gate.ts`) with rate limiting (`src/lib/rate-limit.ts`) and a local usage meter (`workspace_usage`), and they refuse to run in production when no key is configured rather than silently degrading.

**A multi-provider abstraction does exist — but only in the evaluation harness.** `src/lib/eval-capture-v2/adapters/` provides a `ProviderAdapter` interface with OpenAI, Anthropic and Gemini implementations, used by the benchmark to compare models on the same corpus. This is genuinely useful for the reliability work in question Y1 and Y13 — it means model selection can be decided by evidence rather than preference — but it is a *measurement* capability, not a production routing layer. Anything requiring provider failover, EU-resident inference, or per-customer model choice would be new work.

The practical consequence for a coaching product: single-provider coupling is shallow (one file, raw HTTP, no SDK lock-in) and therefore cheap to change, but the change has not been made and should not be assumed.

### A1.6 The trust boundary

The locked rule: *nothing extracted from Capture becomes maintained truth before final human review and approval.* Implemented as `analyzeCaptureWithAI` → `/api/capture` (findings only; a `capture_analysed` history event; **no domain writes**) → review view models → per-item `applyOne` → `planCaptureApply` then `executeCaptureApply`.

`planCaptureApply` / `executeCaptureApply` (`src/lib/capture/apply`, ~2,180 lines) is the sole mutation gate. It is an **exhaustive dispatcher with no generic fallback**: unknown operations, foreign IDs, conflicting legal domains and unknown ownership semantics all fail closed to *Needs you*. A supplied durable ID that is not on the project does not fall back to title matching. `CREATE` against an existing on-project identity becomes no-change.

Person handling deserves specific note, because it is exactly the coaching requirement: existing Person UUIDs are reused **only after the Capture text establishes that Person**; a model-supplied UUID is explicitly *not* identity proof; incomplete first-name fragments and competing same-name records fail closed.

### A1.7 Ambiguity and the epistemic model

Three user-facing states: **Known** (ordinary maintained truth, deliberately unbadged), **✦ Lume noticed** (a supported implication that never silently becomes truth), and **Needs you** (a material gap, ambiguity or contradiction requiring resolution). Contradictions must surface rather than resolve silently. Ambiguity is also a first-class `kind` on `knowledge_items`.

### A1.8 Retrieval surfaces

**Tell Me / Ask** — implemented. The HTTP path authenticates, loads durable state server-side, verifies project membership, filters, then `serializeCanonicalTruth`. Client-supplied state is *not* a truth input, and load failure returns a visible error rather than falling back. Retrieval is **structured-state assembly, not vectors** — the repository explicitly rejects vector infrastructure without demonstrated need. History evidence is included only when the question looks historical. Ask is read-only.

**Catch Me Up** — not found as a named feature. The nearest implemented behaviours are Ask and the intelligence header.

**Meeting Prep** — a legacy frame, retained conditionally, explicitly not under active investment and marked as disableable before launch.

**Coach / Advise** — `/api/coach` streams PM coaching advice (`src/lib/pm-coach.ts`, 484 lines) into a drawer. **This is advice for the project manager, not professional coaching.** The constitution parks Advise as "coming soon", the convergence decisions say to hide or retire Coach, and it is one of the last routes still accepting browser-supplied state (D-033).

**Knowledge Centre** — the heart of V1. Deterministic search (no AI call), browsable frames over maintained truth, item detail with provenance, previous values and correction controls.

### A1.9 Testing and evaluation

The strongest asset in the repository.

Roughly **fifty `verify:*` scripts** run through a credential-free deterministic suite (`npm test` → `scripts/run-regression-suite.ts`, which strips `OPENAI_API_KEY`). Coverage spans knowledge reconciliation, project-truth safety, risk lifecycle, people entities, Ask context authority, canonical truth, capture trust boundary, the Phase 3B apply gate, RLS policies, tenant isolation, auth, production config, and D-035 project isolation. Plus a frozen Playwright journey set and `fast-check` property invariants.

The **evaluation harness** is genuinely differentiated. Live model evaluation is opt-in and paid, run across OpenAI, Anthropic and Gemini, over fictional "worlds" (Candyland, Toyworld, GamingStudio5000) with stacked multi-turn Capture scenarios. Results publish to a GitHub Job Summary and a persistent Issue.

Its most valuable idea is a three-way failure taxonomy that almost nobody else maintains:

- **MODEL FAILURE** — the model was wrong.
- **LUME CATCH** — the model was wrong, and the system converted that into rejected / no-change / Needs you, so it never became truth.
- **LUME FAILURE** — the system allowed a wrong output to become a legal write.

As the dashboard documentation puts it: *"A caught model mistake is not the same as Lume corrupting truth. Do not collapse them into one fail score."* That distinction is the correct way to measure a trust boundary and it is the reason the reliability problem in section O is tractable.

### A1.10 Current measured state — the uncomfortable part

From the product constitution (§19), on the controlled 45-case benchmark:

| Path | Lume | Generic GPT baseline | Trust failures | Critical | Lume tokens | GPT tokens |
| --- | --- | --- | --- | --- | --- | --- |
| Model Tidy / legacy | 30/45 | 32/45 | 0 | 0 | 49,157 | 21,470 |
| Canonical Slice 1 | 23/45 | 30/45 | 0 | 0 | 37,404 | 21,452 |

From the published Test Dashboard (Issue #73, last updated 27 August 2026), latest live Capture V2 evaluation at scorer v1 across 21 cases in three worlds:

| Model | Recall | False positives | Lume catches | **Lume failures** |
| --- | --- | --- | --- | --- |
| anthropic / claude-sonnet-4-5 | 100% | 13 | 27 | **16** |
| openai / gpt-4.1-mini | 89.5% | 9 | 8 | **9** |
| openai / gpt-4o-mini | 89.5% | 9 | 21 | **5** |
| gemini / gemini-2.0-flash | — | 0 | 0 | 0 (no successful run) |

Classified failures include `ambiguous-same-first-name → write — Must not silently CREATE another Brick`, `availability → write — Must not CREATE a duplicate Fizz`, `mixed-domains → write — Unresolved target became CREATE`, and `new-person → write — Wrong-domain legal write`. Several MODEL FAILURE rows are the opposite problem: *Needs you* on cases that expected a confident path.

These rows are labelled scorer v1; commit history shows a v3 scorer landing ("Capture V2 eval scorer v3 measures genuine durable-truth failures"), so current figures may differ materially. Establishing the current number is question Y1.

### A1.10a Findings that correct or sharpen the picture

Verified directly against code. Several matter more than their size suggests.

**Provenance does not reach the source.** Capture writes `provenance: [{ type: "capture", at: ... }]` and leaves the optional `id` unset (`src/lib/capture/apply/persist-execute.ts`). `capture_sessions` holds the raw transcript, but no durable fact is foreign-keyed to it, and `todos`, `risks` and `milestones` have no provenance column at all. **The "click a statement, see the sentence that produced it" capability — the centrepiece of the demo in sections J and V — does not exist.** The detail drawer is honest about this (it renders humanised provenance from stored entries only, with explicit honesty notes when empty), which is good behaviour over a weak substrate.

**Catch Me Up does not exist.** A whole-repository search for `Catch Me Up`, `catch-me-up`, `catchMeUp` and `catch_me_up` returns zero hits. The only near-match is suggestion copy reading *"What open loops could catch me out?"*, which is unrelated.

**Meeting Prep is stored data, not AI, and it does not persist.** The `meetings` table exists and is read on hydrate, and the prep UI renders stored fields (opening script, objectives, talking points, questions, leadership moments). But `updateMeeting` in `store.tsx` **only mutates local state** — there are no `.from("meetings")` writes anywhere outside the loader. Meeting Prep edits are lost on reload. The feature is seed and demo data with an editor that does not save.

**No relative-date normalisation exists.** Form validation accepts `YYYY-MM-DD` only; Capture V2 expects the model to have already produced ISO strings; there is no chrono-style library in the dependency tree. *"Next Friday"* is unresolved. For a product whose input is prose written days after the session, this is a real gap, and it interacts badly with the session-date-versus-note-date distinction argued in section M2.

**File upload is a stub.** `addFileName` and `source: "uploaded"` exist in the session model, but the function has **no caller** anywhere in the repository and there is no file input in the Capture UI. Bulk paste works; document import does not. Section H listed bulk first-load as load-bearing for activation, so this is new work, not reuse.

**D-035 is further along than the documentation says.** The Known Discoveries register and the architecture handoff both still describe `persistTodoUpdate` as keying by id alone. The code now scopes by workspace *and* project through `scopeExistingTodo`, covered by `scripts/verify-d035-project-isolation.ts`. The documentation is stale on the Todo instance; it remains correct that the broader class of persist helpers has not been audited.

**Capture V2 does not use the shared domain assembler for its live model call.** `src/lib/capture-v2/prompt.ts` builds its own short prompt; `project-domain.md` and `assemblePrompt` are used by the **legacy** path, and V2 builds the legacy assembly only for metrics and the developer cockpit. This materially weakens the cheap experiment proposed in question Y5 — writing a `coaching-domain.md` would reconfigure the *legacy* extractor, not the target one.

**There is no numeric confidence on knowledge.** Certainty is carried entirely by the `epistemic` enum. Numeric confidence exists only on `Recommendation` and on Tell Me's answer band. Separately, `modelConfidence` in Capture V2 is rescaled with `Math.round(x * 100)` in `toResult.ts` while the schema does not pin whether the model returns 0–1 or 0–100 — a latent inconsistency, currently harmless because V2 treats confidence as informational.

**History is coarser than "change intelligence" implies.** `history_events` is insert-only with a fixed sixteen-value type enum, capped at 500 entries in memory, and there is no structured "what changed since timestamp X" query. Historical Ask selection is token overlap against event titles, falling back to the last six events. Answering *"when did she first mention leaving?"* would today depend on an event happening to mention it, or on a row's `created_at`.

**Smaller precise corrections.** There are **52** `verify-*.ts` scripts totalling roughly 20,151 lines with about 2,234 assertions; 45 run in `npm test` and 7 are excluded. The request gate is `src/proxy.ts` (Next 16 convention), not `middleware.ts`. There is no Zod — validation is hand-rolled in `src/lib/data/validate.ts` plus domain validators. `supabase/config.toml` points at a `seed.sql` that **does not exist** in the repository. The trial is 14 days via `ensure_workspace_trial`, enforced through `evaluateEntitlement` and `requireAiCaller`, with `past_due` deliberately still permitted as grace. The `/capture` route redirects to `/` — the real Capture UI is inside the Ocean workspace. `workspace_usage.analyses_this_month` is not wired into hydrate at all (`load-mission-state` hardcodes zero).

**One correction to the market research, for completeness.** Section D classified Osmo as a direct competitor on longitudinal memory. On closer inspection it is a **coach self-improvement** product — per-session notes benchmarked against ICF Core Competencies, plus a peer community — with no cross-session memory layer. It is not on this wedge. That does not change the verdict, because CoachRocks, CoachUI, Coachful, CoachNova, SessionFlow and Wundamental are.

### A1.11 Known debt most relevant to a coaching product

| ID | Issue | Why it matters here |
| --- | --- | --- |
| **D-035** | Project-domain mutations must verify intended-project membership; `persistTodoUpdate` is one known instance of a broader class | **The cross-client contamination invariant.** Highest-value inherited work, and not yet complete across the class |
| **D-004** | Many history events never persist; History is incomplete after reload | Fatal for a product promising "it remembered" |
| **D-003** | Suggestion accept/dismiss is memory-only; reload resurrects dismissed suggestions | Dismissed observations reappearing would be actively distressing here |
| **D-005** | Soft/invisible save failures on remaining optimistic write paths | The coach believes a session was saved; it was not |
| **D-007** | Capture people prose not always promoted to durable person records | People are the differentiator; prose-only people undermine it |
| **D-013** | `capture_sessions` underused relative to client-side lists | Session must become first-class |
| **D-024** | "Actions left" is a local meter, not a Stripe entitlement | Real plan limits need real entitlements |
| **D-027** | No archive or undo after project delete | Coaching needs archive *and* verified erasure |
| **D-032/D-033** | Dual Capture engines; some AI routes still accept browser-supplied state | Should be resolved before any fork, not carried across |

### A1.12 Honest summary of what transfers

**Transfers well:** the trust philosophy and the review-before-write boundary; the observation/disposition extraction model; the canonical metadata overlay with lifecycle, supersession, epistemic state and provenance; person identity discipline (a name is not identity, fail closed on ambiguity, no fuzzy merging); the exhaustive fail-closed apply dispatcher; deterministic search and suggested questions; the workspace/RLS/auth/billing foundation; the sparkle affordance; and — most valuably — the evaluation harness and its three-way failure taxonomy.

**Needs domain replacement:** the entity vocabulary; the project-status concept; dependencies, releases and meetings; the Ocean frames and mode bar; the seed and demo layer; roughly half the verify scripts.

**Needs new work:** Client above Engagement; Session as first-class; Goal as a versioned entity; commitment ownership; reported-speech attribution end to end; export; archive; a coaching evaluation corpus.

**Must not transfer:** any status, score or health indicator applied to a person.

---

## Appendix 2 — Evidence quality notes

Read the market sections with these caveats.

**This niche is unusually polluted with AI-generated affiliate content.** Several sites returning prominently for "best coaching software" queries — including `coachstackhub.ai`, `psychology.com/coaching-software`, `tolodora.com` and similar — exhibit the signatures of generated affiliate content: implausibly precise statistics without primary sources, near-identical structure across competing domains, and invented-sounding proprietary benchmarks. Pricing figures from these sources were used only where corroborated by a vendor's own site, and their qualitative claims were not used at all. The existence of this content is itself a finding: it indicates high affiliate commissions, which indicates a crowded, commoditised, high-CAC category.

**Reddit was inaccessible.** Direct fetches to `reddit.com` returned HTTP 403 throughout. Practitioner voice was therefore sourced from coaching craft blogs written by named practising coaches, from professional-body publications, and from search snippets. A dedicated subagent was tasked with alternative routes to community evidence; where its findings are available they should be appended here. **The absence of first-hand practitioner posts describing memory failure as an acute pain is a genuine gap in this research and is treated as evidence in section D5 rather than papered over.**

**Vendor claims are unverified.** Wundamental's "9M+ data points" and "9.2/10 coaches recommend us", CoachNova's "12 clients to 28", and Osmo's "60% admin reduction" are marketing assertions reported as such. None was independently verifiable, and small vendors in early-stage categories routinely overstate. Corporate facts that *were* verified against primary registers — CoachNova's headcount and its own published burn figure, Wundamental OÜ's Estonian business-register decline from 2 employees to 1 and equity from €41,520 to €17,714, and the Practice.do and Profi shutdown notices — are treated as firmer than the marketing.

**Two competitor prices are second-hand.** `coachui.io` and `getsessionflow.co` sit behind Cloudflare bot protection; their figures were read from the search index of those pages rather than fetched directly. Verify before relying on them. Satori's tiers come only from psychology.com, one of the content farms described below, and could not be corroborated on the vendor site — treat as unverified.

**One classification in section D was corrected on closer inspection.** Osmo is a coach *self-improvement* product (per-session notes benchmarked against ICF Core Competencies, plus a peer community), not a longitudinal memory product. It was initially counted as a direct competitor and should not be. The verdict does not depend on it.

**ICF figures are self-reported survey data**, though the 2025 study was PwC-conducted with 10,000+ participants across 127 countries and is the most reliable source available for this market.

**CPC and CAC ranges are industry benchmarks, not measured campaign data**, and vary by an order of magnitude across sources. They are used only to establish that paid search is *marginal rather than decisive*, which is a robust conclusion across every range found.

**Cost estimates in section S are modelled, not measured.** They assume 2026 mid-tier and frontier API pricing and typical token volumes. Question Y13 asks Part 2 to measure them properly.

---

*End of Part 1. This report is the authoritative input for Part 2, which should investigate architecture, code reuse, testing and implementation economics against the questions in section Y.*
