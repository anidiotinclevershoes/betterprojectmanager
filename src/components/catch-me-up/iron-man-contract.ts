/**
 * Iron Man / shared mode navigation contract.
 *
 * Catch Me Up owns the briefing backend and this isolated surface.
 * Shared shell / mode tabs stay with Iron Man.
 *
 * Mount:
 *   import { CatchMeUpSurface } from "@/components/catch-me-up";
 *   <CatchMeUpSurface projectId={project.id} />
 *
 * Do not pass MissionState. The surface POSTs { projectId } to /api/catch-me-up.
 * Suggested placement: Capture | Knowledge Centre | Catch Me Up | Advise
 * Advise remains coming soon.
 */

export const CATCH_ME_UP_MODE_ID = "catch-me-up" as const;

export const CATCH_ME_UP_API_PATH = "/api/catch-me-up";

export type CatchMeUpMountProps = {
  projectId: string;
};

export const CATCH_ME_UP_INTEGRATION = {
  modeId: CATCH_ME_UP_MODE_ID,
  apiPath: CATCH_ME_UP_API_PATH,
  componentExport: "CatchMeUpSurface",
  mountExample: "<CatchMeUpSurface projectId={project.id} />",
  requestBody: "{ projectId }",
  placement:
    "Capture | Knowledge Centre | Catch Me Up | Advise (Advise remains coming soon)",
} as const;
