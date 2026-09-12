/** Frozen New Project starting world — Riverside Civic Hall Fit-Out. */

export const NP_WORKING_TITLE = "Riverside Civic Hall Fit-Out";

export const NEW_PROJECT_NOTES = `Riverside Civic Hall Fit-Out — notes from the mobilisation huddle.

Helen Ward is the client project manager and is responsible for client decisions.
James Okonkwo is the principal contractor and is responsible for the site programme.
Nadia Rahman is the interior designer and is responsible for FF&E specification.
Tomos Ellis covers building control.
Mei Chen is on the team.

Open issues:
The DDA access ramp detail is still outstanding and is blocking building control.
M&E first-fix coordination with the hall ceiling void is a risk.

To dos:
Issue the RIBA Stage 4 drawing pack to James.
Book the FF&E sample review with Nadia.
Chase the asbestos survey addendum.

Dates:
Site mobilisation is 6 October 2026.
Client walk-through is 20 October 2026.
Practical completion is targeted for 12 December 2026.

Knowledge:
FF&E means furniture, fixtures and equipment.
PC in this project means practical completion, not a personal computer.
The hall and the cafe are separate workfaces and must not share snag lists.
Working assumption: the existing timber floor in the hall stays.
RAMS must be approved before any ceiling void work.`;

export const STATE0_MUST_INCLUDE = {
  people: ["Helen Ward", "James Okonkwo", "Nadia Rahman", "Tomos Ellis", "Mei Chen"],
  nameOnlyOk: ["Mei Chen"],
  issuesOrRisks: ["DDA access ramp", "M&E first-fix"],
  todos: ["RIBA Stage 4", "FF&E sample review", "asbestos"],
  dates: [
    { ymd: "2026-10-06", label: "mobilisation" },
    { ymd: "2026-10-20", label: "walk-through" },
    { ymd: "2026-12-12", label: "practical completion" },
  ],
  knowledge: ["FF&E", "practical completion", "snag", "timber floor", "RAMS"],
};

/** Markers from the original 6+6 hosted suites — must not appear in this story. */
export const FORBIDDEN_SUITE_MARKERS = [
  "Olga Petrov",
  "Sarah Kim",
  "Andris",
  "bob is the ba",
  "mike handles the legacy builds",
  "Gumdrop",
  "Candyland",
  "Priya Nair",
  "Kwame Boateng",
  "void keys",
  "Harbour repairs",
  "Production release",
];
