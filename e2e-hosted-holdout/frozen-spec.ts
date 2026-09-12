/**
 * FROZEN hosted holdout specification.
 *
 * Precommitted before the first hosted execution. Do not edit journey inputs
 * or expected outcomes to match a later Lume run. If product semantics are
 * later proven inconsistent with this file, document that explicitly first.
 *
 * Suite id: hosted-holdout-v1
 * Frozen against origin/main: 90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b
 */

export const HOLDOUT_SUITE_ID = "hosted-holdout-v1" as const;

export const HOLDOUT_FORBIDDEN_ORIGINAL_MARKERS = [
  "bob is the ba",
  "mike handles the legacy builds",
  "Olga Petrov",
  "Sarah Kim",
  "Production release",
  "CAB preparation",
  "Cutover runbook",
  "Andris is responsible for Legacy",
  "She will own UAT",
  "She will own the remaining UAT gaps",
  "catering is still undecided",
] as const;

export type HoldoutKind = "issues" | "create" | "update" | "identity" | "isolate" | "messy";

export type HoldoutJourneyId =
  | "H1_NEW_PROJECT_ISSUES_TODOS"
  | "H2_CAPTURE_CREATE_DATED_ACTION"
  | "H3_CAPTURE_ISO_DATE_UPDATE"
  | "H4_MULTI_PERSON_IDENTITY"
  | "H5_AMBIGUOUS_THEY_PLUS_SAFE"
  | "H6_MESSY_OPS_PASTE";

export type HoldoutJourneySpec = {
  id: HoldoutJourneyId;
  kind: HoldoutKind;
  title: string;
  coverage: string;
  world: string;
  input: string;
  seed?: {
    method: "organise" | "compose-ui";
    notes?: string;
    people?: string[];
    knowledge?: string[];
    issues?: string[];
  };
  expectedReview: string;
  expectedCanonicalTruth: string;
  expectedPostReloadUi: string;
  expectedNeedsYou: string;
};

