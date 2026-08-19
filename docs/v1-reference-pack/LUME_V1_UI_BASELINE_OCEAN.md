# Lume V1 UI Baseline — Ocean

**Status:** Canonical visual/interaction reference  
**Date:** 19 August 2026  
**Visual source:** `LUME_V1_UI_BASELINE_OCEAN.png`

The approved Knowledge Centre mockup is the **visual parent** for the rest of V1.

Rule:

> **Image leads; requirements constrain.**

Other screens should inherit this visual language and apply functional deltas. Do not use broad product briefs as permission to redesign the interface independently.

---

## 1. Visual language to preserve

Preserve the approved baseline's:

- dark Ocean palette;
- deep navy/blue-black surfaces;
- restrained purple/blue intelligence accents;
- thin borders;
- compact sidebar proportions;
- modern SaaS typography and scale;
- card geometry/radii;
- overall density;
- three-column project-frame language;
- restrained use of colour;
- clean Search / Ask distinction;
- serious working-tool feel rather than sci-fi/AI-poster styling.

Avoid excessive glow, giant empty states, repeated slogans, badge storms and explanatory panels.

---

## 2. Brand / wordmark

The final Lume brand direction is **text-heavy/text-only**.

- No image/icon as the primary logo.
- Explore a modern `lume` wordmark.
- The embedded `me` may be subtly heavier/brighter/accented, but the treatment must remain restrained rather than gimmicky.
- Decorative logo symbols visible in older mockups are not locked product requirements.

---

## 3. Dark mode and themes

- V1 is dark mode only.
- **Ocean** is the required/default visual theme and the only theme that must ship.
- Forest, Laser and Desset may exist only if they are genuinely trivial colour-token swaps with negligible QA/maintenance burden.
- Alternative themes must not alter component layout or behaviour and must not delay core work.

---

## 4. Sidebar

Normal-user sidebar should contain:

### Projects

- all projects visible;
- selected project clearly indicated;
- a lightweight `+ New Project` control, with small green `New Project` text beside the plus.

### Cross-project utility

- Master To Do;
- History;
- Captures.

### Lower utilities

- Account/profile;
- Settings;
- Help/support where appropriate.

Do **not** include:

- Overview;
- Knowledge Centre;
- Capture;
- Advise;
- Coaching;
- visible Evals;
- project-health coloured dots.

Capture/Knowledge Centre/Advise are modes in the selected project, not sidebar destinations.

---

## 5. Selected-project header and intelligence strip

A selected project should show:

- project name;
- concise project identity/context as appropriate;
- compact intelligence/status information such as `I know X things`, `I see X risks`, `I see X dependencies`, and freshness.

Do not show undefined progress percentages or generic portfolio KPI boxes.

### Top-right controls

`✦ Refresh`

- must be a clear button;
- includes the established AI/sparkle icon;
- signals an AI invocation.

AI allowance:

- shown separately in a framed/pill-like non-button element;
- e.g. `36 actions left`;
- never raw token counts;
- must not visually compete with Refresh.

---

## 6. Mode selector

Use a prominent segmented/button-like selector in the project workspace:

- **Capture** — include the established blue AI icon;
- **Knowledge Centre** — clearly selectable/selected when active;
- **Advise — Coming soon** — disabled/subdued.

Capture and Knowledge Centre must look unmistakably interactive, not like passive labels.

Selecting Capture or Knowledge Centre expands that frame across the content width and pushes the ordinary project frames down.

The expanded frame must have a clear minimise/collapse control.

Advise has no active V1 screen beyond Coming Soon.

---

## 7. Knowledge Centre top area

Preserve the strong distinction between:

### Search Knowledge

- deterministic;
- no AI icon;
- immediate stored-state lookup.

### ✦ Ask Lume

- AI action;
- includes the AI/sparkle glyph.

Avoid explanatory text clutter between Search and suggested questions.

### Suggested questions

- deterministic from project state;
- visually quiet;
- text-link/subtle treatment rather than heavy CTA buttons;
- should not dominate the frame.

---

## 8. Default project frames

The current viewport should show approximately **three larger/deeper frames**, not six cramped equal boxes.

Current preferred initial trio:

- Current position;
- Risks & blockers;
- To Do.

The frames should be roughly twice the earlier cramped height so more information can be read comfortably.

Additional frames continue **below the fold** and are revealed by ordinary scrolling.

There is **no** `More project knowledge` card, button, accordion or expandable row.

Secondary frames may include:

- Decisions;
- Dependencies;
- Important dates/Timeline;
- People & context;
- Waiting & open loops;
- Meeting Prep if stable;
- other useful existing project frames.

---

## 9. Frame header colour system

Frame headers should retain strong semantic colour identity without decorative icons.

Preferred mapping:

