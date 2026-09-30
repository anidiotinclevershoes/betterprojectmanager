"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmOwnerDialog } from "@/components/intelligence/ConfirmOwnerDialog";
import { IssueDetailView } from "@/components/knowledge-centre/IssueDetailView";
import { IssueEditView } from "@/components/knowledge-centre/IssueEditView";
import { PersonDetailView } from "@/components/knowledge-centre/PersonDetailView";
import { TodoDetailView } from "@/components/knowledge-centre/TodoDetailView";
import { ItemTagsEditor } from "@/components/knowledge-centre/ItemTagsEditor";
import {
  buildCorrectedSectionBullets,
  knowledgeDetailEquals,
  resolveKnowledgeItemDetail,
  type KnowledgeItemRef,
} from "@/lib/knowledge-centre/knowledge-item-detail";
import { historyEventsForItem } from "@/lib/knowledge-centre/item-history";
import {
  beginIssueSave,
  canMountIssueEditor,
  changeIssueDraft,
  discardIssueEdit,
  finishIssueSave,
  idleIssueEditor,
  requestIssueEditExit,
  startIssueEdit,
} from "@/lib/knowledge-centre/issue-editor-state";
import { emptyKnowledge } from "@/lib/knowledge";
import { tagsForItem } from "@/lib/tags";
import { useMission } from "@/lib/store";

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
    removeTodo,
    setRiskStatus,
    setKnowledgeOnlyRiskResolved,
    saveItemTags,
    saveRiskEdit,
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
  const [addingResponsibility, setAddingResponsibility] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [moreDetails, setMoreDetails] = useState(false);
  const [stack, setStack] = useState<KnowledgeItemRef[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [issueEditor, setIssueEditor] = useState(idleIssueEditor);
  const issueEditorRef = useRef(issueEditor);
  issueEditorRef.current = issueEditor;
  const stateRef = useRef(state);
  stateRef.current = state;
  const savingIssueRef = useRef(false);

  const detail = useMemo(() => {
    if (!selected) return null;
    return resolveKnowledgeItemDetail(state, projectId, selected);
  }, [state, projectId, selected]);

  const savedTagNames = useMemo(() => {
    if (!detail || detail.ref.kind === "person") return [];
    const kind =
      detail.ref.kind === "risk"
        ? "risk"
        : detail.ref.kind === "todo"
          ? "todo"
          : "knowledge_item";
    const targetId =
      detail.ref.kind === "risk"
        ? detail.ref.riskId
        : detail.ref.kind === "todo"
          ? detail.ref.todoId
          : detail.ref.kind === "structured"
            ? detail.ref.itemId
            : detail.ref.kind === "section"
              ? detail.ref.itemId
              : null;
    if (!targetId) return [];
    return tagsForItem({
      projectTags: state.projectTags ?? [],
      itemTags: state.itemTags ?? [],
      projectId,
      targetKind: kind,
      targetId,
    }).map((tag) => tag.name);
  }, [detail, state.projectTags, state.itemTags, projectId]);

  const historyRead = useMemo(
    () => historyEventsForItem(state, projectId, selected),
    [state, projectId, selected],
  );

  const showTagEditor =
    detail?.domain === "risk" ||
    detail?.domain === "todo" ||
    detail?.domain === "knowledge";

  useEffect(() => {
    setEditing(false);
    setDraft(detail?.body ?? "");
    setDraftTags(savedTagNames);
    setConfirmOwnerOpen(false);
    setHandoverScope(null);
    setHandoverReplacePersonId(null);
    setAddingResponsibility(false);
    setLocalError(null);
    setTagError(null);
    setMoreDetails(false);
  }, [selected, detail?.body, savedTagNames.join("|")]);

  useEffect(() => {
    setStack([]);
  }, [projectId]);

  useEffect(() => {
    if (open) return;
    setIssueEditor(idleIssueEditor());
  }, [open]);

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
      if (e.key !== "Escape") return;
      if (issueEditorRef.current.active) {
        e.preventDefault();
        setIssueEditor(requestIssueEditExit(issueEditorRef.current));
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Project isolation: if selection no longer resolves in this project, close.
  // An active Issue edit keeps its snapshot instead of dismissing.
  useEffect(() => {
    if (issueEditorRef.current.active) return;
    if (selected && !detail) onClose();
  }, [selected, detail, onClose, issueEditor.active]);

  function holdIssueEditor() {
    const editor = issueEditorRef.current;
    if (!editor.active) return false;
    setIssueEditor(requestIssueEditExit(editor));
    return true;
  }

  function discardIssueEditSession() {
    if (issueEditorRef.current.saving || savingIssueRef.current) return;
    setIssueEditor(discardIssueEdit(issueEditorRef.current));
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }

  async function saveIssueEdit() {
    if (savingIssueRef.current) return;
    const editor = issueEditorRef.current;
    const exists = (stateRef.current.risks ?? []).some(
      (risk) => risk.id === editor.riskId && risk.projectId === projectId,
    );
    const begun = beginIssueSave(editor, exists);
    setIssueEditor(begun.state);
    if (!begun.intent.ok) return;
    savingIssueRef.current = true;
    try {
      const saved = await saveRiskEdit({
        projectId,
        riskId: begun.intent.input.riskId,
        title: begun.intent.input.title,
        notes: begun.intent.input.notes,
        tagNames: begun.intent.input.tagNames,
      });
      setIssueEditor((current) => {
        const next = finishIssueSave(current, saved);
        if (!next.active) {
          window.setTimeout(() => closeRef.current?.focus(), 0);
        }
        return next;
      });
    } finally {
      savingIssueRef.current = false;
    }
  }

  function closeConfirmOwner() {
    setConfirmOwnerOpen(false);
    setHandoverScope(null);
    setHandoverReplacePersonId(null);
    setAddingResponsibility(false);
  }

  function openAddResponsibility() {
    setHandoverScope(null);
    setHandoverReplacePersonId(null);
    setAddingResponsibility(true);
    setConfirmOwnerOpen(true);
  }

  function openHandover(scope: string, personId: string) {
    setAddingResponsibility(false);
    setHandoverScope(scope);
    setHandoverReplacePersonId(personId);
    setConfirmOwnerOpen(true);
  }

  function goBack() {
    if (stack.length) {
      const prev = stack[stack.length - 1]!;
      setStack((s) => s.slice(0, -1));
      // Parent owns selected. The stack is not handed back, so Back closes.
      void prev;
    }
    onClose();
  }

  function tagTarget():
    | { kind: "risk" | "todo" | "knowledge_item"; id: string }
    | null {
    if (!detail) return null;
    if (detail.ref.kind === "risk") return { kind: "risk", id: detail.ref.riskId };
    if (detail.ref.kind === "todo") return { kind: "todo", id: detail.ref.todoId };
    if (detail.ref.kind === "structured") {
      return { kind: "knowledge_item", id: detail.ref.itemId };
    }
    if (detail.ref.kind === "section" && detail.ref.itemId) {
      return { kind: "knowledge_item", id: detail.ref.itemId };
    }
    return null;
  }

  async function saveEdits() {
    if (!detail) return;
    setLocalError(null);
    setTagError(null);

    if (detail.canEditBody) {
      const next = draft.trim();
      if (!next) {
        setLocalError("Content cannot be empty.");
        return;
      }
      if (detail.ref.kind === "todo") {
        updateTodo(detail.ref.todoId, { title: next });
      } else if (detail.editSectionId) {
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
      } else {
        setLocalError("No durable edit path for this item.");
        return;
      }
    }

    const target = tagTarget();
    if (showTagEditor && target) {
      const tagged = await saveItemTags({
        projectId,
        targetKind: target.kind,
        targetId: target.id,
        names: draftTags,
      });
      if (!tagged.ok) {
        setTagError(tagged.error ?? "Could not save tags.");
        return;
      }
    }
    setEditing(false);
  }

  if (!open) return null;

  const riskRef = detail?.ref.kind === "risk" ? detail.ref : null;
  const genuineIssue = riskRef
    ? (state.risks ?? []).find(
        (risk) => risk.id === riskRef.riskId && risk.projectId === projectId,
      ) ?? null
    : null;
  const issueEditActive = Boolean(
    issueEditor.active && issueEditor.draft && issueEditor.riskId,
  );
  const issueSurface = Boolean(genuineIssue) || issueEditActive;
  const personSurface = Boolean(
    detail?.ref.kind === "person" && detail.personBundle,
  );
  const todoRef = detail?.ref.kind === "todo" ? detail.ref : null;
  const todoItem = todoRef
    ? (state.todos ?? []).find(
        (todo) => todo.id === todoRef.todoId && todo.projectId === projectId,
      ) ?? null
    : null;
  const todoSurface = Boolean(todoItem);
  const waitingNeedle = todoItem?.waitingOn?.trim().toLowerCase() ?? "";
  const waitingMatches = waitingNeedle
    ? (state.projects.find((project) => project.id === projectId)?.stakeholders ??
        []
      ).filter((person) => person.name.trim().toLowerCase() === waitingNeedle)
    : [];
  const waitingPersonName =
    waitingMatches.length === 1 ? waitingMatches[0]!.name : null;
  const detailShell = issueSurface
    ? " is-issue-detail"
    : personSurface
      ? " is-person-detail"
      : todoSurface
        ? " is-todo-detail"
        : "";
  const editHistory = issueEditActive
    ? historyEventsForItem(state, projectId, {
        kind: "risk",
        riskId: issueEditor.riskId!,
      })
    : null;
  const issueProjectTags = (state.projectTags ?? []).filter(
    (tag) => tag.projectId === projectId,
  );

  function openIssueEditor() {
    if (!genuineIssue || !canMountIssueEditor(genuineIssue.status)) return;
    setIssueEditor(
      startIssueEdit(issueEditorRef.current, {
        riskId: genuineIssue.id,
        title: genuineIssue.title,
        notes: genuineIssue.notes ?? null,
        tagNames: savedTagNames,
      }),
    );
  }

  return (
    <>
      <button
        type="button"
        className={`ocean-item-detail-backdrop${detailShell}`}
        aria-label="Close detail"
        onClick={() => {
          if (holdIssueEditor()) return;
          onClose();
        }}
        data-testid="ocean-item-detail-backdrop"
      />
      <aside
        className={`ocean-item-detail-drawer is-open${detailShell}${issueEditActive ? " is-issue-edit" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={issueEditActive ? "Edit issue" : issueSurface ? "Issue detail" : personSurface ? "Person detail" : todoSurface ? "To Do detail" : "Knowledge item detail"}
        aria-busy={issueEditor.saving ? true : undefined}
        data-testid="ocean-item-detail-drawer"
        data-overlay="true"
        data-item-kind={selected?.kind}
        data-issue-detail={issueSurface ? "true" : undefined}
        data-person-detail={personSurface ? "true" : undefined}
        data-todo-detail={todoSurface ? "true" : undefined}
        data-issue-editing={issueEditActive ? "true" : undefined}
        data-project-id={projectId}
      >
        {issueEditActive && issueEditor.draft ? (
          <IssueEditView
            title={issueEditor.draft.title}
            notes={issueEditor.draft.notes}
            tagNames={issueEditor.draft.tagNames}
            projectTags={issueProjectTags}
            history={editHistory?.events ?? []}
            historyNotice={editHistory?.notice ?? historyRead.notice}
            saving={issueEditor.saving}
            error={issueEditor.error}
            lockAnnounced={issueEditor.lockAnnounced}
            announceTick={issueEditor.announceTick}
            onTitle={(value) =>
              setIssueEditor((current) => changeIssueDraft(current, { title: value }))
            }
            onNotes={(value) =>
              setIssueEditor((current) => changeIssueDraft(current, { notes: value }))
            }
            onTags={(names) =>
              setIssueEditor((current) =>
                changeIssueDraft(current, { tagNames: names }),
              )
            }
            onSave={() => void saveIssueEdit()}
            onDiscard={discardIssueEditSession}
            onBlockedExit={holdIssueEditor}
            backRef={closeRef}
          />
        ) : genuineIssue ? (
          <IssueDetailView
            title={genuineIssue.title}
            status={genuineIssue.status}
            createdAt={genuineIssue.createdAt}
            updatedAt={genuineIssue.updatedAt}
            notes={detail?.issueNotes ?? null}
            tags={savedTagNames}
            history={historyRead.events}
            historyNotice={historyRead.notice}
            relations={detail?.relations ?? []}
            onBack={goBack}
            onClose={onClose}
            onEdit={openIssueEditor}
            onResolve={() =>
              setRiskStatus(genuineIssue.id, "resolved", projectId)
            }
            onReopen={() => setRiskStatus(genuineIssue.id, "open", projectId)}
            backRef={closeRef}
          />
        ) : detail?.ref.kind === "person" && detail.personBundle ? (
          <PersonDetailView
            name={detail.personBundle.person.name}
            role={detail.personBundle.person.role}
            lastContactAt={detail.personBundle.person.lastContactAt}
            currentResponsibilities={detail.personBundle.currentResponsibilities}
            historicalResponsibilities={
              detail.personBundle.historicalResponsibilities
            }
            sharedScopes={detail.personBundle.sharedScopes}
            availability={detail.personBundle.availability}
            waitingLines={detail.waitingLines ?? []}
            legacyContext={detail.legacyContext ?? []}
            history={historyRead.events}
            historyNotice={historyRead.notice}
            onBack={goBack}
            onClose={onClose}
            onAddResponsibility={openAddResponsibility}
            onHandover={(scope) =>
              openHandover(scope, detail.personBundle!.person.id)
            }
            backRef={closeRef}
            ownerSlot={
              confirmOwnerOpen ? (
                <ConfirmOwnerDialog
                  key={
                    addingResponsibility
                      ? "add-responsibility"
                      : `handover-${handoverScope ?? ""}`
                  }
                  projectId={projectId}
                  scope={addingResponsibility ? "" : handoverScope ?? ""}
                  truthItemId={null}
                  allowScopeEdit={addingResponsibility}
                  defaultPersonName={
                    addingResponsibility
                      ? detail.personBundle.person.name
                      : undefined
                  }
                  defaultReplacePersonId={
                    addingResponsibility ? null : handoverReplacePersonId
                  }
                  onDone={closeConfirmOwner}
                  onCancel={closeConfirmOwner}
                />
              ) : null
            }
          />
        ) : todoItem ? (
          <TodoDetailView
            title={todoItem.title}
            done={Boolean(todoItem.done)}
            dueAt={todoItem.dueAt}
            createdAt={todoItem.createdAt}
            detail={todoItem.detail}
            waitingOn={todoItem.waitingOn}
            waitingPersonName={waitingPersonName}
            tags={savedTagNames}
            history={historyRead.events}
            historyNotice={historyRead.notice}
            onBack={goBack}
            onClose={onClose}
            onToggle={() => toggleTodo(todoItem.id)}
            onRemove={() => {
              removeTodo(todoItem.id);
              onClose();
            }}
            backRef={closeRef}
          />
        ) : (
        <>
        <header className="ocean-item-detail-header">
          <button
            ref={closeRef}
            type="button"
            className="ocean-item-detail-back"
            onClick={goBack}
            data-testid="ocean-item-detail-back"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <p className="ocean-item-detail-kicker">
              {detail?.domain ?? "Item"}
            </p>
            <h2 className="ocean-item-detail-heading">
              {detail?.title ?? "Item"}
            </h2>
            {detail?.subtitle ? (
              <p className="ocean-item-detail-subtitle">{detail.subtitle}</p>
            ) : null}
          </div>
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

              <section className="ocean-item-detail-section">
                <h4>Details</h4>
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
              </section>

              {showTagEditor || savedTagNames.length ? (
                <section
                  className="ocean-item-detail-section"
                  data-testid="ocean-item-detail-tags"
                >
                  <h4>Tags</h4>
                  {detail.domain === "person" ? (
                    <p className="ocean-home-muted">
                      People are not tagged in this UI.
                    </p>
                  ) : editing && showTagEditor ? (
                    <ItemTagsEditor
                      projectTags={state.projectTags ?? []}
                      value={draftTags}
                      onChange={setDraftTags}
                    />
                  ) : savedTagNames.length ? (
                    <p className="kc-item-tags">
                      {savedTagNames.map((name) => (
                        <span key={name} className="tag-chip">
                          {name}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="ocean-home-muted">No tags yet.</p>
                  )}
                  {tagError ? (
                    <p className="ocean-item-detail-error" role="alert">
                      {tagError}
                    </p>
                  ) : null}
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

              <section
                className="ocean-item-detail-section"
                data-testid="ocean-item-detail-history"
              >
                <h4>History</h4>
                {historyRead.events.length ? (
                  <ol className="ocean-item-history">
                    {historyRead.events.map((event) => (
                      <li key={event.id}>
                        <strong>{event.title}</strong>
                        {event.detail ? <span> — {event.detail}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p
                    className="ocean-home-muted"
                    data-testid="ocean-item-history-limited"
                  >
                    {historyRead.notice}
                  </p>
                )}
              </section>

              {moreDetails ? (
                <>
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
                </>
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
                  onClick={() => void saveEdits()}
                  data-testid="ocean-item-detail-save"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setEditing(false);
                    setDraft(detail.body);
                    setDraftTags(savedTagNames);
                    setLocalError(null);
                    setTagError(null);
                  }}
                >
                  Discard
                </button>
              </>
            ) : (
              <>
                {detail.canEditBody || showTagEditor ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setEditing(true)}
                    data-testid="ocean-item-detail-edit"
                  >
                    Edit item
                  </button>
                ) : null}
                {detail.canToggleTodo && detail.ref.kind === "todo" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => toggleTodo(detail.ref.kind === "todo" ? detail.ref.todoId : "")}
                    data-testid="ocean-item-detail-toggle-todo"
                  >
                    {detail.todoDone ? "Reopen" : "Close"}
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
                    Close
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
                    Close
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
                {detail.previousValue ||
                detail.provenanceLines.length ||
                detail.assumptions.length ||
                detail.honestyNotes.length ? (
                  <button
                    type="button"
                    className="ghost-btn ml-auto"
                    onClick={() => setMoreDetails((open) => !open)}
                    aria-expanded={moreDetails}
                    data-testid="ocean-item-detail-more"
                  >
                    {moreDetails ? "Fewer details" : "More details"}
                  </button>
                ) : null}
                {detail.ref.kind === "todo" ? (
                  <button
                    type="button"
                    className="danger-btn"
                    data-testid="ocean-item-detail-remove"
                    onClick={() => {
                      removeTodo(detail.ref.kind === "todo" ? detail.ref.todoId : "");
                      onClose();
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
        </>
        )}
      </aside>
    </>
  );
}

/** Re-export for callers that compare selection. */
export { knowledgeDetailEquals };
