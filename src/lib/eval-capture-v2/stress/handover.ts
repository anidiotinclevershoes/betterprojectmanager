/**
 * Frozen mid-project PM handover for Harbourline Civic Archive Refresh.
 *
 * A new PM (not previously in the project) has inherited messy notes.
 * The mature seed is already durable before these Captures run.
 *
 * Three bands in one journey:
 *   A — clear current/new truth (should often Apply Ready)
 *   B — old / duplicate restatements (must not overwrite newer truth)
 *   C — genuine uncertainty (Needs you is healthy)
 *
 * Envelopes simulate a naive model. Production must resolve them.
 * Do not rewrite this file to make production pass.
 */

import { HCA_DATES, HCA_PEOPLE, HCA_TODOS } from "./harbourline";
import { hcaObs, hcaStep, type StressStep } from "./util";

export const HANDOVER_ID = "harbourline-handover-v1";

/** Messy catch-up dump kept as the human-readable frozen input. */
export const HANDOVER_NARRATIVE = `I started today as the new delivery PM. I wasn't in the original setup — I'm trying to figure out what the hell is going on from a pile of notes.

Confirmed current owner of the vendor contract is Daniel Okonkwo of Helix Imaging.
Confirmed new scanning deadline is 14 November 2026.
New stakeholder: Quinn Adler, scanning QA lead, joining Helix on site.
The analogue series list is definitely complete.
New risk: volunteer rota gaps in October could leave the reading room unstaffed.

From an old meeting note: Miriam Cole is still sponsor. Owen Hart is delivery lead.
Someone's notes still say the spec freeze is 2 October 2026, which I think is stale.
They mention the analogue series list as if it still needs doing.
There's a restated line about Helix Imaging already being the selected scan vendor.
An old ownership note says Priya Nair owns the vendor contract.

I think Sarah owns communications now? Not sure which Sarah.
Apparently CAB approved the embargo wording, but I haven't found the decision.
Robin from legal wanted something about FOI — first name only in the notes.
Two possible public launch dates floating around: 12 March 2027 or 9 April 2027.
Unclear whether Tomas Rezek still owns FOI or shares it with legal counsel.
A 12 May 2026 meeting note said the scan specification freeze was 1 September, which looks wrong now.
The mould in the wet-store may already have been resolved — the notes are contradictory.
I heard maybe Elena Voss is leaving? Don't write that down as fact.`;

