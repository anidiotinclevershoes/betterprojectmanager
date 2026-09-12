# Hosted holdout — frozen six-journey specification

**Suite id:** `hosted-holdout-v1`  
**Status:** FROZEN before first hosted execution  
**Integration baseline:** `origin/main` `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b`  
**Machine source of truth:** [`frozen-spec.ts`](./frozen-spec.ts)  
**Original hosted six (do not mutate):** `e2e-hosted-vertical/journeys.spec.ts`

This document is the precommitment. Expectations were written from Lume product semantics and the original six-journey contract, **not** from a holdout run.

Do not run Lume and then edit this file to match behaviour.  
Do not weaken assertions after the first execution.  
If an expectation is later proven inconsistent with established Lume product semantics, document that explicitly before changing anything.

---

## Why this suite exists

The original hosted vertical harness already passes 6/6. That is necessary and not sufficient. This holdout asks a different question:

> Can ordinary but different project language travel through the same hosted Lume machine correctly?

It is not six cosmetically rewritten sentences. It uses a different project world, different people, different date formats, different entity order, and different create/update/ambiguity combinations.

## Required architecture path

Each applicable journey proves as much of this path as is relevant:

```text
browser
→ protected Preview
→ Lume auth
→ real UI
→ hosted API
→ live OpenAI
→ deterministic processing
→ Review
→ Apply
→ canonical Supabase truth
→ immediate hard reload
→ authoritative UI projection
```

Direct API calls are diagnostic evidence after a UI failure only.

## Standing product rules used to freeze expectations

- UI actions write canonical project truth through established contracts, then projections refresh.
- No cache- or feature-specific parallel truth stores.
- Timeline is projection only.
- New Project people may be name-only.
- Responsibilities are optional.
- Missing optional data is not Needs You.
- Needs You is reserved for unsafe ambiguity.
- Resolve stages Review state.
- Apply performs the canonical write.
- Tags are metadata, not truth.
- Ready means the same production Apply path can execute that change.

## Deliberate differences from the original six

| Original | Holdout replacement |
| --- | --- |
| Bob / Mike informal roles | No people in the New Project paste; issues + dated todos |
| Olga Petrov / Sarah Kim / Production release / CAB / runbook | Harbour repairs mobilisation; void pack; workshop; contractor start; DHP |
| “The Production release is now scheduled for 20 September 2026.” | New dated **create**: depot void keys, Friday 16 October 2026 |
| Long-form September update of Production release | ISO `2026-10-22` slip of a mobilisation workshop |
| Andris + Olga/Sarah identity | Priya / Tomos / Jess + new Kwame Boateng; speaker ≠ actor |
| “She will own UAT” + Production release 21 Sep | “they” huddle chair + independently safe depot date |
| Thursday stand-up one-liner with catering | WhatsApp/email paste, UK dates first, speculation, plants |

Forbidden original markers must not appear in holdout inputs. See `HOLDOUT_FORBIDDEN_ORIGINAL_MARKERS` in `frozen-spec.ts`.

---

## H1 — New Project issues and dated todos

**Coverage:** New Project with a different information shape from the current partial-people / full-create journeys.

**Exact input**

```text
Harbour repairs mobilisation — notes from the housing ops huddle.
The void inspection pack is incomplete and is blocking contractor start.
We still owe housing a repairs inbox SLA.
Book the mobilisation workshop for 8 October 2026.
Contractor start is 14/10/2026.
Working assumption: the DHP backlog stays with the in-house team until week 3.
```

**Expected Review (composer)**  
Organise fills the four-frame composer. Issues / To Do / Knowledge titles from the notes appear. People may be empty.

**Expected canonical truth**  
Create stores the void-pack and inbox-SLA issues, dated commitments `2026-10-08` (mobilisation workshop) and `2026-10-14` (contractor start), and DHP backlog knowledge. No required people rows.

**Expected post-reload UI**  
Knowledge Centre still shows those titles and both calendar days (including compact `8 Oct` / `14 Oct`).

**Expected Needs You**  
None required. Empty People is valid. Missing optional people/responsibilities must not become Needs You.

---

## H2 — Capture create dated action

**Coverage:** Capture Create path not equivalent to the existing date-create ambiguity case.

**Seed (compose UI, no Organise)**  
- Person: `Priya Nair`  
- Knowledge: `Repairs policy v3 is the current working version`

**Exact input**

```text
Can we put a reminder in? I need the void keys collected from the depot by Friday 16 October 2026. Repairs policy v3 is still the current working version.
```

**Expected Review**  
Create-family card for depot void-key collection on `2026-10-16`. Policy v3 is already-known. Must not invent a person from “I”.

**Expected canonical truth**  
Apply writes one new dated action/milestone for `2026-10-16`. Priya and policy v3 unchanged.

**Expected post-reload UI**  
Priya Nair, policy v3, void keys / depot, and 16 Oct 2026 remain after hard reload.