export const HOLDOUT_JOURNEYS: readonly HoldoutJourneySpec[] = [
  {
    id: "H1_NEW_PROJECT_ISSUES_TODOS",
    kind: "issues",
    title: "New Project issues and dated todos",
    coverage:
      "New Project with a different information shape: issues + dated commitments + knowledge, and no people in the paste.",
    world: "Harbour repairs mobilisation",
    input: [
      "Harbour repairs mobilisation — notes from the housing ops huddle.",
      "The void inspection pack is incomplete and is blocking contractor start.",
      "We still owe housing a repairs inbox SLA.",
      "Book the mobilisation workshop for 8 October 2026.",
      "Contractor start is 14/10/2026.",
      "Working assumption: the DHP backlog stays with the in-house team until week 3.",
    ].join("\n"),
    seed: { method: "organise" },
    expectedReview:
      "Organise Review is the four-frame composer, not Capture Review. Issues/todos/knowledge titles from the notes must appear. People may be empty. Missing people is not Needs You.",
    expectedCanonicalTruth:
      "Create writes Harbour issues (void inspection pack blocking start; repairs inbox SLA), dated commitments for mobilisation workshop = 2026-10-08 and contractor start = 2026-10-14, and DHP backlog knowledge. No required people rows.",
    expectedPostReloadUi:
      "After Create and hard reload, Knowledge Centre still shows the void inspection / inbox SLA language, DHP backlog, mobilisation workshop, contractor start, and both calendar days (8 Oct and 14 Oct 2026, including compact paint).",
    expectedNeedsYou:
      "None required. Empty People is valid. Needs You is only acceptable for a genuinely unsafe ambiguity in these notes, not for missing optional people or optional responsibilities.",
  },
  {
    id: "H2_CAPTURE_CREATE_DATED_ACTION",
    kind: "create",
    title: "Capture create dated action",
    coverage:
      "Capture Create of a new dated action that does not already exist. Not an update of an existing milestone and not the original Production-release date case.",
    world: "Harbour repairs mobilisation",
    input:
      "Can we put a reminder in? I need the void keys collected from the depot by Friday 16 October 2026. Repairs policy v3 is still the current working version.",
    seed: {
      method: "compose-ui",
      people: ["Priya Nair"],
      knowledge: ["Repairs policy v3 is the current working version"],
    },
    expectedReview:
      "A create-family card for collecting void keys from the depot dated 2026-10-16. Policy v3 is already-known: no-op, commentary, or same-fact update is fine. Must not invent a second Priya or treat 'I' as a new person.",
    expectedCanonicalTruth:
      "Apply writes one new dated action/milestone for depot void-key collection on 2026-10-16. Policy v3 remains the existing knowledge row. Priya Nair unchanged.",
    expectedPostReloadUi:
      "Hard reload still shows Priya Nair, repairs policy v3, void keys / depot collection, and 16 Oct 2026. No duplicate policy fact required.",
    expectedNeedsYou:
      "Not required for this create. First-person 'I' is the capturing PM, not an identity gap.",
  },
  {
    id: "H3_CAPTURE_ISO_DATE_UPDATE",
    kind: "update",
    title: "Capture ISO date update",
    coverage:
      "Capture Update with different wording, ISO date representation, and a workshop entity rather than Production release.",
    world: "Harbour repairs mobilisation",
    input: [
      "FYI — the mobilisation workshop has slipped.",
      "New date is 2026-10-22.",
      "Priya Nair still owns contractor liaison; no change there.",
    ].join("\n"),
    seed: {
      method: "organise",
      notes: [
        "The mobilisation workshop is on 8 October 2026.",
        "Priya Nair owns contractor liaison.",
      ].join("\n"),
    },
    expectedReview:
      "Update (preferred) or independently actionable create for mobilisation workshop now 2026-10-22. Priya / contractor liaison must not become a conflicting rewrite and must not steal the workshop identity.",
    expectedCanonicalTruth:
      "Apply stores mobilisation workshop on 2026-10-22. Priya Nair remains responsible for contractor liaison. The previous 8 October date is no longer the current workshop commitment.",
    expectedPostReloadUi:
      "Dates / Knowledge after hard reload represents 22 Oct 2026 with mobilisation workshop. It must not still present 8 October 2026 as the current workshop date. Priya Nair remains visible.",
    expectedNeedsYou:
      "Not required for the slipped workshop date. A Priya card may be absent or no-op; Needs You is not required merely because the paste restates an existing responsibility.",
  },
  {
    id: "H4_MULTI_PERSON_IDENTITY",
    kind: "identity",
    title: "Multi-person identity isolation",
    coverage:
      "Several named people plus a new joiner in one Capture. Challenges identity leakage and transcript contamination.",
    world: "Harbour repairs mobilisation",
    input: [
      "Stand-up: Tomos said Priya would pick up the DHP queries this week.",
      "Jess is covering resident letters.",
      "Kwame Boateng is joining as the contractor lead for Harbour.",
    ].join("\n"),
    seed: {
      method: "organise",
      notes: [
        "Priya Nair owns contractor liaison.",
        "Tomos Reed owns voids.",
        "Jess Hale owns resident comms.",
      ].join("\n"),
    },
    expectedReview:
      "Kwame Boateng appears as create or Needs You (first and last name; create is preferred, Needs You is acceptable). DHP queries, if written, attach to Priya, not Tomos. Jess covering resident letters may be update or no-op. No existing person card may absorb Kwame's contractor-lead statement.",
    expectedCanonicalTruth:
      "If Kwame is Apply-ready and applied, canonical people include Kwame Boateng as contractor lead. If Kwame stays Needs You, he is not written. Priya may gain DHP queries. Tomos must not become DHP owner or contractor lead from this paste. Jess must not become Kwame.",
    expectedPostReloadUi:
      "Priya Nair, Tomos Reed, and Jess Hale still present. Kwame present only if his card was Apply-ready and applied. No person list row that mixes Kwame's contractor-lead text onto Priya, Tomos, or Jess.",
    expectedNeedsYou:
      "Acceptable for Kwame if first-name/full-name confirmation is required. Acceptable for DHP if Lume will not safely attribute 'Tomos said Priya would…'. Not acceptable to silently assign Kwame's role to an existing person.",
  },
  {
    id: "H5_AMBIGUOUS_THEY_PLUS_SAFE",
    kind: "isolate",
    title: "Ambiguous they plus safe date",
    coverage:
      "One genuinely ambiguous observation plus one independently safe dated create. Different pronoun/date pairing from the original She/UAT + Production release case.",
    world: "Harbour repairs mobilisation",
    input: [
      "After the call with Elena Voss and Tomos Reed, they agreed one of them will chair the weekly mobilisation huddle. I could not hear who.",
      "Separately: collect the void keys from the depot on 16 October 2026.",
    ].join("\n"),
    seed: {
      method: "compose-ui",
      people: ["Elena Voss", "Tomos Reed"],
    },
    expectedReview:
      "Chair of the weekly mobilisation huddle stays Needs You. Depot void-key collection on 2026-10-16 is independently actionable create (todo or milestone). The safe sibling must not be blocked by the huddle ambiguity.",
    expectedCanonicalTruth:
      "Apply writes the 2026-10-16 depot void-key collection. It must not write Elena or Tomos as huddle chair. Existing people remain Elena Voss and Tomos Reed.",
    expectedPostReloadUi:
      "Hard reload shows 16 Oct 2026 and void keys / depot collection. Must not show Elena or Tomos as chair of the weekly mobilisation huddle from this Capture.",
    expectedNeedsYou:
      "Required for who chairs the weekly mobilisation huddle. Not required for the depot key date.",
  },
  {
    id: "H6_MESSY_OPS_PASTE",
    kind: "messy",
    title: "Messy ops paste",
    coverage:
      "Realistic messy paste: email/WhatsApp order, UK and ISO dates, speculation, and irrelevant context. Substantially different from the original Thursday stand-up mixed journey.",
    world: "Harbour repairs mobilisation",
    input: [
      "From: housing ops",
      "Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
      "",
      "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
      "",
      "Parking: the office plants need watering; not a control.",
      "",
      "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
      "",
      "Kwame Boateng is the contractor lead for Harbour.",
      "",
      "Void keys still need collecting from the depot on 16 Oct 2026.",
      "",
      "Elena said the repairs policy v3 remains current.",
    ].join("\n"),
    seed: {
      method: "organise",
      notes: [
        "The mobilisation workshop is on 8 October 2026.",
        "Priya Nair owns contractor liaison.",
        "Tomos Reed owns voids.",
        "Elena Voss owns resident liaison.",
        "Repairs policy v3 is the current working version.",
      ].join("\n"),
    },
    expectedReview:
      "Workshop date 2026-10-22 is Apply-ready update/create. Void keys 2026-10-16 is Apply-ready create if not already present. Kwame Boateng present as create or Needs You. Policy v3 already-known. Biscuits / office plants must not become Review truth. Priya/DHP speculation stays Needs You or is omitted; it must not write a guessed DHP owner.",
    expectedCanonicalTruth:
      "Applied truth may include mobilisation workshop 2026-10-22, depot void-key collection 2026-10-16, and Kwame only if Apply-ready. Must not store office plants, biscuit rotas, or a speculative Priya-owns-DHP fact.",
    expectedPostReloadUi:
      "Hard reload shows workshop on 22 Oct 2026 and any applied void-key date. Must not show office plants, biscuits, or 'Priya might take DHP' as maintained knowledge. Existing Priya / Tomos / Elena remain.",
    expectedNeedsYou:
      "Required or omitted-without-write for speculative DHP ownership. Acceptable for Kwame. Not required for the clear workshop move or the clear depot date.",
  },
] as const;

export function holdoutJourney(id: HoldoutJourneyId): HoldoutJourneySpec {
  const found = HOLDOUT_JOURNEYS.find((journey) => journey.id === id);
  if (!found) throw new Error(`Unknown holdout journey ${id}`);
  return found;
}
