"use client";

import { useSearchParams } from "next/navigation";
import { CatchMeUpSurface } from "@/components/catch-me-up/CatchMeUpSurface";
import type { CatchMeUpBriefing } from "@/lib/catch-me-up/types";

const PREVIEW_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function previewBriefing(): CatchMeUpBriefing {
  return {
    projectId: PREVIEW_PROJECT_ID,
    projectName: "Atlas Modernisation",
    projectCode: "ATLAS",
    generatedAt: "2026-08-27T12:00:00.000Z",
    thinProject: false,
    facts: [
      { id: "ms-uat", summary: "(date) UAT window: 2026-09-14" },
      { id: "dep-docuflow", summary: "(dependency) UAT needs DocuFlow staging" },
      { id: "todo-pack", summary: "(todo) Finish CAB pack" },
      { id: "todo-rollback", summary: "(todo) Confirm rollback owner" },
      { id: "todo-evidence", summary: "(todo) Attach security evidence" },
      { id: "risk-old", summary: "(risk, open) Vendor SLA still unsigned" },
      {
        id: "avail-sarah",
        summary: "(availability) Sarah Chen away 12–20 Sep",
      },
    ],
    whereWeAre: {
      epistemic: "known",
      prose:
        "Atlas is in CAB / UAT prep. Security evidence and the CAB pack are still open, and UAT is dated 14 September.",
      factIds: ["ms-uat", "todo-pack"],
    },
    needsAttention: [
      {
        epistemic: "known",
        prose: "UAT starts 14 September; three open To Dos still feed that window.",
        factIds: ["ms-uat", "todo-pack", "todo-rollback", "todo-evidence"],
      },
      {
        epistemic: "known",
        prose: "Vendor SLA is still an open risk.",
        factIds: ["risk-old"],
      },
    ],
    mightHaveMissed: [
      {
        epistemic: "inferred",
        prose:
          "The vendor SLA has been sitting open while CAB prep is the current focus — easy to lose in the noise.",
        factIds: ["risk-old"],
      },
    ],
    connections: [
      {
        epistemic: "inferred",
        prose:
          "UAT appears dependent on DocuFlow staging being ready.",
        factIds: ["ms-uat", "dep-docuflow"],
      },
      {
        epistemic: "inferred",
        prose:
          "Sarah is away during the UAT window, which may create coverage risk.",
        factIds: ["avail-sarah", "ms-uat"],
      },
    ],
    provider: "none",
    model: null,
  };
}

function thinBriefing(): CatchMeUpBriefing {
  return {
    projectId: PREVIEW_PROJECT_ID,
    projectName: "Blank Harbour",
    projectCode: "HARBOUR",
    generatedAt: "2026-08-27T12:00:00.000Z",
    thinProject: true,
    facts: [],
    whereWeAre: {
      epistemic: "known",
      prose:
        "Lume doesn’t know much about Blank Harbour yet. Use Capture to tell me what’s happening, and I’ll be able to brief you.",
      factIds: [],
    },
    needsAttention: [],
    mightHaveMissed: [],
    connections: [],
    provider: "none",
    model: null,
  };
}

/**
 * Development preview of the Catch Me Up briefing surface.
 * Fixture copy is labelled as preview — not live project truth.
 */
export function CatchMeUpPreviewClient() {
  const params = useSearchParams();
  const state = params.get("state") ?? "briefing";

  if (state === "error") {
    return (
      <CatchMeUpSurface
        projectId={PREVIEW_PROJECT_ID}
        previewBriefing={null}
        previewStatus="error"
        previewError="Catch Me Up could not brief this project."
      />
    );
  }
  if (state === "unavailable") {
    return (
      <CatchMeUpSurface
        projectId={PREVIEW_PROJECT_ID}
        previewBriefing={null}
        previewStatus="unavailable"
        previewError="Catch Me Up reads the live workspace. Connect a workspace to brief this project."
      />
    );
  }
  if (state === "loading") {
    return (
      <CatchMeUpSurface
        projectId={PREVIEW_PROJECT_ID}
        previewBriefing={null}
        previewStatus="loading"
      />
    );
  }
  if (state === "thin") {
    return (
      <CatchMeUpSurface
        projectId={PREVIEW_PROJECT_ID}
        previewBriefing={thinBriefing()}
      />
    );
  }
  return (
    <CatchMeUpSurface
      projectId={PREVIEW_PROJECT_ID}
      previewBriefing={previewBriefing()}
    />
  );
}
