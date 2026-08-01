"use client";

import { DetailModal } from "@/components/DetailModal";

/** Visual preview of the Reset demo data confirmation (development only). */
export function ResetPreviewClient() {
  return (
    <div className="golden-page">
      <header className="golden-hero">
        <div className="golden-hero-copy">
          <p className="eyebrow">Development only</p>
          <h1>Reset confirmation preview</h1>
          <p className="meta">
            Same confirmation dialog used by the sidebar Reset demo data action.
          </p>
        </div>
      </header>

      <DetailModal
        open
        title="Reset demo data?"
        onClose={() => undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="muted-btn">
              Cancel
            </button>
            <button type="button" className="danger-btn">
              Reset demo data
            </button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft" style={{ marginBottom: "0.75rem" }}>
          This will delete changes made to seeded projects and restore the
          original development baseline.
        </p>
        <p className="text-sm text-ink-soft">
          Your non-seeded data will not be changed.
        </p>
      </DetailModal>
    </div>
  );
}
