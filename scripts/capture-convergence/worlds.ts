import type { CaptureApplyWorld } from "../../src/lib/capture/apply";
import { experimentalApplyWorld, CANDYLAND_ID } from "../../src/lib/experiments/worlds";
import type { WorldKind } from "./types";

export const AURORA_ID = "proj-aurora";
export const OLGA_ID = "person-olga";
export const SARAH_ID = "person-sarah";
export const MS_RELEASE = "ms-production-release";
export const MS_CAB = "ms-cab-prep";

/** Same Aurora world as D-051 diagnostic. Not a second truth store. */
export function auroraWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([AURORA_ID]),
    projects: [
      {
        id: AURORA_ID,
        name: "Aurora Migration",
        code: "AM",
        stakeholders: [
          { id: OLGA_ID, name: "Olga Petrov", role: "" },
          { id: SARAH_ID, name: "Sarah Kim", role: "" },
        ],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: MS_RELEASE,
        projectId: AURORA_ID,
        label: "Production release",
        startAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: MS_CAB,
        projectId: AURORA_ID,
        label: "CAB preparation session",
        startAt: "2026-09-10T00:00:00.000Z",
      },
    ],
    knowledge: [
      {
        projectId: AURORA_ID,
        sections: { people: [], risks: [] },
        structured: [
          {
            id: "know-runbook-v2",
            kind: "fact",
            lifecycle: "current",
            body: "Cutover runbook v2 is the working runbook",
            meta: null,
          },
        ],
      },
    ],
  };
}

export function worldFor(kind: WorldKind): CaptureApplyWorld {
  return kind === "aurora" ? auroraWorld() : experimentalApplyWorld();
}

export { CANDYLAND_ID };
