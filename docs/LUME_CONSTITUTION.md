# Lume constitution

**Status:** Durable product / architecture constitution  
**Date:** 12 September 2026  
**Docs entry:** [`docs/README.md`](./README.md)

This file owns Lume’s **high-order rules**. It is not an implementation map and not a living defect list.

| Kind of detail | Read instead |
| --- | --- |
| Product / trust / Ocean UI philosophy | [`docs/v1-reference-pack/`](./v1-reference-pack/) |
| Canonical write / projection contract | [`docs/LUME_CANONICAL_PROJECT_TRUTH.md`](./LUME_CANONICAL_PROJECT_TRUTH.md) |
| Existing-project compatibility / migrations | [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md) |
| Current Capture position | [`docs/LUME_CAPTURE_STATUS.md`](./LUME_CAPTURE_STATUS.md) |
| What shipped in v0.9 / leftovers / isolation evidence | [`docs/LUME_V09_TO_V1_HANDOFF.md`](./LUME_V09_TO_V1_HANDOFF.md) |
| Open vs resolved debt | [`docs/LUME_V1_KNOWN_DISCOVERIES.md`](./LUME_V1_KNOWN_DISCOVERIES.md) |
| What the code does now | current `main` |

If a historical handoff disagrees with this file, **this file wins** for durable rules. If this file and current code disagree on *implementation*, the code wins and this file should be updated.

---

## 1. What Lume is

Thesis:

> **You can't keep an entire project in your head. Lume can.**

Lume is an individual-first project-memory companion. It is not a portfolio tool, not a generic entity platform, and not an autonomous PM.

It should earn confidence that it knows the project, writes truth only after a safe path, helps the PM recover context, notices useful connections, and asks rather than guesses when meaning is materially unsafe.

---

## 2. Core V1 modes

Core product modes:

> **Capture · Knowledge Centre · Advise**

Knowledge Centre is organised around **All / Issues / People / To Do / Knowledge**. Those buckets are a presentation over canonical truth, not a second store.

**Catch Me Up** (project and meeting-scoped) is a **derived briefing surface**. It currently appears as a project-page tab. It reads maintained project truth and must not become a separate source of truth. **Timeline** is the same class: a projection, not an authority.

Advise remains visible as coming soon. Coach is hidden and is not a mode.

---

## 3. Two peer high-order invariants

These are equal. Neither outranks the other.

### Canonical Project Truth

Actions may start on any surface. They must create or update **canonical project truth** through the established architecture, then surfaces re-project that truth.

```text
UI action → canonical truth → projections refresh
```

Never:

```text
UI action → feature-specific truth store
```

Full contract: [`docs/LUME_CANONICAL_PROJECT_TRUTH.md`](./LUME_CANONICAL_PROJECT_TRUTH.md).

### Durable Project Truth

Once canonical project data has been persisted for a user:

> **That project truth is durable.**

Lume may evolve internally. Schema, contracts, APIs, UI and projections may change. Lume must still carry existing projects forward safely.

The rule is not “never change the schema.”  
The rule is **never strand the user’s project truth.**

Together:

> **Lume must write project truth correctly today and remain able to understand and preserve that truth tomorrow.**

Full contract: [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md).

---

## 4. Capture — AI interprets; Lume decides

Natural-language Capture:

```text
human language
  → AI extraction
  → deterministic Lume validation / resolution
  → Review
  → Apply
  → canonical project truth
  → authoritative reprojection
```

AI interprets messy language. **AI is not canonical authority.** AI does not write project truth.

Review stages candidate operations. Apply performs authoritative writes and still revalidates.

Structured UI actions should use deterministic canonical write paths. They should not go through AI unless semantic interpretation is actually required.

**Needs You** is for genuine unsafe ambiguity. Missing optional information does not automatically mean Needs You.

Current accepted position (534/538, Prompt A, product-model gaps): [`docs/LUME_CAPTURE_STATUS.md`](./LUME_CAPTURE_STATUS.md).

---

## 5. Review operation versus domain identity

These are different concepts. Do not conflate them.

| Review operation / state | Domain identity |
| --- | --- |
| Create | Issue |
| Update | Person |
| Remove | To Do |
| Needs You | Knowledge |
| | and other canonical kinds |

A card may read `Create · To Do`. That names an **operation** on a **domain**. Changing one does not change the other.

---

## 6. Tags are metadata

Tags assist search, filtering and retrieval.

They are **not** canonical project truth. If every tag were deleted, project truth must be unchanged.

---

## 7. New Project (current product rules)

Current implementation is one **compose-oriented** New Project experience (`sourceMode: "compose"`, four frames: Issues / People / To Do / Knowledge).

Verified current terms:

- identity is **Project name + Code**;
- **Organise notes** is paste-oriented help (`sourceMode: "paste"` on `/api/new-project`);
- People may be **name-only** (a name-only person is complete);
- responsibilities are **optional**; multiple responsibilities are supported;
- uncertain Organise results must not silently become canonical Issues / To Dos / Knowledge;
- create is one `create_project_bundle` transaction; partial create / retry must not falsely report success.

Talk/assemble and `NewProjectCategorisation` are leftovers, not the live path.

---

## 8. Engineering operating principles

- **Reuse first.** Extend the established architecture before adding a parallel path.
- **Deterministic behaviour** where practical. AI only where semantic interpretation is needed.
- **TDD / regression protection** at important boundaries (truth, persistence, identity, isolation, Capture Apply).
- **Safe incremental change.** Additive and reversible where practical.
- **Plain-English reporting** for the product owner (Roadmap §19).
- **One architectural spine.** No parallel truth stores.
- **One integration line:** `main`. Stop on a materially stale base (`npm run git:preflight`).
- **Experiments do not casually become production.** Unique production rules may be ported; experiment harnesses and corpora stay off `main` unless explicitly accepted.
- **Lead agent owns** integration, architectural consistency, tests and documentation.
- **New code is a last resort** when the established architecture can be extended safely.

Do not preserve superseded process rules merely because they appear in an old handoff. Current “do not start X” lists live in Known Discoveries and the task that names them.

---

## 9. Agent preflight — data-model / persistence changes

Before material work on schema, canonical entity shapes, domain semantics, persistence contracts, migrations, canonical readers or projection logic that can affect stored projects, answer:

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

If **#10 is YES or UNCERTAIN: STOP AND ESCALATE TO PRODUCT OWNER.**

Same questions are in [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md) and `.github/PULL_REQUEST_TEMPLATE.md`.

---

## 10. Destructive-change STOP rule

If a proposed change could destroy existing project truth, require project recreation, irreversibly reinterpret stored truth, orphan historical records, invalidate stable identities, break relationships, or make historical projects unreadable:

> **STOP. Do not autonomously implement the destructive path. Escalate to Product Owner review.**

A genuinely necessary destructive migration requires the evidence listed in the Durable Project Truth contract.
