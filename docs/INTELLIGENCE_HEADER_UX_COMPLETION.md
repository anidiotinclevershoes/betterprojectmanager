# Intelligence Header UX — Completion Report

## What changed

Refined the Lume intelligence strip so it communicates:

```text
CAPTURE + Lume learns  →  TELL ME   |   COACH (optional)
```

Not four equal sequential steps.

## Capture + Learn grouping

- **Capture** is the primary action card.
- **Lume learns as you work** is subordinate copy inside Capture.
- **View what Lume remembers** is a text link (not an equal mode button).
- Learn no longer looks like a peer workflow step.

## Learn → Knowledge

Clicking **View what Lume remembers**:

1. Closes Tell Me / Coach if open
2. Smooth-scrolls to `#project-knowledge`
3. Briefly pulses/highlights the Knowledge container
4. Does **not** call AI

If Knowledge is unavailable on the page, no AI is triggered (graceful no-op / toast event).

## Tell Me opens from its control

Tell Me is no longer a disconnected right-hand overlay.

When Tell Me is selected:

- Capture workspace is replaced by an **inline Tell Me workspace** under the strip
- Strip Tell Me control uses the knowledge accent and “owns” the surface below via shared border/top accent
- Closing Tell Me returns to Capture

## Coach separation

- Coach lives in the same horizontal strip after a **vertical hairline divider**
- Labelled **Optional**
- Opens the existing Coach drawer with coach accent continuity
- Removed duplicate **Lume Coach** button from the top header to avoid competing entry points

## Active-state accents

| Mode | Accent | Ownership |
|---|---|---|
| Capture | `--accent-capture` | Strip active + workspace top edge |
| Tell Me | `--accent-knowledge` | Strip active + Tell Me workspace |
| Coach | `--accent-coach` | Strip active + drawer edge |

## Scope labels

Tell Me shows real scope, e.g.:

- `ATLAS · Atlas Platform Modernisation`
- `Across your projects`

No more generic “Answering for the selected project”.

## Ask Lume

Primary submit control is now **Ask Lume** (clearer than weak “Ask”).

## Evidence bug fix

Unsupported / `not_found` answers no longer fall back to arbitrary context records.

- `pickSources(..., { confidence: "not_found" })` returns `[]`
- Local Finance “can’t find confirmation” returns **no sources**
- UI shows **No supporting project evidence found** when appropriate
- Related-context answers label sources as **Related context**

Regression coverage added in `npm run verify:tell-me`.

## Responsive behaviour

- Desktop/narrow: horizontal strip preserved; Coach copy compactifies on mid widths
- Mobile: horizontal scroll for the strip; hierarchy retained

## Tests run

```bash
npm run verify:tell-me
npm run verify:capture-context
npm run verify:phase2-auth
npm run verify:production-config
npm run build
```

## Screenshot index

See `docs/intelligence-header-ux/`:

1. `01-default-capture.png`
2. `02-capture-header-close.png`
3. `03-tell-me-active-full.png`
4. `04-tell-me-header-close.png`
5. `05-tell-me-answer.png`
6. `06-no-evidence.png`
7. `07-coach-active-full.png`
8. `08-coach-separation-close.png`
9. `09-learn-memory-link.png`
10. `10-knowledge-scroll-result.png`
11. `11-narrow-capture.png`
12. `12-narrow-tell-me.png`
13. `13-narrow-coach.png`
14. `14-mobile-header.png`
15. `15-mobile-tell-me.png`
16. `16-before-after-header.png` (current header reference crop)

## Architecture unchanged

No changes to Tell Me retrieval model strategy, Capture intelligence, Coach reasoning, auth, billing, or database schema.
