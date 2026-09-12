# Canonical Project Truth

**Status:** Specialist architectural contract  
**Date:** 12 September 2026  
**Peer invariant:** [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md)  
**Owned by:** [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) §3  
**Docs entry:** [`docs/README.md`](./README.md)

This file owns the **write-then-project** rule. v0.9 leftovers and isolation evidence stay in [`docs/LUME_V09_TO_V1_HANDOFF.md`](./LUME_V09_TO_V1_HANDOFF.md) §3.

---

## 1. The invariant

> **Actions must create or update canonical project truth through the then-current established architecture, then re-project that truth into the relevant surfaces. Actions must never create their own parallel or feature-specific truth.**

This is Lume-wide. It is not a Timeline-only rule.

```text
User action in a product surface
  → existing canonical write / domain contract
  → authoritative project truth changes
  → all projections re-read / re-project that truth
```

Forbidden:

```text
User action in a product surface
  → special surface-specific record / store
  → separate competing truth
```

Shorthand:

```text
UI action → canonical truth → projections refresh
```

Never:

```text
UI action → feature-specific truth store
```

---

## 2. What is canonical today

Durable authority is **Supabase**, scoped by workspace membership (RLS) and application-layer project membership.

Surfaces re-project that truth. Client `MissionState` is a hydrate / paint cache. It is not Capture Apply authority and not Ask / Catch Me Up authority.

Paint cache (`lume-mission-supabase-cache-v1`) must not outrank server truth. After a successful Apply write, never adopt pre-write state.

Use the **then-current** established canonical architecture. Do not freeze future features to today’s exact tables or helpers. The invariant is: use the established canonical path rather than inventing a parallel one.

A new surface is a view, workflow, or entry point into canonical truth **unless** an explicit architecture decision establishes a new canonical domain model. New UX must not automatically imply new storage.

If a requested item does not map safely to an existing canonical domain, use Review / Needs You / the then-current canonical creation workflow. Do not invent a feature-specific type merely because the click started in that feature.

---

## 3. Projection versus authority

| Surface | Role |
| --- | --- |
| Capture Review / Apply | Write path into canonical truth (Apply is the authoritative write) |
| Knowledge Centre buckets | Presentation over canonical records |
| Timeline | Read-only projection of dated canonical truth |
| Catch Me Up / Ask Lume | Read-only briefing / reasoning over server-loaded canonical truth |
| Meeting Catch Me Up | Meeting-scoped projection of stored project truth |
| Future Gantt / planning | Must derive from the same dated truth, or write through the canonical path |

**Timeline** must not grow a competing `timeline_item` store merely because the interaction began inside Timeline.

**Catch Me Up** must not become a brief-owned truth store. Stored `Meeting.prep` hydrates for compatibility only and must not drive Catch Me Up or Capture context.

Legacy writable Gantt is retired from intended UX (unmounted). Do not delete shared date infrastructure or stored rows until a later cleanup proves they are unused. See v0.9 handoff §3.3.

---

## 4. How writes may originate

| Origin | Required | Forbidden |
| --- | --- | --- |
| Natural-language Capture | AI extract → deterministic resolve → Review → Apply → canonical truth | AI writing tables directly |
| Structured UI (KC, Timeline Add, Confirm Owner, New Project compose) | Deterministic canonical write / domain contract | Routing a structured edit through AI “to be consistent” |
| Advise (when later built) | Normal Review / canonical write path | Advise-private truth |
| Any future surface | View / workflow / entry into canonical truth | Storage implied by new UX |

Ready means the same production Apply path can execute that reviewed change. Apply still revalidates at write time.

---

## 5. Tags

Tags are retrieval metadata only.

Invariant: if every tag were deleted, canonical project truth must be unchanged. Tags must not affect identity, resolution, dates, responsibilities, ownership, risk state, decisions, mutation planning, or Capture interpretation.

---

## 6. Review language is not domain identity

Review operations / states include **Create, Update, Remove, Needs You**.

Domain identity includes **Issue, Person, To Do, Knowledge** and other canonical kinds.

A Review card may combine them (`Create · To Do`). They remain different concepts.

---

## 7. Related integrity contracts (already closed)

Do not reopen these as architecture work. Details: [`docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`](./LUME_ADVERSARIAL_INTEGRITY_AUDIT.md).

- After a successful write, never adopt pre-write state (D-045).
- Analyse fingerprints the fields Apply writes (D-046).
- Capture session binds to the open project (D-047).
- Knowledge / availability / person / responsibility Apply writes use `capture_apply_receipts` (D-048).
