# Durable Project Truth

**Status:** Specialist architectural contract  
**Date:** 12 September 2026  
**Peer invariant:** [`docs/LUME_CANONICAL_PROJECT_TRUTH.md`](./LUME_CANONICAL_PROJECT_TRUTH.md)  
**Owned by:** [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) §3  
**Docs entry:** [`docs/README.md`](./README.md)

This file owns **existing-project compatibility**. It does not freeze today’s schema.

---

## 1. The invariant

Once canonical project data has been persisted for a user:

> **That project truth is durable.**

Lume may evolve aggressively internally. Schema, contracts, domain models, APIs, UI, projections and implementation may change.

Lume must carry existing projects forward safely.

The rule is **not**:

> Never change the schema.

The rule **is**:

> **Never strand the user’s project truth.**

Together with Canonical Project Truth:

> **Lume must write project truth correctly today and remain able to understand and preserve that truth tomorrow.**

Database backups are disaster recovery. They are **not** a substitute for backwards compatibility.

---

## 2. Existing-project compatibility

Future releases must either remain backwards-compatible **or** provide an explicit deterministic migration.

Normal product evolution must not:

- require users to recreate projects;
- require project deletion to access new functionality;
- delete canonical truth;
- silently reinterpret stored truth;
- unnecessarily regenerate stable entity IDs;
- break canonical relationships;
- make previously valid records unreadable;
- abandon historical records because a newer representation exists;
- silently discard history / audit information;
- turn uncertainty into certainty without an explicit deterministic rule;
- use “start again” as a migration strategy.

---

## 3. Safe evolution

Prefer additive / backwards-compatible evolution where practical:

- nullable / additive fields;
- additional relations;
- optional states;
- new projections;
- compatible adapters / readers;
- version-aware representations.

When additive compatibility is insufficient, use an **explicit deterministic migration**.

Migrations should preserve, wherever applicable:

- canonical meaning;
- stable identity;
- relationships;
- history / audit;
- uncertainty;
- user-created truth.

They should be deterministic, testable, and safely recoverable / resumable where practical.

Compatibility-only leftovers (for example stored `Meeting.prep`) may remain readable without becoming product contracts. Do not treat leftover columns as licence to delete user data.

---

## 4. Old-project regression contract

Material changes to schema, canonical entity shapes, domain semantics, persistence contracts, migrations, canonical readers or projection logic must consider projects persisted by earlier production versions.

Where historical data can be affected, require evidence equivalent to:

```text
old production project
  → upgrade / migration
  → old canonical truth intact
  → project remains readable
  → IDs preserved
  → relationships preserved
  → semantic meaning preserved
  → new capability works
```

Where practical, maintain versioned old-project fixtures.

Migration testing must verify **semantic preservation**, not merely successful SQL execution.

---

## 5. Destructive-change STOP rule

If a proposed change could:

- destroy existing project truth;
- require project recreation;
- irreversibly reinterpret stored truth;
- orphan historical records;
- invalidate stable identities;
- break relationships;
- make historical projects unreadable;

the agent must **STOP**.

Do not autonomously implement the destructive path. Escalate to Product Owner review.

Any genuinely necessary destructive migration requires explicit evidence covering:

- why additive evolution is insufficient;
- exact affected data;
- semantic transformation;
- migration method;
- failure behaviour;
- recovery / rollback;
- backup / recovery proof;
- historical-project validation;
- user impact.

---

## 6. Agent preflight (required)

Answer these before material schema / domain / persistence work:

1. What existing persisted project data could this affect?
2. Can this be additive / backwards-compatible?
3. If migration is required, is it deterministic?
4. Are stable IDs preserved?
5. Are relationships preserved?
6. Is history / audit preserved?
7. Is semantic meaning preserved?
8. Is uncertainty preserved correctly?
9. What old-project regression proves compatibility?
10. Could a real user lose data, need to recreate a project, or have truth silently reinterpreted?

If **#10 is YES or UNCERTAIN:**

> **STOP AND ESCALATE TO PRODUCT OWNER.**

The same list is in [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) §9, `AGENTS.md`, and `.github/PULL_REQUEST_TEMPLATE.md`.
