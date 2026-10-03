/**
 * Experimental stand-in for the intended New Project flow.
 * No production UI. No separate semantic interpreter.
 * The collated notes are the Organise input. The world is whatever
 * canonical truth gathering has already stored.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";

export const ONBOARDING_PROJECT_ID = "proj-riv-new";

export function emptyOnboardingWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([ONBOARDING_PROJECT_ID]),
    projects: [
      {
        id: ONBOARDING_PROJECT_ID,
        name: "Riverside House",
        code: "RIV",
        stakeholders: [],
      },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  };
}

export function partialOnboardingWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([ONBOARDING_PROJECT_ID]),
    projects: [
      {
        id: ONBOARDING_PROJECT_ID,
        name: "Riverside House",
        code: "RIV",
        stakeholders: [{ id: "person-helen-new", name: "Helen Ward", role: "Client PM" }],
      },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [
      {
        projectId: ONBOARDING_PROJECT_ID,
        sections: {},
        structured: [
          {
            id: "resp-helen-decisions",
            kind: "responsibility",
            lifecycle: "current",
            body: "Helen Ward — client decisions",
            meta: {
              responsibility: {
                personId: "person-helen-new",
                personName: "Helen Ward",
                scope: "client decisions",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
  };
}

/** Gathering, follow-up, and unresolved notes, collated into one Organise input. */
export const FULL_ONBOARDING_COLLATED = `Project name: Riverside House
Project code: RIV

Collated onboarding

What the user already told us:
It is a house refit. Helen Ward is the client PM and is responsible for client decisions. James Okonkwo is the principal contractor and covers the site programme. Nadia Rahman is the interior designer and handles FF&E.

Follow-up we asked: who is commercial, what is still open, and which dates are fixed?
User: Sarah Kim is the QS and handles valuations. Someone needs to sort the fire cert before we start on site. Practical completion is 12 December 2026. There is a risk the DDA ramp detail is still outstanding. We decided the stairs stay.

Still unresolved:
Who covers building control. The user said one of the engineers might, and that this is not confirmed.

Explicitly not in this project:
Pixel Ramos is not on this project. She is on a games job.`;

export const FOLLOWUP_ONBOARDING_COLLATED = `Follow-up after project identity and Helen Ward were already recorded.

User: Sarah Kim is the QS and handles valuations. Someone needs to sort the fire cert. One of the engineers might cover building control, but I do not know who.`;