export const HANDOVER_STEPS: StressStep[] = [
  hcaStep({
    id: "h1",
    difficulty: "easy",
    expectedReview: "apply",
    title: "A — new stakeholder Quinn Adler",
    transcript:
      "New stakeholder: Quinn Adler, scanning QA lead, joining Helix on site.",
    observations: [
      hcaObs({
        id: "h1-quinn",
        statement: "Quinn Adler is scanning QA lead joining Helix on site",
        domain: "person",
        disposition: "create_new",
        candidateTargetTitle: "Quinn Adler",
        proposedValues: { name: "Quinn Adler", role: "Scanning QA lead (Helix)" },
      }),
    ],
  }),
  hcaStep({
    id: "h2",
    difficulty: "easy",
    expectedReview: "apply",
    title: "A — confirmed scanning deadline",
    transcript: "Confirmed new scanning deadline is 14 November 2026.",
    observations: [
      hcaObs({
        id: "h2-scan",
        statement: "Scanning completion is 14 November 2026",
        domain: "milestone",
        disposition: "create_new",
        proposedValues: { label: "Scanning complete", startAt: "2026-11-14" },
      }),
    ],
  }),
  hcaStep({
    id: "h3",
    difficulty: "easy",
    expectedReview: "apply",
    title: "A — analogue series list complete",
    transcript: "The analogue series list is definitely complete.",
    bindTarget: { domain: "todo", titleIncludes: "analogue series" },
    observations: [
      hcaObs({
        id: "h3-series",
        statement: "Analogue series list is complete",
        domain: "todo",
        disposition: "update_existing",
        candidateTargetId: HCA_TODOS.series.id,
        candidateTargetTitle: HCA_TODOS.series.title,
        proposedValues: { done: true, status: "complete" },
      }),
    ],
  }),
  hcaStep({
    id: "h4",
    difficulty: "easy",
    expectedReview: "apply",
    title: "A — new volunteer rota risk",
    transcript:
      "New risk: volunteer rota gaps in October could leave the reading room unstaffed.",
    observations: [
      hcaObs({
        id: "h4-rota",
        statement: "Volunteer rota gaps in October could leave the reading room unstaffed",
        domain: "risk",
        disposition: "create_new",
        proposedValues: {
          title: "Volunteer rota gaps in October",
          severity: "medium",
          status: "open",
        },
      }),
    ],
  }),
  hcaStep({
    id: "h5",
    difficulty: "moderate",
    expectedReview: "no_change",
    title: "B — restated Miriam and Owen",
    transcript:
      "From an old meeting note: Miriam Cole is still sponsor. Owen Hart is delivery lead.",
    observations: [
      hcaObs({
        id: "h5-miriam",
        statement: "Miriam Cole is the sponsor",
        domain: "person",
        disposition: "create_new",
        candidateTargetTitle: "Miriam Cole",
        proposedValues: { name: "Miriam Cole", role: "Sponsor" },
      }),
      hcaObs({
        id: "h5-owen",
        statement: "Owen Hart is the delivery lead",
        domain: "person",
        disposition: "create_new",
        candidateTargetTitle: "Owen Hart",
        proposedValues: { name: "Owen Hart", role: "Delivery lead" },
      }),
    ],
  }),
  hcaStep({
    id: "h6",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "B — stale spec freeze date must not overwrite 9 Oct",
    transcript:
      "Someone's notes still say the spec freeze is 2 October 2026, which I think is stale.",
    bindTarget: { domain: "milestone", titleIncludes: "specification freeze" },
    observations: [
      hcaObs({
        id: "h6-stale",
        statement: "Specification freeze is 2 October 2026",
        evidence:
          "Someone's notes still say the spec freeze is 2 October 2026, which I think is stale.",
        domain: "milestone",
        disposition: "update_existing",
        candidateTargetId: HCA_DATES.specFreeze.id,
        candidateTargetTitle: "Scan specification freeze",
        proposedValues: { startAt: "2026-10-02" },
      }),
    ],
  }),
  hcaStep({
    id: "h7",
    difficulty: "moderate",
    expectedReview: "no_change",
    title: "B — completed series list restated as new work",
    transcript: "They mention the analogue series list as if it still needs doing.",
    observations: [
      hcaObs({
        id: "h7-series",
        statement: "Finish the analogue series list",
        domain: "todo",
        disposition: "create_new",
        proposedValues: { title: "Map analogue series list", done: false },
      }),
    ],
  }),
  hcaStep({
    id: "h8",
    difficulty: "moderate",
    expectedReview: "apply_or_no_change",
    title: "B — existing Helix vendor decision restated",
    transcript:
      "There's a restated line about Helix Imaging already being the selected scan vendor.",
    observations: [
      hcaObs({
        id: "h8-helix",
        statement: "Helix Imaging is the selected scan vendor",
        domain: "knowledge",
        disposition: "create_new",
      }),
    ],
  }),
  hcaStep({
    id: "h9",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "B — old Priya ownership vs current Daniel",
    transcript: "An old ownership note says Priya Nair owns the vendor contract.",
    observations: [
      hcaObs({
        id: "h9-priya",
        statement: "Priya Nair owns the vendor contract",
        evidence: "An old ownership note says Priya Nair owns the vendor contract.",
        domain: "responsibility",
        disposition: "update_existing",
        candidateTargetId: HCA_PEOPLE.priya.id,
        candidateTargetTitle: "Priya Nair",
        proposedValues: { scope: "vendor contract", ownershipSemantics: "replace" },
      }),
    ],
  }),
  hcaStep({
    id: "h10",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — first-name-only Sarah",
    transcript: "I think Sarah owns communications now? Not sure which Sarah.",
    observations: [
      hcaObs({
        id: "h10-sarah",
        statement: "Sarah may own communications",
        evidence: "I think Sarah owns communications now? Not sure which Sarah.",
        domain: "person",
        disposition: "ambiguous",
        proposedValues: { name: "Sarah", role: "Communications" },
      }),
    ],
  }),
  hcaStep({
    id: "h11",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — apparent CAB decision not found",
    transcript:
      "Apparently CAB approved the embargo wording, but I haven't found the decision.",
    observations: [
      hcaObs({
        id: "h11-cab",
        statement: "CAB approved the embargo wording",
        evidence:
          "Apparently CAB approved the embargo wording, but I haven't found the decision.",
        domain: "decision",
        disposition: "create_new",
        proposedValues: { text: "CAB approved the embargo wording." },
      }),
    ],
  }),
  hcaStep({
    id: "h12",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — first-name-only Robin",
    transcript:
      "Robin from legal wanted something about FOI — first name only in the notes.",
    observations: [
      hcaObs({
        id: "h12-robin",
        statement: "Robin from legal wanted something about FOI",
        evidence:
          "Robin from legal wanted something about FOI — first name only in the notes.",
        domain: "person",
        disposition: "ambiguous",
        proposedValues: { name: "Robin", role: "Legal" },
      }),
    ],
  }),
  hcaStep({
    id: "h13",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — two competing launch dates",
    transcript:
      "Two possible public launch dates floating around: 12 March 2027 or 9 April 2027.",
    bindTarget: { domain: "milestone", titleIncludes: "Public launch" },
    observations: [
      hcaObs({
        id: "h13-dates",
        statement: "Public launch might be 12 March 2027 or 9 April 2027",
        evidence:
          "Two possible public launch dates floating around: 12 March 2027 or 9 April 2027.",
        domain: "milestone",
        disposition: "update_existing",
        candidateTargetId: HCA_DATES.launch.id,
        candidateTargetTitle: "Public launch",
        proposedValues: { startAt: "2027-03-12" },
      }),
    ],
  }),
  hcaStep({
    id: "h14",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — unclear FOI share vs replace",
    transcript:
      "Unclear whether Tomas Rezek still owns FOI or shares it with legal counsel.",
    observations: [
      hcaObs({
        id: "h14-tomas",
        statement: "FOI ownership between Tomas Rezek and legal counsel is unclear",
        evidence:
          "Unclear whether Tomas Rezek still owns FOI or shares it with legal counsel.",
        domain: "responsibility",
        disposition: "ambiguous",
        candidateTargetId: HCA_PEOPLE.tomas.id,
        candidateTargetTitle: "Tomas Rezek",
        proposedValues: { ownershipSemantics: "ambiguous", scope: "FOI" },
      }),
    ],
  }),
  hcaStep({
    id: "h15",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — old meeting date marked wrong",
    transcript:
      "A 12 May 2026 meeting note said the scan specification freeze was 1 September, which looks wrong now.",
    bindTarget: { domain: "milestone", titleIncludes: "specification freeze" },
    observations: [
      hcaObs({
        id: "h15-old",
        statement: "Scan specification freeze was 1 September (from a 12 May 2026 meeting)",
        evidence:
          "A 12 May 2026 meeting note said the scan specification freeze was 1 September, which looks wrong now.",
        domain: "milestone",
        disposition: "update_existing",
        candidateTargetId: HCA_DATES.specFreeze.id,
        candidateTargetTitle: "Scan specification freeze",
        proposedValues: { startAt: "2026-09-01" },
      }),
    ],
  }),
  hcaStep({
    id: "h16",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — mould risk may already be resolved",
    transcript:
      "The mould in the wet-store may already have been resolved — the notes are contradictory.",
    bindTarget: { domain: "risk", titleIncludes: "Mould" },
    observations: [
      hcaObs({
        id: "h16-mould",
        statement: "The mould in the wet-store may already have been resolved",
        evidence:
          "The mould in the wet-store may already have been resolved — the notes are contradictory.",
        domain: "risk",
        disposition: "update_existing",
        candidateTargetTitle: "Mould in the wet-store",
        proposedValues: { status: "resolved" },
      }),
    ],
  }),
  hcaStep({
    id: "h17",
    difficulty: "hard",
    expectedReview: "needs_you",
    title: "C — hearsay Elena leaving",
    transcript: "I heard maybe Elena Voss is leaving? Don't write that down as fact.",
    observations: [
      hcaObs({
        id: "h17-elena",
        statement: "Elena Voss may be leaving",
        evidence: "I heard maybe Elena Voss is leaving? Don't write that down as fact.",
        domain: "person",
        disposition: "ambiguous",
        candidateTargetId: HCA_PEOPLE.elena.id,
        candidateTargetTitle: "Elena Voss",
        proposedValues: { notes: "Leaving" },
      }),
    ],
  }),
  hcaStep({
    id: "h18",
    difficulty: "easy",
    expectedReview: "apply",
    title: "A — confirmed Daniel owns vendor contract",
    transcript:
      "Confirmed current owner of the vendor contract is Daniel Okonkwo of Helix Imaging.",
    observations: [
      hcaObs({
        id: "h18-daniel",
        statement: "Daniel Okonkwo owns the Helix vendor contract",
        domain: "responsibility",
        disposition: "update_existing",
        candidateTargetId: HCA_PEOPLE.daniel.id,
        candidateTargetTitle: "Daniel Okonkwo",
        proposedValues: {
          scope: "Helix vendor contract",
          ownershipSemantics: "replace",
        },
      }),
    ],
  }),
];
