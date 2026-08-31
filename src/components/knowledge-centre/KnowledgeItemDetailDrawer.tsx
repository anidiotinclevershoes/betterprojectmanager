"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmOwnerDialog } from "@/components/intelligence/ConfirmOwnerDialog";
import { PersonEntity } from "@/components/intelligence/PersonEntity";
import {
  buildCorrectedSectionBullets,
  knowledgeDetailEquals,
  resolveKnowledgeItemDetail,
  type KnowledgeItemRef,
} from "@/lib/knowledge-centre/knowledge-item-detail";
import { emptyKnowledge } from "@/lib/knowledge";
import { useMission } from "@/lib/store";
import { TagChips } from "@/components/tags/TagChips";
import { tagsForItem, type TagTargetKind } from "@/lib/tags";

/**
 * Ocean-compatible Knowledge item detail drawer (Slice 2C).
 * Side panel — does not navigate away from Knowledge Centre.
 */
export function KnowledgeItemDetailDrawer({
  projectId,
  selected,
  onClose,
}: {
  projectId: string;
  selected: KnowledgeItemRef | null;
  onClose: () => void;
}) {
  const {
    state,
    updateKnowledgeSection,
    updateTodo,
    toggleTodo,
    setRiskStatus,
    setKnowledgeOnlyRiskResolved,
    attachItemTag,
    detachItemTag,
    saveStatus,
    saveError,
  } = useMission();

  const open = Boolean(selected);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerReturnFocus = useRef<Element | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmOwnerOpen, setConfirmOwnerOpen] = useState(false);
  const [handoverScope, setHandoverScope] = useState<string | null>(null);
  const [handoverReplacePersonId, setHandoverReplacePersonId] = useState<
    string | null
  >(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const detail = useMemo(() => {
    if (!selected) return null;
    return resolveKnowledgeItemDetail(state, projectId, selected);
  }, [state, projectId, selected]);

  const tagTarget = useMemo(
    () => (selected ? tagTargetFromRef(selected) : null),
    [selected],
  );
  const attachedTagNames = useMemo(() => {
    if (!tagTarget) return [];
    return tagsForItem({
      projectTags: state.projectTags ?? [],
      itemTags: state.itemTags ?? [],
      projectId,
      targetKind: tagTarget.kind,
      targetId: tagTarget.id,
    }).map((t) => t.name);
  }, [tagTarget, state.projectTags, state.itemTags, projectId]);

  useEffect(() => {
    setEditing(false);
    setDraft(detail?.body ?? "");
    setConfirmOwnerOpen(false);
    setHandoverScope(null);
    setHandoverReplacePersonId(null);
    setLocalError(null);
  }, [selected, detail?.body]);

  useEffect(() => {
    if (open) {
      triggerReturnFocus.current = document.activeElement;
      window.setTimeout(() => closeRef.current?.focus(), 50);
    } else if (triggerReturnFocus.current instanceof HTMLElement) {
      triggerReturnFocus.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Project isolation: if selection no longer resolves in this project, close
  useEffect(() => {
    if (selected && !detail) onClose();
  }, [selected, detail, onClose]);

  function saveBodyEdit() {
    if (!detail?.canEditBody) return;
    setLocalError(null);
    const next = draft.trim();
    if (!next) {
      setLocalError("Content cannot be empty.");
      return;
    }

    if (detail.ref.kind === "todo") {
      updateTodo(detail.ref.todoId, { title: next });
      setEditing(false);
      return;
    }

    if (detail.editSectionId) {
      const knowledge =
        state.knowledge.find((k) => k.projectId === projectId) ??
        emptyKnowledge(projectId);
      const bullets = buildCorrectedSectionBullets(
        knowledge,
        detail.editSectionId,
        {
          itemId: detail.editItemId,
          oldBody: detail.body,
          newBody: next,
        },
      );
      if (!bullets) {
        setLocalError(
          "Could not locate this item by stable id — edit cancelled to avoid mutating the wrong line.",
        );
        return;
      }
      updateKnowledgeSection(projectId, detail.editSectionId, bullets);
      setEditing(false);
      return;
    }

    setLocalError("No durable edit path for this item.");
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="ocean-item-detail-backdrop"
        aria-label="Close detail"
        onClick={onClose}
        data-testid="ocean-item-detail-backdrop"
      />
      <aside
        className="ocean-item-detail-drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge item detail"
        data-testid="ocean-item-detail-drawer"
        data-item-kind={selected?.kind}
        data-project-id={projectId}
      >
        <header className="ocean-item-detail-header">
          <div>
            <p className="ocean-item-detail-kicker">
              {detail?.title ?? "Item"}
            </p>
            {detail?.subtitle ? (
              <p className="ocean-item-detail-subtitle">{detail.subtitle}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ocean-item-detail-close"
            onClick={onClose}
            data-testid="ocean-item-detail-close"
          >
            Close
          </button>
        </header>

        <div className="ocean-item-detail-body">
          {!detail ? (
            <p className="ocean-item-detail-missing">
              This item is not available in this project.
            </p>
          ) : (
            <>
              {detail.epistemicLabel ? (
                <p
                  className="ocean-item-detail-epistemic"
                  data-testid="ocean-item-detail-epistemic"
                  data-epistemic={detail.epistemic ?? undefined}
                >
                  {detail.epistemicLabel}
                </p>
              ) : null}

              {detail.needsYouReason ? (
                <p
                  className="ocean-item-detail-needs-you"
                  data-testid="ocean-item-detail-needs-you"
                >
                  {detail.needsYouReason}
                </p>
              ) : null}

              {editing ? (
                <label className="ocean-item-detail-edit">
                  <span className="sr-only">Edit content</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    data-testid="ocean-item-detail-edit-input"
                  />
                </label>
              ) : (
                <p
                  className="ocean-item-detail-content"
                  data-testid="ocean-item-detail-body"
                >
                  {detail.body}
                </p>
              )}

              {detail.previousValue ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-previous"
                >
                  <h4>{detail.previousLabel ?? "Previously"}</h4>
                  <p className="ocean-item-detail-previous">
                    {detail.previousValue}
                  </p>
                </section>
              ) : null}

              {detail.provenanceLines.length ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-provenance"
                >
                  <h4>Why Lume believes this</h4>
                  <ul>
                    {detail.provenanceLines.map((line, i) => (
                      <li key={`${line}-${i}`}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.domain === "person" && detail.personBundle ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-person"
                >
                  <h4>Responsibilities</h4>
                  <ul>
                    {detail.personBundle.currentResponsibilities.map((r) => (
                      <li key={r.item.id}>
                        <PersonEntity
                          name={detail.personBundle!.person.name}
                          scope={r.scope}
                        />
                        <span className="ocean-item-detail-muted">
                          {" "}
                          · current
                        </span>
                      </li>
                    ))}
                    {detail.personBundle.historicalResponsibilities.map(
                      (r) => (
                        <li key={r.item.id}>
                          {r.scope}
                          <span className="ocean-item-detail-muted">
                            {" "}
                            · {r.lifecycle}
                          </span>
                        </li>
                      ),
                    )}
                    {!detail.personBundle.currentResponsibilities.length &&
                    !detail.personBundle.historicalResponsibilities
                      .length ? (
                      <li className="ocean-item-detail-muted">
                        No structured responsibilities yet.
                      </li>
                    ) : null}
                  </ul>
                  {detail.personBundle.sharedScopes.length ? (
                    <>
                      <h4>Shared</h4>
                      <ul data-testid="ocean-item-detail-shared">
                        {detail.personBundle.sharedScopes.map((s) => (
                          <li key={s.scope}>
                            {s.scope} · also{" "}
                            {s.coOwnerNames.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {detail.personBundle.availability.length ? (
                    <>
                      <h4>Availability</h4>
                      <ul data-testid="ocean-item-detail-availability">
                        {detail.personBundle.availability.map((a) => (
                          <li key={a.item.id}>{a.body}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {detail.waitingLines?.length ? (
                    <>
                      <h4>Waiting on them</h4>
                      <ul data-testid="ocean-item-detail-waiting">
                        {detail.waitingLines.map((line, i) => (
                          <li key={`${line}-${i}`}>{line}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {detail.legacyContext?.length ? (
                    <>
                      <h4>Legacy people notes</h4>
                      <ul data-testid="ocean-item-detail-legacy">
                        {detail.legacyContext.map((line, i) => (
                          <li key={`${line}-${i}`}>{line}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {detail.personBundle.currentResponsibilities.length ? (
                    <div className="ocean-item-detail-handover-list">
                      <h4>Hand over</h4>
                      <ul data-testid="ocean-item-detail-handover">
                        {detail.personBundle.currentResponsibilities.map(
                          (r) => (
                            <li key={`hand-${r.item.id}`}>
                              <button
                                type="button"
                                className="ghost-btn"
                                data-testid={`ocean-item-detail-handover-${r.item.id}`}
                                onClick={() => {
                                  setHandoverScope(r.scope);
                                  setHandoverReplacePersonId(
                                    detail.personBundle!.person.id,
                                  );
                                  setConfirmOwnerOpen(true);
                                }}
                              >
                                Hand over {r.scope}…
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {tagTarget ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-tags"
                >
                  <h4>Tags</h4>
                  <p className="meta">
                    Retrieval only. Changing a tag does not change this item.
                  </p>
                  <TagChips
                    tags={attachedTagNames}
                    projectTags={(state.projectTags ?? []).filter(
                      (t) => t.projectId === projectId,
                    )}
                    onAdd={(name) =>
                      attachItemTag({
                        projectId,
                        targetKind: tagTarget.kind,
                        targetId: tagTarget.id,
                        name,
                      })
                    }
                    onRemove={(name) => {
                      const tag = (state.projectTags ?? []).find(
                        (t) =>
                          t.projectId === projectId &&
                          t.name.toLowerCase() === name.toLowerCase(),
                      );
                      if (!tag) return;
                      detachItemTag({
                        projectId,
                        targetKind: tagTarget.kind,
                        targetId: tagTarget.id,
                        tagId: tag.id,
                      });
                    }}
                  />
                </section>
              ) : null}

              {detail.relations.length ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-relations"
                >
                  <h4>Related</h4>
                  <ul>
                    {detail.relations.map((r) => (
                      <li key={`${r.kind}-${r.id}`}>{r.label}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.assumptions.length ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-assumptions"
                >
                  <h4>Assumptions / notes</h4>
                  <ul>
                    {detail.assumptions.map((a, i) => (
                      <li key={`${a}-${i}`}>{a}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.honestyNotes.length ? (
                <section
                  className="ocean-item-detail-section ocean-item-detail-honesty"
                  data-testid="ocean-item-detail-honesty"
                >
                  <h4>Evidence limits</h4>
                  <ul>
                    {detail.honestyNotes.map((n, i) => (
                      <li key={`${n}-${i}`}>{n}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {confirmOwnerOpen && detail.canConfirmOwner ? (
                <ConfirmOwnerDialog
                  projectId={projectId}
                  scope={
                    handoverScope ??
                    detail.confirmOwnerScope ??
                    ""
                  }
                  truthItemId={
                    handoverScope ? null : detail.confirmOwnerTruthItemId
                  }
                  allowScopeEdit={
                    Boolean(detail.allowConfirmScopeEdit) && !handoverScope
                  }
                  defaultReplacePersonId={
                    handoverReplacePersonId ??
                    detail.confirmOwnerDefaultReplacePersonId
                  }
                  onDone={() => {
                    setConfirmOwnerOpen(false);
                    setHandoverScope(null);
                    setHandoverReplacePersonId(null);
                  }}
                  onCancel={() => {
                    setConfirmOwnerOpen(false);
                    setHandoverScope(null);
                    setHandoverReplacePersonId(null);
                  }}
                />
              ) : null}

              {localError ? (
                <p
                  className="ocean-item-detail-error"
                  data-testid="ocean-item-detail-local-error"
                  role="alert"
                >
                  {localError}
                </p>
              ) : null}

              {saveStatus === "error" && saveError ? (
                <p
                  className="ocean-item-detail-error"
                  data-testid="ocean-item-detail-save-error"
                  role="alert"
                >
                  Could not save: {saveError}
                </p>
              ) : null}
              {saveStatus === "saving" ? (
                <p
                  className="ocean-item-detail-save-status"
                  data-testid="ocean-item-detail-saving"
                >
                  Saving…
                </p>
              ) : null}
              {saveStatus === "saved" ? (
                <p
                  className="ocean-item-detail-save-status"
                  data-testid="ocean-item-detail-saved"
                >
                  Saved
                </p>
              ) : null}
            </>
          )}
        </div>

        {detail ? (
          <footer
            className="ocean-item-detail-actions"
            data-testid="ocean-item-detail-actions"
          >
            {editing ? (
              <>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={saveBodyEdit}
                  data-testid="ocean-item-detail-save"
                >
                  Save correction
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setEditing(false);
                    setDraft(detail.body);
                    setLocalError(null);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {detail.canEditBody ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setEditing(true)}
                    data-testid="ocean-item-detail-edit"
                  >
                    Correct
                  </button>
                ) : null}
                {detail.canToggleTodo && detail.ref.kind === "todo" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => toggleTodo(detail.ref.kind === "todo" ? detail.ref.todoId : "")}
                    data-testid="ocean-item-detail-toggle-todo"
                  >
                    {detail.todoDone ? "Mark open" : "Mark done"}
                  </button>
                ) : null}
                {detail.canResolveRisk && detail.ref.kind === "risk" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setRiskStatus(detail.ref.kind === "risk" ? detail.ref.riskId : "", "resolved", projectId)
                    }
                    data-testid="ocean-item-detail-resolve-risk"
                  >
                    Mark resolved
                  </button>
                ) : null}
                {detail.canResolveKnowledgeRisk &&
                detail.ref.kind === "knowledge_risk" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setKnowledgeOnlyRiskResolved(
                        projectId,
                        detail.body,
                        true,
                      )
                    }
                    data-testid="ocean-item-detail-resolve-kr"
                  >
                    Mark resolved
                  </button>
                ) : null}
                {detail.canConfirmOwner ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setHandoverScope(null);
                      setHandoverReplacePersonId(null);
                      setConfirmOwnerOpen(true);
                    }}
                    data-testid="ocean-item-detail-confirm-owner"
                  >
                    {detail.canAssignResponsibility
                      ? "Assign ownership"
                      : "Confirm owner"}
                  </button>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
      </aside>
    </>
  );
}

function tagTargetFromRef(
  ref: KnowledgeItemRef,
): { kind: TagTargetKind; id: string } | null {
  if (ref.kind === "risk") return { kind: "risk", id: ref.riskId };
  if (ref.kind === "todo") return { kind: "todo", id: ref.todoId };
  if (ref.kind === "person") return { kind: "stakeholder", id: ref.personId };
  if (ref.kind === "timeline") return { kind: "milestone", id: ref.timelineId };
  if (ref.kind === "structured") return { kind: "knowledge_item", id: ref.itemId };
  if (ref.kind === "section" && ref.itemId) {
    return { kind: "knowledge_item", id: ref.itemId };
  }
  if (ref.kind === "unconfirmed_owner") {
    return { kind: "knowledge_item", id: ref.itemId };
  }
  return null;
}

/** Re-export for callers that compare selection. */
export { knowledgeDetailEquals };
