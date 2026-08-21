"use client";

import { useEffect, useMemo, useState } from "react";
import { useMission } from "@/lib/store";
import { PersonEntity } from "@/components/intelligence/PersonEntity";
import { emptyKnowledge } from "@/lib/knowledge";
import {
  resolveConfirmOwnerChoice,
  resolveReplacePersonId,
  type OwnershipIntent,
} from "@/lib/people/confirm-owner-choice";

/**
 * Explicit Confirm owner flow — mutation happens here, not inside Tell Me answer.
 * Slice 2D: when other current owners exist, user must choose share vs replace.
 */
export function ConfirmOwnerDialog({
  projectId,
  scope: scopeProp,
  truthItemId,
  defaultPersonName,
  defaultReplacePersonId,
  allowScopeEdit = false,
  onDone,
  onCancel,
}: {
  projectId: string;
  scope: string;
  truthItemId?: string | null;
  /** Prefill person name when opening from a person context. */
  defaultPersonName?: string | null;
  /** Prefill replace target (e.g. hand over from this person). */
  defaultReplacePersonId?: string | null;
  /** Allow editing scope (person detail assign flow). */
  allowScopeEdit?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { state, confirmResponsibilityOwner, saveStatus, saveError } =
    useMission();
  const project = state.projects.find((p) => p.id === projectId);
  const stakeholders = project?.stakeholders ?? [];
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);

  const [scope, setScope] = useState(scopeProp.trim());
  const [personName, setPersonName] = useState(
    defaultPersonName?.trim() || stakeholders[0]?.name || "",
  );
  const [intent, setIntent] = useState<OwnershipIntent | null>(
    defaultReplacePersonId ? "replace" : null,
  );
  const [replacePersonId, setReplacePersonId] = useState<string>(
    defaultReplacePersonId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScope(scopeProp.trim());
  }, [scopeProp]);

  const options = useMemo(
    () => stakeholders.map((s) => ({ id: s.id, name: s.name })),
    [stakeholders],
  );

  const selectedStakeholder = useMemo(() => {
    if (personName === "__other") return undefined;
    return stakeholders.find((s) => s.name === personName);
  }, [stakeholders, personName]);

  const choice = useMemo(
    () =>
      resolveConfirmOwnerChoice(knowledge, scope, {
        selectedPersonId: selectedStakeholder?.id ?? null,
        selectedPersonName:
          personName && personName !== "__other" ? personName : null,
      }),
    [knowledge, scope, selectedStakeholder?.id, personName],
  );

  const otherOwners = useMemo(
    () =>
      choice.currentOwners.filter((o) => {
        if (
          selectedStakeholder?.id &&
          o.personId === selectedStakeholder.id
        ) {
          return false;
        }
        if (
          personName &&
          personName !== "__other" &&
          o.personName.toLowerCase() === personName.trim().toLowerCase()
        ) {
          return false;
        }
        return true;
      }),
    [choice.currentOwners, selectedStakeholder?.id, personName],
  );

  // When intent becomes unnecessary, clear it; when replace becomes required
  // and a default replace id is still valid, keep it.
  useEffect(() => {
    if (!choice.requiresOwnershipIntent) {
      setIntent(null);
      return;
    }
    if (defaultReplacePersonId && otherOwners.some((o) => o.personId === defaultReplacePersonId)) {
      setIntent("replace");
      setReplacePersonId(defaultReplacePersonId);
    }
  }, [choice.requiresOwnershipIntent, defaultReplacePersonId, otherOwners]);

  const canSubmit =
    Boolean(scope.trim()) &&
    Boolean(personName.trim()) &&
    personName !== "__other" &&
    (!choice.requiresOwnershipIntent ||
      (intent === "share" ||
        (intent === "replace" && Boolean(replacePersonId))));

  return (
    <div
      className="lume-confirm-owner"
      role="dialog"
      aria-label="Confirm owner"
      data-testid="confirm-owner-dialog"
    >
      <p className="lume-confirm-owner-title">
        Confirm owner for{" "}
        {allowScopeEdit ? (
          <label className="lume-confirm-owner-inline-scope">
            <span className="sr-only">Scope</span>
            <input
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Responsibility scope"
              data-testid="confirm-owner-scope-input"
            />
          </label>
        ) : (
          <strong>{scope}</strong>
        )}
      </p>
      <p className="lume-confirm-owner-hint">
        This records a scoped responsibility, not a global project owner.
      </p>

      {choice.currentOwners.length ? (
        <div
          className="lume-confirm-owner-current"
          data-testid="confirm-owner-current"
        >
          <p className="lume-confirm-owner-current-label">Current owners</p>
          <ul>
            {choice.currentOwners.map((o) => (
              <li key={o.item.id}>
                <PersonEntity name={o.personName} scope={o.scope} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {options.length ? (
        <label className="lume-confirm-owner-field">
          Person
          <select
            value={
              options.some((o) => o.name === personName)
                ? personName
                : personName
                  ? "__other"
                  : ""
            }
            onChange={(e) => setPersonName(e.target.value)}
            data-testid="confirm-owner-person-select"
          >
            {options.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
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
            data-testid="confirm-owner-person-input"
          />
        </label>
      ) : null}

      {choice.requiresOwnershipIntent ? (
        <fieldset
          className="lume-confirm-owner-intent"
          data-testid="confirm-owner-intent"
        >
          <legend>How should ownership change?</legend>
          <p className="lume-confirm-owner-needs-you">Needs you — do not guess</p>
          <label className="lume-confirm-owner-radio">
            <input
              type="radio"
              name="ownership-intent"
              value="share"
              checked={intent === "share"}
              onChange={() => setIntent("share")}
              data-testid="confirm-owner-intent-share"
            />
            <span>
              Add as another owner
              {personName && personName !== "__other"
                ? ` (share with ${otherOwners.map((o) => o.personName).join(", ")})`
                : ""}
            </span>
          </label>
          <label className="lume-confirm-owner-radio">
            <input
              type="radio"
              name="ownership-intent"
              value="replace"
              checked={intent === "replace"}
              onChange={() => setIntent("replace")}
              data-testid="confirm-owner-intent-replace"
            />
            <span>
              {personName && personName !== "__other"
                ? `${personName} replaces…`
                : "Replace an existing owner…"}
            </span>
          </label>
          {intent === "replace" ? (
            <label className="lume-confirm-owner-field">
              Replace
              <select
                value={replacePersonId}
                onChange={(e) => setReplacePersonId(e.target.value)}
                data-testid="confirm-owner-replace-select"
              >
                <option value="">Select person…</option>
                {otherOwners.map((o) => (
                  <option
                    key={o.item.id}
                    value={o.personId ?? ""}
                    disabled={!o.personId}
                  >
                    {o.personName}
                    {!o.personId ? " (no durable id)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>
      ) : null}

      {personName && personName !== "__other" && scope.trim() ? (
        <p className="lume-confirm-owner-preview">
          Will store <PersonEntity name={personName} scope={scope.trim()} />
          {intent === "share" ? " as an additional owner" : null}
          {intent === "replace" && replacePersonId
            ? ` replacing ${
                otherOwners.find((o) => o.personId === replacePersonId)
                  ?.personName ?? "selected owner"
              }`
            : null}
        </p>
      ) : null}

      {error ? (
        <p className="tell-me-error" role="alert" data-testid="confirm-owner-error">
          {error}
        </p>
      ) : null}
      {saveStatus === "error" && saveError ? (
        <p
          className="tell-me-error"
          role="alert"
          data-testid="confirm-owner-save-error"
        >
          Could not save: {saveError}
        </p>
      ) : null}

      <div className="lume-confirm-owner-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={busy || !canSubmit}
          data-testid="confirm-owner-submit"
          onClick={() => {
            setBusy(true);
            setError(null);
            try {
              const replaceId = resolveReplacePersonId({
                intent,
                requiresOwnershipIntent: choice.requiresOwnershipIntent,
                replacePersonId: replacePersonId || null,
                currentOwners: choice.currentOwners,
              });
              confirmResponsibilityOwner({
                projectId,
                scope: scope.trim(),
                personName: personName.trim(),
                personId: selectedStakeholder?.id ?? null,
                resolveTruthItemId: truthItemId,
                replacePersonId: replaceId,
              });
              onDone?.();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not confirm",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Saving…"
            : intent === "replace"
              ? "Confirm replacement"
              : intent === "share"
                ? "Confirm shared owner"
                : "Confirm owner"}
        </button>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
