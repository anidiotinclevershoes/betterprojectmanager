# Magic Patterns retrieval log

**Date:** 26 August 2026  
**Rule followed:** do not fabricate live MP state; do not silently alter designs during retrieval.

## Result

**Latest live Magic Patterns V1 work was not retrieved.**

The Magic Patterns MCP is authenticated enough to list **design systems** and to operate on a design **if an `editorId` is already known**. It cannot enumerate the user’s designs. No editor URL, canvas URL, inspiration id, or published `*.magicpatterns.app` slug exists in this repository, GitHub PRs/issues, or the frozen-branch docs.

Until a product owner supplies those identifiers, this pack treats live MP as **unretrieved**, not as “there is no newer design”.

## What was successfully retrieved (reviewable, versioned)

These are **in-repo** design artefacts. They are not a live MP export.

| Artefact | Date | What it is | Authority |
| --- | --- | --- | --- |
| `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` | 19 Aug 2026 (commit `7a9094a`, GitHub web upload) | High-fidelity Knowledge Centre mockup: Meridian Cloud Platform, Ocean palette, Capture / Knowledge Centre / Advise Coming soon, Search vs Ask Lume, three primary frames | Canonical **visual parent** in the V1 constitution |
| `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.md` | 19 Aug 2026 | Written UI contract that accompanies the PNG | Canonical **interaction** parent for V1 screens |
| `docs/v1-reference-pack/LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md` | 19 Aug 2026 | Product constitution (Capture / KC / Advise, trust states, review-before-write) | Product intent — not a screen inventory |
| `docs/current-state/*.png` | 11 Aug 2026 | Pre-Ocean / pre-Supabase product screenshots | **Historical only** |
| `docs/intelligence-header-ux/*.png` | later header/Tell Me pass | Product screenshots of Capture / Tell Me / Coach chrome | **Historical / seam-specific**, not V1 visual parent |
| `docs/tell-me-v1/*.png` | Tell Me V1 | Product screenshots | **Historical / seam-specific** |

No Magic Patterns source files (`App.tsx` prototype export, `canvas.manifest.js`, editor ids) are in the repo.

## Tooling attempts (do not invent a list)

| Attempt | Outcome |
| --- | --- |
| Magic Patterns MCP `list_design_systems` | Connected. Only reserved systems (Base, Wireframe, Shadcn, MUI, Mantine, Chakra). No custom Lume system. |
| Magic Patterns MCP list-designs | **No such tool.** MCP and v3 API are editor-id scoped. |
| `get_editor_id_from_url` on guessed `/c/lume` | Parser returns a string; `get_design_status("lume")` → `Room not found`. Not a real design. |
| Playwright → `magicpatterns.com/settings` | Redirects to **login**. Browser session is not the MCP account. |
| `GET https://www.api.magicpatterns.com/api/v3/designs` | No list endpoint (`Cannot GET /api/v3/designs`). Health requires `x-mp-api-key` (401). |
| Repo / PR / issue search for `magicpatterns.com` | **Zero hits** across listed PRs. |
| GitHub code search in this owner | No `magicpatterns` matches. |
| Prior cloud-agent list | No agent named as an MP design session with a stored editor URL in this environment’s agent index. |
| Prior “Lume V1 architectural convergence” transcript | No MP URLs. Programme text treats live MP as an **external, unmanaged** dependency. |
| Sibling “Find MP artefacts” search | Same conclusion: zero hosted MP ids; in-repo authority is the Ocean PNG + live Ocean implementation. |

## Access that is missing

To retrieve the latest approved MP V1 work, this workstream needs **one** of:

1. Magic Patterns editor URL(s) (`https://www.magicpatterns.com/c/<id>`), canvas URL (`/s/<canvasId>`), inspiration URL, or published project slug; **or**
2. A Magic Patterns MCP/API capability to **list designs owned by the authenticated account**; **or**
3. An exported zip / “Copy Code as Prompt” dump committed or attached by the product owner.

Without that, a design-to-product mapping against “latest MP” would be fabricated.

## How in-repo artefacts are used below

- The Ocean PNG + UI baseline are used as the **last versioned visual constitution in git**, with the caveat that a newer live MP design **may exist and was not seen**.
- Historical 11 Aug screenshots are **not** treated as the V1 target.
- Desert is **not** in the 19 Aug PNG (Desert landed 25 Aug as an additive token theme). That is a known constitution vs programme delta, flagged for the product owner — not silently resolved.

## Do not treat as latest MP

- Training-data memory of older Lume mockups.
- `docs/current-state/` Overview / pre-Ocean Capture.
- Any screen invented to “complete” a missing MP inventory.
