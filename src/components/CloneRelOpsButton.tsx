"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useMission } from "@/lib/store";
import { toDateInputValue } from "@/lib/selectors";

export function CloneRelOpsButton({ projectId }: { projectId: string }) {
  const { state, cloneRelOps } = useMission();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const project = state.projects.find((p) => p.id === projectId);
    const nextMonth = suggestNextMonth(project?.releaseMonth);
    return {
      monthName: nextMonth,
      mergeDate: "",
      releaseDate: "",
    };
  }, [projectId, state.projects]);

  const [monthName, setMonthName] = useState(defaults.monthName);
  const [mergeDate, setMergeDate] = useState(defaults.mergeDate);
  const [releaseDate, setReleaseDate] = useState(defaults.releaseDate);

  const openModal = () => {
    setMonthName(defaults.monthName);
    setMergeDate("");
    setReleaseDate("");
    setError(null);
    setOpen(true);
  };

  const submit = () => {
    try {
      if (!monthName.trim()) throw new Error("Release month name is required.");
      if (!mergeDate) throw new Error("Merge date is required.");
      if (!releaseDate) throw new Error("Release date is required.");
      cloneRelOps({
        monthName: monthName.trim(),
        mergeDate,
        releaseDate,
        templateProjectId: projectId,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clone month.");
    }
  };

  return (
    <>
      <button type="button" className="clone-relops-btn" onClick={openModal}>
        Clone month
      </button>
      <DetailModal
        open={open}
        title="Clone RELOPS month"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="muted-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={submit}>
              Create month
            </button>
          </div>
        }
      >
        <p className="mb-3 text-xs text-ink-soft">
          Creates a new release train from this template. Meetings, timeline, and
          process to-dos shift into the merge → release window.
        </p>
        <label className="field">
          <span>Release month name</span>
          <input
            value={monthName}
            onChange={(e) => setMonthName(e.target.value)}
            placeholder="August 2026"
          />
        </label>
        <label className="field">
          <span>Merge date</span>
          <input
            type="date"
            value={mergeDate}
            onChange={(e) => setMergeDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Release date</span>
          <input
            type="date"
            value={releaseDate}
            min={mergeDate || undefined}
            onChange={(e) => setReleaseDate(e.target.value)}
          />
        </label>
        {error ? <p className="mt-2 text-xs text-signal">{error}</p> : null}
      </DetailModal>
    </>
  );
}

function suggestNextMonth(current?: string) {
  if (!current) {
    return new Date().toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  const parsed = Date.parse(current);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }
  return current;
}

/** Exported for tests / reuse when seeding date inputs from ISO. */
export function isoToDateInput(iso?: string) {
  return toDateInputValue(iso);
}
