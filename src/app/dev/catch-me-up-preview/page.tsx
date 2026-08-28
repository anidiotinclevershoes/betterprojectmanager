import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CatchMeUpPreviewClient } from "@/components/catch-me-up/CatchMeUpPreviewClient";

export const dynamic = "force-dynamic";

/** Development-only preview of the Catch Me Up briefing surface. */
export default function CatchMeUpPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return (
    <div className="ocean-project-page" data-testid="catch-me-up-preview-page">
      <p className="ocean-catch-me-up-preview-note">
        Preview fixture — not live project truth. Iron Man mounts{" "}
        <code>CatchMeUpSurface</code> in the project mode area.
      </p>
      <Suspense fallback={<p className="meta">Loading Catch Me Up preview…</p>}>
        <CatchMeUpPreviewClient />
      </Suspense>
    </div>
  );
}
