"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailModal } from "@/components/DetailModal";
import { useMission } from "@/lib/store";
import type { Project } from "@/lib/types";

/**
 * Deterministic destructive action for the currently selected project.
 * Confirmation reuses DetailModal + Cancel + danger-btn (Reset demo pattern).
 * No AI sparkle. Does not redesign project navigation.
 */
export function DeleteProjectButton({ project }: { project: Project }) {
  const router = useRouter();
  const { deleteProject, saveError, saveStatus } = useMission();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError =
    localError ||
    (saveStatus === "error" && confirmOpen ? saveError : null);

  const runDelete = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const result = await deleteProject(project.id);
      setConfirmOpen(false);
      router.replace(result.nextHref);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not delete this project.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ocean-delete-project"
        data-testid="ocean-delete-project"
        onClick={() => {
          setLocalError(null);
          setConfirmOpen(true);
        }}
      >
        Delete project
      </button>

      <DetailModal
        open={confirmOpen}
        title="Delete this project?"
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="muted-btn"
              data-testid="ocean-delete-project-cancel"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-btn"
              data-testid="ocean-delete-project-confirm"
              onClick={() => void runDelete()}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete project"}
            </button>
          </div>
        }
      >
        <p
          className="text-sm text-ink-soft"
          data-testid="ocean-delete-project-name"
          style={{ marginBottom: "0.75rem" }}
        >
          You are about to permanently delete{" "}
          <strong>{project.name}</strong>.
        </p>
        <p className="text-sm text-ink-soft">
          This cannot be undone. Knowledge, Risks, People, To Dos, and other
          data that belong only to this project will be removed. Other projects
          will not be changed.
        </p>
        {visibleError ? (
          <p
            className="field-error"
            role="alert"
            data-testid="ocean-delete-project-error"
            style={{ marginTop: "0.85rem" }}
          >
            {visibleError}
          </p>
        ) : null}
      </DetailModal>
    </>
  );
}