**Expected Needs You**  
Not required. “I” is the capturing PM.

---

## H3 — Capture ISO date update

**Coverage:** Capture Update with different wording, date representation, and entity context.

**Seed (Organise)**

```text
The mobilisation workshop is on 8 October 2026.
Priya Nair owns contractor liaison.
```

**Exact input**

```text
FYI — the mobilisation workshop has slipped.
New date is 2026-10-22.
Priya Nair still owns contractor liaison; no change there.
```

**Expected Review**  
Update preferred (create acceptable if independently actionable) for mobilisation workshop `2026-10-22`. Priya must not steal the workshop identity.

**Expected canonical truth**  
Workshop commitment is `2026-10-22`. Priya remains contractor liaison. 8 October is no longer the current workshop date.

**Expected post-reload UI**  
22 Oct 2026 + mobilisation workshop. Must not still present 8 October as the current workshop date. Priya remains.

**Expected Needs You**  
Not required for the slipped date. Restating an existing responsibility is not Needs You.

---

## H4 — Multi-person identity isolation

**Coverage:** Multi-person / multi-entity case that can expose identity leakage or transcript contamination.

**Seed (Organise)**

```text
Priya Nair owns contractor liaison.
Tomos Reed owns voids.
Jess Hale owns resident comms.
```

**Exact input**

```text
Stand-up: Tomos said Priya would pick up the DHP queries this week.
Jess is covering resident letters.
Kwame Boateng is joining as the contractor lead for Harbour.
```

**Expected Review**  
Kwame appears as create or Needs You. DHP, if written, attaches to Priya, not Tomos. Jess may be update or no-op. No existing person card absorbs Kwame’s contractor-lead statement.

**Expected canonical truth**  
Kwame is written only if Apply-ready. Tomos must not become DHP owner or contractor lead from this paste. Jess must not become Kwame.

**Expected post-reload UI**  
Priya, Tomos, Jess remain. Kwame only if applied. No mixed identity row.

**Expected Needs You**  
Acceptable for Kwame; acceptable for DHP if attribution is treated as unsafe. Silent mis-assignment is a fail.

---

## H5 — Ambiguous they plus safe date

**Coverage:** One genuinely ambiguous observation plus one or more independently safe observations.

**Seed (compose UI)**  
- `Elena Voss`  
- `Tomos Reed`

**Exact input**

```text
After the call with Elena Voss and Tomos Reed, they agreed one of them will chair the weekly mobilisation huddle. I could not hear who.
Separately: collect the void keys from the depot on 16 October 2026.
```

**Expected Review**  
Huddle chair stays Needs You. Depot void-key collection on `2026-10-16` is independently actionable create.

**Expected canonical truth**  
Apply writes the 16 October depot collection. Must not write Elena or Tomos as huddle chair.

**Expected post-reload UI**  
16 Oct 2026 and void keys / depot remain. Must not show a guessed huddle chair.

**Expected Needs You**  
Required for who chairs the weekly mobilisation huddle. Not required for the depot date.

---

## H6 — Messy ops paste

**Coverage:** Realistic messy paste with ordering/phrasing substantially different from the existing mixed journey.

**Seed (Organise)**

```text
The mobilisation workshop is on 8 October 2026.
Priya Nair owns contractor liaison.
Tomos Reed owns voids.
Elena Voss owns resident liaison.
Repairs policy v3 is the current working version.
```

**Exact input**

```text
From: housing ops
Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.

22/10/2026 is the new mobilisation workshop date (was 8 Oct).

Parking: the office plants need watering; not a control.

Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.

Kwame Boateng is the contractor lead for Harbour.

Void keys still need collecting from the depot on 16 Oct 2026.

Elena said the repairs policy v3 remains current.
```

**Expected Review**  
Workshop `2026-10-22` Apply-ready. Void keys `2026-10-16` Apply-ready if new. Kwame create or Needs You. Policy v3 already-known. Plants / biscuits must not become truth. Speculative DHP stays Needs You or is omitted.

**Expected canonical truth**  
May include workshop 22 Oct, void keys 16 Oct, and Kwame if Apply-ready. Must not store plants, biscuits, or speculative Priya-owns-DHP.

**Expected post-reload UI**  
Workshop 22 Oct and any applied void-key date remain. No plants, biscuits, or speculative DHP as maintained knowledge. Priya / Tomos / Elena remain.

**Expected Needs You**  
Required or omitted-without-write for speculative DHP. Acceptable for Kwame. Not required for the clear workshop move or depot date.

---

## First-run policy

On the first execution of this frozen suite:

1. Do not fix production code.
2. Run the complete suite once.
3. Preserve the result as `baselines/first-run-untouched.md`.
4. Do not weaken expectations, add sleeps, alter test data, or patch Lume.

If anything fails: classify the earliest structural boundary, gather evidence, and stop before remediation.

If the first run is 6/6: record that clearly, then collect one additional clean 6/6 holdout run and rerun the original hosted six unchanged.
