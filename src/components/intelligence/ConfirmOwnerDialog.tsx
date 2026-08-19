"use client";

import { useMemo, useState } from "react";
import { useMission } from "@/lib/store";
import { PersonEntity } from "@/components/intelligence/PersonEntity";

/**
 * Explicit Confirm owner flow — mutation happens here, not inside Tell Me answer.
 */
export function ConfirmOwnerDialog({
  projectId,
  scope,
  truthItemId,
  onDone,
  onCancel,
}: {
  projectId: string;
  scope: string;
  truthItemId?: string | null;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { state, confirmResponsibilityOwner } = useMission();
  const project = state.projects.find((p) => p.id === projectId);
  const stakeholders = project?.stakeholders ?? [];
  const [personName, setPersonName] = useState(
    stakeholders[0]?.name ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => stakeholders.map((s) => s.name),
    [stakeholders],
  );

  return (
    <div className="lume-confirm-owner" role="dialog" aria-label="Confirm owner">
      <p className="lume-confirm-owner-title">
        Confirm owner for <strong>{scope}</strong>
      </p>
      <p className="lume-confirm-owner-hint">
        This records a scoped responsibility, not a global project owner.
      </p>
      {options.length ? (
        <label className="lume-confirm-owner-field">
          Person
          <select
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
          >
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__other">Someone else…</option>
          </select>
        </label>
      ) : null}
      {personName === "__other" || !options.length ? (
        <label className="lume-confirm-owner-field">
          Name
          <input
            type="text"
            value={personName === "__other" ? "" : personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="Full name"
          />
        </label>
      ) : null}
      {personName && personName !== "__other" ? (
        <p className="lume-confirm-owner-preview">
          Will store{" "}
          <PersonEntity name={personName} scope={scope} />
        </p>
      ) : null}
      {error ? <p className="tell-me-error">{error}</p> : null}
      <div className="lume-confirm-owner-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={busy || !personName.trim() || personName === "__other"}
          onClick={() => {
            setBusy(true);
            setError(null);
            try {
              confirmResponsibilityOwner({
                projectId,
                scope,
                personName: personName.trim(),
                resolveTruthItemId: truthItemId,
              });
              onDone?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not confirm");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Confirm owner"}
        </button>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