- Current position — purple;
- To Do — blue;
- Risks & blockers — red/coral;
- Dependencies — cyan/teal;
- Important dates/Timeline — gold/amber;
- People & context — green/teal;
- Decisions — neutral/slate/grey;
- Waiting & open loops — orange/amber.

Remove decorative frame-header icons. Titles and colour are enough.

---

## 10. Item/card treatment

Each item inside a frame should feel selectable without becoming a heavy floating tile.

Use:

- subtle border;
- slightly differentiated dark surface;
- modest internal padding;
- comfortable spacing between items.

Long titles should wrap naturally to two or more lines.

Do **not** use ellipsis/truncation merely to force a one-line layout.

The card should simply grow vertically.

---

## 11. Dates and priority

### Dates

Use explicit, consistent labels.

Examples:

- `Due 16 Aug`
- `Due tomorrow`
- `CAB · 21 Aug`
- `Away 1–12 Sep`

Do not mix unlabeled date formats for equivalent concepts.

Do not call a non-due date `Due`.

### Priority

Use dots only:

- red = high;
- amber = medium;
- green = low;
- grey = no explicitly identified priority.

Do not also show `High`, `Medium`, `Low` text on ordinary Knowledge items.

---

## 12. Selectable Knowledge details

Any meaningful Knowledge item may open a richer detail state/drawer/expansion.

Potential contextual information includes:

- full content;
- source Capture/history;
- provenance/evidence;
- current vs previous value;
- assumptions Lume is making;
- epistemic state where meaningful;
- related people;
- responsibilities;
- availability;
- dependencies;
- linked risk/To Do;
- relevant change history;
- correction actions.

Only show what is relevant to the item.

Default Knowledge should remain calm; depth appears on selection.

---

## 13. People & context

Use selectable rich person/relationship cards rather than generic RACI tiles.

Examples:

- `@Ava Chen · UX design sign-off`
- `Away 1–12 Sep`
- `Research summary outstanding`

- `@Priya Shah · CAB pack`

- `Security sign-off · Owner not confirmed · Confirm owner`

A person detail state may reveal roles, scoped responsibilities, authority, availability, commitments, relevant captures/evidence and connected risks/dependencies.

---

## 14. Needs you / ✦ Lume noticed

These are allowed to use stronger attention treatment near the top because they represent genuinely important intelligence states.

### Needs you

Use for:

- ambiguity;
- contradiction;
- missing owner/authority;
- information Lume cannot safely resolve.

Provide a direct resolution action.

### ✦ Lume noticed

Use selectively for supported inferences/connections.

Provide actions such as:

- Add as risk;
- Add To Do;
- Ignore/dismiss.

Do not turn the page into an AI-alert inbox.

---

## 15. Confidence treatment

High/Medium/Low AI confidence is primarily a **Capture review** concept.

After user approval, normal Knowledge should not retain permanent model-confidence badges.

Knowledge may still show meaningful states such as:

- Informal;
- Unconfirmed;
- Conflicting;
- Needs you;
- Lume noticed.

Confirmed knowledge should look like normal knowledge.

---

## 16. Capture screens derived from this baseline

Future Capture designs should preserve this same Ocean shell and typography rather than inventing a separate visual style.

Required functional states include:

1. Capture empty/pre-capture;
2. recording/live transcription;
3. transcript complete, pre-analysis;
4. `✦ Analyse`;
5. post-analysis full review;
6. ambiguity/Needs you clarification;
7. final reviewed submission.

Every extracted item must be visible in the review before final submission.

Confidence belongs here, not permanently in Knowledge.

---

## 17. New Project derived state

New Project should inherit the same shell, field/card language and dark Ocean theme.

AI-assisted project creation should visibly use the AI glyph for AI actions and should include a review stage before the resulting project truth is committed.

Do not create a visually unrelated onboarding product.

---

## 18. Visual anti-patterns

Do not reintroduce:

- Overview/portfolio dashboard;
- visible Evals;
- Coaching;
- project health dots in sidebar;
- Progress percentage;
- generic KPI-box row duplicating the intelligence strip;
- six equally dominant knowledge frames in one viewport;
- `More project knowledge` accordion/button;
- decorative frame-header icons;
- permanent confidence badges on approved knowledge;
- inconsistent date treatments;
- priority words plus priority dots;
- suggested-question button clutter;
- raw token displays;
- image-based logo;
- light mode;
- giant trust slogans/explanatory copy;
- visual redesign in response to narrow functional edits.

---

## 19. Cursor UI rule

When implementing from this baseline:

> **Preserve the visual parent unless a functional requirement explicitly requires a change.**

For narrow edits, Cursor should state what it will change and what it will not change before implementation.

It must not resurrect UI concepts removed in previous iterations simply because they exist elsewhere in the codebase or older mockups.
