/**
 * Experimental programme worlds — Candyland / Toyworld / GamingStudio5000.
 * Shared by Phase 0 baseline, Capture V2, and New Project V2 fixtures.
 * Unmistakable names so isolation failures are obvious.
 */

import type { CaptureApplyWorld } from "@/lib/capture/apply";

export const CANDYLAND_ID = "proj-candy";
export const TOYWORLD_ID = "proj-toy";
export const GAMING_ID = "proj-game";

export function experimentalApplyWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([CANDYLAND_ID, TOYWORLD_ID, GAMING_ID]),
    projects: [
      {
        id: CANDYLAND_ID,
        name: "Candyland",
        code: "CANDY",
        stakeholders: [
          { id: "person-gumdrop", name: "Pippa Gumdrop", role: "UAT lead" },
          { id: "person-fizz", name: "Fizz Caramel", role: "Designer" },
        ],
      },
      {
        id: TOYWORLD_ID,
        name: "Toyworld",
        code: "TOY",
        stakeholders: [
          { id: "person-brick", name: "Brick Oakley", role: "Sponsor" },
          { id: "person-buttons", name: "Captain Buttons", role: "Assembly lead" },
        ],
      },
      {
        id: GAMING_ID,
        name: "GamingStudio5000",
        code: "GS5K",
        stakeholders: [
          { id: "person-pixel", name: "Pixel Ramos", role: "Producer" },
        ],
      },
    ],
    risks: [
      {
        id: "risk-bridge",
        projectId: CANDYLAND_ID,
        title: "Gumdrop Bridge icing",
        status: "open",
      },
      {
        id: "risk-packaging",
        projectId: TOYWORLD_ID,
        title: "Packaging delay",
        status: "open",
      },
      {
        id: "risk-console",
        projectId: GAMING_ID,
        title: "Console certification slip",
        status: "open",
      },
    ],
    todos: [
      {
        id: "todo-pack",
        projectId: CANDYLAND_ID,
        title: "Prepare the jelly pack",
        done: false,
      },
      {
        id: "todo-track",
        projectId: TOYWORLD_ID,
        title: "Print the track map",
        done: false,
      },
      {
        id: "todo-balance",
        projectId: GAMING_ID,
        title: "Boss balancing pass",
        done: false,
      },
    ],
    timeline: [
      {
        id: "ms-parade",
        projectId: CANDYLAND_ID,
        label: "Parade day",
        startAt: "2026-10-15T12:00:00.000Z",
      },
      {
        id: "ms-freeze",
        projectId: TOYWORLD_ID,
        label: "Track freeze",
        startAt: "2026-09-01T12:00:00.000Z",
      },
      {
        id: "ms-cert",
        projectId: GAMING_ID,
        label: "Console certification",
        startAt: "2026-11-20T12:00:00.000Z",
      },
    ],
    knowledge: [
      {
        projectId: CANDYLAND_ID,
        sections: { people: ["Pippa Gumdrop — UAT lead"] },
        structured: [
          {
            id: "resp-uat",
            kind: "responsibility",
            lifecycle: "current",
            body: "Pippa Gumdrop — UAT lead",
            meta: {
              personId: "person-gumdrop",
              responsibility: {
                personId: "person-gumdrop",
                personName: "Pippa Gumdrop",
                scope: "UAT lead",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
  };
}

export const BASELINE_CAPTURE_PASTES: Array<{
  id: string;
  world: "candyland";
  paste: string;
  intent: string;
}> = [
  {
    id: "person-reuse",
    world: "candyland",
    paste: "Pippa Gumdrop remains UAT lead.",
    intent: "Existing Person mentioned again — no second stakeholder",
  },
  {
    id: "risk-resolve",
    world: "candyland",
    paste: "Gumdrop Bridge icing is resolved.",
    intent: "Named Risk resolve — not a To Do",
  },
  {
    id: "date-move",
    world: "candyland",
    paste: "Parade day moved to 22 October 2026.",
    intent: "Date update — not a To Do",
  },
  {
    id: "availability",
    world: "candyland",
    paste: "Pippa Gumdrop is away from 2026-10-03.",
    intent: "Availability on existing Person",
  },
  {
    id: "share-replace",
    world: "candyland",
    paste:
      "Fizz Caramel will share UAT lead with Pippa Gumdrop and may replace her.",
    intent: "Ambiguous share vs replace — Needs you",
  },
  {
    id: "todo-create",
    world: "candyland",
    paste: "Create a to-do to order extra sprinkles for the parade float.",
    intent: "Genuine To Do create",
  },
  {
    id: "commentary",
    world: "candyland",
    paste: "I think the weather will be nice on Friday, nothing project related.",
    intent: "Unrelated commentary — no write",
  },
  {
    id: "multi-fact",
    world: "candyland",
    paste:
      "Pippa Gumdrop remains UAT lead and Parade day moved to 22 October 2026 while Gumdrop Bridge icing is still a concern.",
    intent: "Multiple facts in one sentence",
  },
];

export const NEW_PROJECT_MESSY_INPUT = `This is the Candyland parade rebuild.

Pippa Gumdrop is UAT lead. Fizz Caramel is doing the float design.
We're worried the Gumdrop Bridge icing will slip. Parade day is 15 October 2026.
Need to order extra sprinkles. CAB pack must be ready 24 hours before the parade.
Pixel Ramos is not on this project — she's on GamingStudio5000.
`;
