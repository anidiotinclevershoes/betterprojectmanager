/**
 * FROZEN before first production execution.
 * Seed: lume-longrun-v1-20260912-a3db
 *
 * Do not edit captures or expected semantics after seeing Lume's answers.
 * If an expectation later conflicts with an established product rule, flag
 * TEST_EXPECTATION — do not silently rewrite history.
 */
import type { CaptureSpec } from "./types";
import { LONGRUN_SEED, LONGRUN_SUITE_ID } from "./types";

export { LONGRUN_SEED, LONGRUN_SUITE_ID };

export const CAPTURES: CaptureSpec[] = [
  {
    n: 1,
    week: "W1 mobilisation",
    size: "single",
    classification: "safe",
    summary: "Induction time on mobilisation day",
    source:
      "James Okonkwo has confirmed site induction is 09:00 on mobilisation day.",
    expected: [
      { op: "create", domain: "knowledge", title: "site induction 09:00" },
    ],
    review: [],
  },
  {
    n: 2,
    week: "W1 mobilisation",
    size: "single",
    classification: "safe",
    summary: "Weekly dashboard to-do for Helen",
    source: "Add a to-do to send Helen Ward the weekly dashboard every Friday.",
    expected: [{ op: "create", domain: "todo", title: "weekly dashboard" }],
    review: [],
  },
  {
    n: 3,
    week: "W1 mobilisation",
    size: "single",
    classification: "safe",
    summary: "First PC date move",
    source: "Practical completion has moved to 18 December 2026.",
    expected: [
      {
        op: "update",
        domain: "milestone",
        title: "practical completion",
        ymd: "2026-12-18",
      },
    ],
    review: [],
    highRisk: true,
  },
  {
    n: 4,
    week: "W1 mobilisation",
    size: "mixed",
    classification: "safe",
    summary: "Nadia cafe FF&E + sample review date",
    source:
      "Nadia Rahman will own the cafe FF&E as well as the hall. The FF&E sample review is now 14 October 2026.",
    expected: [
      { op: "create", domain: "responsibility", title: "cafe FF&E" },
      { op: "update", domain: "todo", title: "FF&E sample review", ymd: "2026-10-14" },
    ],
    review: [],
  },
  {
    n: 5,
    week: "W1 mobilisation",
    size: "mixed",
    classification: "safe",
    summary: "Asbestos chase closed; timber-floor services risk",
    source:
      "The asbestos survey addendum came back clean. Close that chase. Raise a risk that the hall timber floor may still hide services.",
    expected: [
      { op: "complete", domain: "todo", title: "asbestos" },
      { op: "create", domain: "risk", title: "timber floor" },
    ],
    review: [],
    checkpoint: ["reload"],
  },
  {
    n: 6,
    week: "W1 mobilisation",
    size: "single",
    classification: "safe",
    summary: "Mei Chen is the QS — person update not a legal write",
    source: "Mei Chen is the quantity surveyor.",
    expected: [
      {
        op: "create",
        domain: "responsibility",
        title: "quantity survey",
        note: "Person update is not a legal Apply write. Name-only Mei already exists; a new responsibility or knowledge is the legal success. A person-field update should Needs You, not a duplicate Mei.",
      },
    ],
    review: [],
  },
  {
    n: 7,
    week: "W1 mobilisation",
    size: "mixed",
    classification: "safe",
    summary: "RAMS review create; exclude biscuits",
    source:
      "Book a RAMS review for the ceiling void on 8 October 2026. Also add a reminder to buy biscuits for the site cabin — that is not project truth.",
    expected: [
      { op: "create", domain: "todo", title: "RAMS review", ymd: "2026-10-08" },
      { op: "exclude_no_write", domain: "todo", title: "biscuits" },
    ],
    review: [{ kind: "exclude", match: "biscuit" }],
  },
  {
    n: 8,
    week: "W1 mobilisation",
    size: "single",
    classification: "safe",
    summary: "Tomos owns DDA ramp sign-off",
    source: "Tomos Ellis is responsible for the DDA ramp sign-off.",
    expected: [{ op: "create", domain: "responsibility", title: "DDA ramp" }],
    review: [],
  },
  {
    n: 9,
    week: "W2 design",
    size: "mixed",
    classification: "mixed_safe_ambiguous",
    summary: "She will own walk-through agenda (two women present)",
    source:
      "Helen Ward and Nadia Rahman were both in the cafe this morning. She will own the client walk-through agenda. The DDA access ramp detail is still outstanding.",
    expected: [
      {
        op: "needs_you",
        domain: "responsibility",
        title: "walk-through agenda",
        note: "Pronoun with two named women is genuine identity ambiguity.",
      },
      { op: "no_change", domain: "issue", title: "DDA access ramp" },
    ],
    review: [
      {
        kind: "needs_you_resolve",
        match: "walk-through agenda|She will own|agenda",
        resolve: "share",
        chooseName: "Helen Ward",
      },
    ],
  },
  {
    n: 10,
    week: "W2 design",
    size: "heavy",
    classification: "mixed_safe_ambiguous",
    summary: "Week-one email paste plus they-chair huddle",
    source: `From: James Okonkwo
Subject: first week on site

M&E first-fix starts 13 October 2026. Ceiling void RAMS is still needed before we open that void.

Helen Ward asked for a photo of the existing timber floor this week.

Cafe water isolate is booked for 10 October 2026.

They will chair the Thursday huddle — I did not catch who.

Working assumption still stands: the existing timber floor in the hall stays.`,
    expected: [
      { op: "create", domain: "milestone", title: "M&E first-fix", ymd: "2026-10-13" },
      { op: "create", domain: "todo", title: "timber floor photo" },
      { op: "create", domain: "milestone", title: "water isolate", ymd: "2026-10-10" },
      { op: "needs_you", domain: "responsibility", title: "huddle" },
      { op: "no_change", domain: "knowledge", title: "timber floor" },
    ],
    review: [],
    checkpoint: ["reload", "search"],
  },
  {
    n: 11,
    week: "W2 design",
    size: "single",
    classification: "safe",
    summary: "Chris joining — first name only",
    source: "Chris is joining next month as client comms.",
    expected: [
      {
        op: "create",
        domain: "person",
        title: "Chris",
        note: "Name-only Person is complete. Must not invent Chris Ward yet and must not bind to Helen Ward.",
      },
    ],
    review: [],
  },
  {
    n: 12,
    week: "W2 design",
    size: "mixed",
    classification: "ambiguous",
    summary: "Vague second-fix week — provide date if asked",
    source:
      "Can we put the M&E second-fix inspection in? I think it is the week of the 10th but I am not sure of the day.",
    expected: [
      {
        op: "needs_you",
        domain: "milestone",
        title: "M&E second-fix",
        note: "Missing required day. If Review offers a date field, that is a candidate edit.",
      },
    ],
    review: [{ kind: "edit_date", match: "second-fix|second fix", date: "2026-11-10" }],
    highRisk: true,
    checkpoint: ["reload"],
  },
  {
    n: 13,
    week: "W2 design",
    size: "single",
    classification: "safe",
    summary: "Saturday catch-up dated",
    source:
      "James said the site programme now includes a Saturday catch-up on 17 October 2026.",
    expected: [
      { op: "create", domain: "milestone", title: "Saturday catch-up", ymd: "2026-10-17" },
    ],
    review: [],
  },
  {
    n: 14,
    week: "W2 design",
    size: "single",
    classification: "safe",
    summary: "Timber floor is now a decision",
    source:
      "The existing timber floor in the hall stays — that is now a decision, not a working assumption.",
    expected: [{ op: "create", domain: "knowledge", title: "timber floor" }],
    review: [],
  },
  {
    n: 15,
    week: "W2 design",
    size: "mixed",
    classification: "mixed_safe_ambiguous",
    summary: "She wants the photo; RAMS still unapproved — exclude pronoun",
    source:
      "She wants the photo of the timber floor by Friday. The ceiling void RAMS is still not approved.",
    expected: [
      { op: "needs_you", domain: "todo", title: "photo" },
      { op: "update", domain: "risk", title: "RAMS" },
    ],
    review: [{ kind: "needs_you_exclude", match: "She wants|photo" }],
  },
  {
    n: 16,
    week: "W2 design",
    size: "mixed",
    classification: "safe",
    summary: "Two distinct snag lists",
    source:
      "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.",
    expected: [
      { op: "create", domain: "todo", title: "Cafe snag list" },
      { op: "create", domain: "todo", title: "Hall snag list" },
    ],
    review: [],
  },
  {
    n: 17,
    week: "W3 first-fix",
    size: "heavy",
    classification: "mixed_safe_ambiguous",
    summary: "Site WhatsApp dump",
    source: `WhatsApp — site chat

James: first-fix has started. Extra containment in the cafe ceiling. I will issue a delay notice.

Nadia: FF&E samples delayed to 16 October 2026.

Tomos: DDA ramp drawing received.

Mei: cost report Thursday.

Also someone mentioned buying more biscuits again.`,
    expected: [
      { op: "create", domain: "risk", title: "extra containment" },
      { op: "update", domain: "todo", title: "FF&E sample review", ymd: "2026-10-16" },
      { op: "create", domain: "knowledge", title: "DDA ramp drawing" },
      { op: "create", domain: "todo", title: "cost report" },
      { op: "exclude_no_write", domain: "todo", title: "biscuits" },
    ],
    review: [{ kind: "exclude", match: "biscuit" }],
  },
  {
    n: 18,
    week: "W3 first-fix",
    size: "mixed",
    classification: "safe",
    summary: "Resolve timber-floor risk; ceiling void risk stays",
    source:
      "The hall timber floor services risk is resolved — they opened a trial panel and it is clear. M&E first-fix coordination with the hall ceiling void remains open.",
    expected: [
      { op: "complete", domain: "risk", title: "timber floor" },
      { op: "no_change", domain: "risk", title: "M&E first-fix" },
    ],
    review: [],
    highRisk: true,
    checkpoint: ["reload"],
  },
  {
    n: 19,
    week: "W3 first-fix",
    size: "single",
    classification: "safe",
    summary: "Helen away dates",
    source: "Helen Ward is away 22–24 October 2026.",
    expected: [
      { op: "create", domain: "availability", title: "Helen Ward", ymd: "2026-10-22" },
    ],
    review: [],
  },
  {
    n: 20,
    week: "W3 first-fix",
    size: "mixed",
    classification: "mixed_safe_ambiguous",
    summary: "Mixed Review: date + exclude badges + they/RAMS + urn",
    source:
      "Move the client walk-through to 23 October 2026. Add a to-do to reprint the visitor badges. They still have not approved the RAMS. Also log that the cafe will need a temporary urn if the water isolate slips.",
    expected: [
      { op: "update", domain: "milestone", title: "walk-through", ymd: "2026-10-23" },
      { op: "exclude_no_write", domain: "todo", title: "visitor badges" },
      { op: "needs_you", domain: "risk", title: "RAMS" },
      { op: "create", domain: "knowledge", title: "temporary urn" },
    ],
    review: [
      { kind: "exclude", match: "badge" },
      { kind: "needs_you_exclude", match: "They still|RAMS" },
    ],
    checkpoint: ["reload", "nav"],
  },
  {
    n: 21,
    week: "W3 first-fix",
    size: "single",
    classification: "safe",
    summary: "PC restated — no change",
    source: "Practical completion is still 18 December 2026 — no change.",
    expected: [{ op: "no_change", domain: "milestone", title: "practical completion" }],
    review: [],
  },
  {
    n: 22,
    week: "W3 first-fix",
    size: "mixed",
    classification: "safe",
    summary: "Second walk-through; exclude tape then try re-include",
    source:
      "Book the second client walk-through for 6 November 2026. Add order more tape as a to-do.",
    expected: [
      { op: "create", domain: "milestone", title: "second walk-through", ymd: "2026-11-06" },
      {
        op: "exclude_no_write",
        domain: "todo",
        title: "tape",
        note: "Current Review has Exclude. Re-include is not a shipped control (D-025 remainder). Attempt it; do not invent a write if re-include is absent.",
      },
    ],
    review: [{ kind: "exclude_then_reinclude", match: "tape" }],
  },
  {
    n: 23,
    week: "W4 mid",
    size: "ambiguous",
    classification: "ambiguous",
    summary: "The snag list owned by James — two lists exist",
    source: "The snag list should be owned by James Okonkwo.",
    expected: [
      {
        op: "needs_you",
        domain: "responsibility",
        title: "snag list",
        note: "Cafe and Hall snag lists both exist. Do not reward guessing.",
      },
    ],
    review: [],
  },
  {
    n: 24,
    week: "W4 mid",
    size: "mixed",
    classification: "safe",
    summary: "Explicit split ownership of the two snag lists",
    source:
      "James Okonkwo owns the Hall snag list. Nadia Rahman owns the Cafe snag list.",
    expected: [
      { op: "create", domain: "responsibility", title: "Hall snag list" },
      { op: "create", domain: "responsibility", title: "Cafe snag list" },
    ],
    review: [],
  },
  {
    n: 25,
    week: "W4 mid",
    size: "mixed",
    classification: "safe",
    summary: "Mei owns monthly cost report",
    source:
      "Mei Chen is responsible for the monthly cost report. The Thursday cost report to-do can stay.",
    expected: [{ op: "create", domain: "responsibility", title: "cost report" }],
    review: [],
  },
  {
    n: 26,
    week: "W4 mid",
    size: "mixed",
    classification: "safe",
    summary: "Sample review done; banquettes lead-time issue",
    source:
      "The FF&E sample review happened on 16 October. Mark that done. Raise an issue that the cafe banquettes are twelve weeks lead time.",
    expected: [
      { op: "complete", domain: "todo", title: "FF&E sample review" },
      { op: "create", domain: "risk", title: "banquettes" },
    ],
    review: [],
  },
  {
    n: 27,
    week: "W4 mid",
    size: "mixed",
    classification: "mixed_safe_ambiguous",
    summary: "He will own client comms — Chris vs James",
    source:
      "Helen Ward and Chris were on the call. He will own client comms from November. The banquettes lead time stays a live issue.",
    expected: [
      { op: "needs_you", domain: "responsibility", title: "client comms" },
      { op: "no_change", domain: "risk", title: "banquettes" },
    ],
    review: [
      {
        kind: "needs_you_resolve",
        match: "client comms|He will own",
        resolve: "share",
        chooseName: "Chris",
      },
    ],
  },
  {
    n: 28,
    week: "W4 mid",
    size: "mixed",
    classification: "safe",
    summary: "Chris Ward full name — not Helen Ward",
    source:
      "Chris Ward starts 3 November 2026 as client communications lead. He is not the same person as Helen Ward.",
    expected: [
      { op: "create", domain: "person", title: "Chris Ward" },
      { op: "create", domain: "responsibility", title: "client communications" },
    ],
    review: [],
  },
  {
    n: 29,
    week: "W4 mid",
    size: "single",
    classification: "ambiguous",
    summary: "First-name-only Helen variation sign-off",
    source: "Helen can sign the variation for the extra containment.",
    expected: [
      {
        op: "needs_you",
        domain: "person",
        title: "Helen",
        note: "First-name-only restatement is intentional identity-safety (Pippa-class). Do not silently bind to Helen Ward.",
      },
    ],
    review: [],
  },
  {
    n: 30,
    week: "W4 mid",
    size: "heavy",
    classification: "mixed_safe_ambiguous",
    summary: "Mid-project email",
    source: `Round-up from Helen Ward

Practical completion is still 18 December 2026.
The extra containment is accepted.
James Okonkwo needs a new drawing for the cafe ceiling.
Tomos Ellis wants a DDA mock-up on 28 October 2026.
Nadia Rahman is travelling 29–30 October 2026.
Please update the programme.
Hall snag list has not started.
Mei Chen's cost report landed.`,
    expected: [
      { op: "no_change", domain: "milestone", title: "practical completion" },
      { op: "update", domain: "risk", title: "extra containment" },
      { op: "create", domain: "todo", title: "cafe ceiling drawing" },
      { op: "create", domain: "milestone", title: "DDA mock-up", ymd: "2026-10-28" },
      { op: "create", domain: "availability", title: "Nadia Rahman", ymd: "2026-10-29" },
      {
        op: "needs_you",
        domain: "milestone",
        title: "programme",
        note: "Update the programme is unscoped.",
      },
    ],
    review: [],
    checkpoint: ["reload"],
  },
  {
    n: 31,
    week: "W5 second-fix",
    size: "mixed",
    classification: "safe",
    summary: "Hall lighting scene plate — prefer Knowledge",
    source: "Remember that the hall lighting scene plate is a client-supplied item.",
    expected: [{ op: "create", domain: "knowledge", title: "lighting scene plate" }],
    review: [{ kind: "edit_entity_kind", match: "lighting scene|scene plate", entity: "knowledge" }],
  },
  {
    n: 32,
    week: "W5 second-fix",
    size: "single",
    classification: "ambiguous",
    summary: "Cancel Saturday catch-up — product-model gap",
    source: "Cancel the Saturday catch-up on 17 October 2026 — it is not happening.",
    expected: [
      {
        op: "product_model_gap_needs_you",
        domain: "milestone",
        title: "Saturday catch-up",
        note: "Milestone cancel/remove is not a legal write. Needs You is success. Deletion would be unexpected destruction.",
      },
    ],
    review: [],
  },
  {
    n: 33,
    week: "W5 second-fix",
    size: "single",
    classification: "safe",
    summary: "Third PC date move, many captures later",
    source: "Practical completion has slipped again, to 8 January 2027.",
    expected: [
      {
        op: "update",
        domain: "milestone",
        title: "practical completion",
        ymd: "2027-01-08",
      },
    ],
    review: [],
    highRisk: true,
    checkpoint: ["reload"],
  },
  {
    n: 34,
    week: "W5 second-fix",
    size: "mixed",
    classification: "safe",
    summary: "Jamie covers — name-only, not James",
    source:
      "James Okonkwo handed site programme to his deputy for the week of 10 November. Jamie will cover. I do not have Jamie's surname yet.",
    expected: [
      { op: "create", domain: "person", title: "Jamie" },
      {
        op: "needs_you",
        domain: "responsibility",
        title: "site programme",
        note: "Handing a named responsibility may be share/replace uncertain. A name-only Jamie create is independently safe.",
      },
    ],
    review: [],
  },
  {
    n: 35,
    week: "W5 second-fix",
    size: "mixed",
    classification: "safe",
    summary: "Exclude plant; apply second DDA visit",
    source:
      "Add a to-do to water the office plant. Also record that building control wants a second DDA visit on 11 November 2026.",
    expected: [
      { op: "exclude_no_write", domain: "todo", title: "plant" },
      { op: "create", domain: "milestone", title: "second DDA visit", ymd: "2026-11-11" },
    ],
    review: [{ kind: "exclude", match: "plant" }],
  },
  {
    n: 36,
    week: "W5 second-fix",
    size: "mixed",
    classification: "safe",
    summary: "DDA ramp signed off; mock-up still due",
    source:
      "The DDA access ramp detail is no longer outstanding — Tomos Ellis signed it off yesterday. Keep a knowledge note that the mock-up is still due 28 October 2026.",
    expected: [
      { op: "complete", domain: "issue", title: "DDA access ramp" },
      { op: "create", domain: "knowledge", title: "DDA mock-up" },
    ],
    review: [],
  },
  {
    n: 37,
    week: "W5 second-fix",
    size: "single",
    classification: "ambiguous",
    summary: "They said huddle chair rotates",
    source: "They said the huddle chair rotates weekly.",
    expected: [{ op: "needs_you", domain: "knowledge", title: "huddle chair" }],
    review: [],
  },
  {
    n: 38,
    week: "W5 second-fix",
    size: "mixed",
    classification: "mixed_safe_ambiguous",
    summary: "Mixed Review: dates + contradictory banquettes + Nadia lighting",
    source:
      "Move M&E second-fix inspection to 12 November 2026. Book a cafe power-on test for 14 November 2026. I think the banquettes risk is resolved but James still says it is blocked. Nadia Rahman is now also responsible for hall lighting scenes.",
    expected: [
      { op: "update", domain: "milestone", title: "M&E second-fix", ymd: "2026-11-12" },
      { op: "create", domain: "todo", title: "power-on", ymd: "2026-11-14" },
      {
        op: "needs_you",
        domain: "risk",
        title: "banquettes",
        note: "Contradictory resolved + blocked on the same record.",
      },
      { op: "create", domain: "responsibility", title: "hall lighting" },
    ],
    review: [{ kind: "needs_you_exclude", match: "banquette|resolved|blocked" }],
  },
  {
    n: 39,
    week: "W6 snag",
    size: "mixed",
    classification: "safe",
    summary: "Jamie Okoye is not James Okonkwo",
    source:
      "Jamie Okoye is the deputy site manager covering that week. He is not James Okonkwo.",
    expected: [
      { op: "create", domain: "person", title: "Jamie Okoye" },
      { op: "create", domain: "responsibility", title: "deputy site" },
    ],
    review: [],
  },
  {
    n: 40,
    week: "W6 snag",
    size: "heavy",
    classification: "mixed_safe_ambiguous",
    summary: "Snag start + retire asbestos knowledge",
    source: `Friday note

Hall snag list is now open.
Cafe snag list is still waiting on power-on.
Chris Ward issued the first comms note.
Helen Ward is back from leave.
Practical completion remains 8 January 2027.
Can we retire the asbestos knowledge now it is clean?
Reprint visitor badges if you like — not important.`,
    expected: [
      { op: "update", domain: "todo", title: "Hall snag list" },
      { op: "update", domain: "todo", title: "Cafe snag list" },
      { op: "no_change", domain: "milestone", title: "practical completion" },
      {
        op: "product_model_gap_needs_you",
        domain: "knowledge",
        title: "asbestos",
        note: "Knowledge retire/supersede is a product-model gap.",
      },
    ],
    review: [{ kind: "exclude", match: "badge" }],
    checkpoint: ["reload", "search"],
  },
  {
    n: 41,
    week: "W6 snag",
    size: "single",
    classification: "ambiguous",
    summary: "Someone needs to own fire-door certificates",
    source: "Someone needs to own the fire-door certificates.",
    expected: [{ op: "needs_you", domain: "responsibility", title: "fire-door" }],
    review: [{ kind: "needs_you_exclude", match: "Someone|fire-door" }],
  },
  {
    n: 42,
    week: "W6 snag",
    size: "mixed",
    classification: "ambiguous",
    summary: "Nadia replaces Helen on cafe FF&E only",
    source:
      "Nadia Rahman replaces Helen Ward on FF&E client decisions for the cafe only. Hall client decisions stay with Helen Ward.",
    expected: [
      {
        op: "needs_you",
        domain: "responsibility",
        title: "FF&E",
        note: "Share vs replace across two scopes is ownership-uncertain unless Review can localise cafe-only.",
      },
    ],
    review: [
      {
        kind: "needs_you_resolve",
        match: "FF&E|replaces",
        resolve: "share",
        chooseName: "Nadia Rahman",
      },
    ],
  },
  {
    n: 43,
    week: "W6 snag",
    size: "mixed",
    classification: "safe",
    summary: "Power-on passed; start cafe snag",
    source:
      "The cafe power-on test passed on 14 November. Close that. Start the Cafe snag list in earnest.",
    expected: [
      { op: "complete", domain: "todo", title: "power-on" },
      { op: "update", domain: "todo", title: "Cafe snag list" },
    ],
    review: [],
  },
  {
    n: 44,
    week: "W6 snag",
    size: "single",
    classification: "safe",
    summary: "Hall snag first pass — must not close cafe snag",
    source: "James completed the Hall snag list first pass.",
    expected: [{ op: "update", domain: "todo", title: "Hall snag list" }],
    review: [],
  },
  {
    n: 45,
    week: "W7 close",
    size: "mixed",
    classification: "safe",
    summary: "Leo Mensah name-only, late introduction",
    source: "Add Leo Mensah as the fire officer. Name only for now.",
    expected: [{ op: "create", domain: "person", title: "Leo Mensah" }],
    review: [],
  },
  {
    n: 46,
    week: "W7 close",
    size: "mixed",
    classification: "safe",
    summary: "Leo owns fire doors + dated reminder",
    source:
      "Leo Mensah will own fire-door certificates. He asked for a dated reminder on 21 November 2026.",
    expected: [
      { op: "create", domain: "responsibility", title: "fire-door" },
      { op: "create", domain: "todo", title: "fire-door", ymd: "2026-11-21" },
    ],
    review: [],
  },
  {
    n: 47,
    week: "W7 close",
    size: "heavy",
    classification: "safe",
    summary: "Year-end wrap + the Wards cabinet date",
    source: `Year-end wrap

Practical completion remains 8 January 2027.
Hall snag first pass is done.
Cafe snag is in progress.
Extra containment is complete.
DDA ramp is signed off.
Cafe banquettes are still twelve weeks lead time.
Chris Ward is doing weekly comms.
Jamie Okoye goes back to his own site after the week of 10 November.
The Wards will jointly present to cabinet on 4 December 2026.`,
    expected: [
      { op: "no_change", domain: "milestone", title: "practical completion" },
      { op: "complete", domain: "risk", title: "extra containment" },
      { op: "no_change", domain: "risk", title: "banquettes" },
      { op: "create", domain: "milestone", title: "cabinet", ymd: "2026-12-04" },
    ],
    review: [],
  },
  {
    n: 48,
    week: "W8 close",
    size: "single",
    classification: "safe",
    summary: "PC confirmed — must not duplicate",
    source: "Practical completion is confirmed for 8 January 2027. Do not move it again.",
    expected: [{ op: "no_change", domain: "milestone", title: "practical completion" }],
    review: [],
    highRisk: true,
    checkpoint: ["reload"],
  },
  {
    n: 49,
    week: "W8 close",
    size: "mixed",
    classification: "safe",
    summary: "PC glossary restated; Leo responsibility idempotent",
    source:
      "Search later: the term PC means practical completion. Add that Leo Mensah is responsible for fire-door certificates if not already recorded.",
    expected: [
      { op: "create", domain: "knowledge", title: "practical completion" },
      { op: "no_change", domain: "responsibility", title: "fire-door" },
    ],
    review: [],
    checkpoint: ["search", "nav"],
  },
  {
    n: 50,
    week: "W8 close",
    size: "heavy",
    classification: "mixed_safe_ambiguous",
    summary: "Close-out: new fact, cancel walk-through, cafe waiting, PC inspection",
    source: `Close-out note from Helen Ward

Defects liability runs 12 months from practical completion.

Cancel the client walk-through — it already happened.

Cafe snag list is now waiting on the banquette delivery.

Book the PC inspection with Tomos Ellis for 6 January 2027.`,
    expected: [
      { op: "create", domain: "knowledge", title: "defects liability" },
      {
        op: "product_model_gap_needs_you",
        domain: "milestone",
        title: "walk-through",
        note: "Milestone cancel is not a legal write.",
      },
      { op: "update", domain: "todo", title: "Cafe snag list" },
      { op: "create", domain: "milestone", title: "PC inspection", ymd: "2027-01-06" },
    ],
    review: [],
    checkpoint: ["reload", "restart"],
  },
];

export function captureByNumber(n: number): CaptureSpec {
  const found = CAPTURES.find((item) => item.n === n);
  if (!found) throw new Error(`No frozen capture ${n}`);
  return found;
}
