"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { LumeLogo } from "@/components/brand/LumeLogo";
import { OperationBar } from "@/components/capture/review/ReviewBadge";
import "@/components/capture/review/review-cards.css";
import "./new-project-ocean.css";
import {
  isProjectCodeTaken,
  isProjectNameTaken,
  newSetupClientKey,
  projectCodeTakenMessage,
  projectNameTakenMessage,
  suggestCode,
  type CreateProjectInput,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";
import { deriveProjectSummary } from "@/lib/new-project/derive-summary";
import { mergeOrganisedDraft } from "@/lib/new-project/merge-organised";
import { needsYouFromDraft } from "@/lib/new-project/needs-you";
import { parsePersonLine, scopesOf } from "@/lib/new-project/person-text";
import { useMission } from "@/lib/store";
import { useMicrophoneTranscript } from "@/lib/transcribe/use-microphone-transcript";

function emptyDraft(): CreateProjectInput {
  return {
    name: "",
    code: "",
    summary: "",
    currentFocus: "",
    sourceMode: "compose",
    stakeholders: [],
    risks: [],
    todos: [],
    importantDates: [],
    knowledgeRemember: [],
  };
}

const FRAME_HELP = {
  issues: {
    blurb: "Problems, risks or things needing attention.",
    example: "The supplier portal is intermittently returning 500 errors",
  },
  people: {
    blurb: "People involved and, where known, what they own.",
    example: "Olga — QA lead",
  },
  todo: {
    blurb: "Actions somebody needs to complete.",
    example: "Raise the AddSearch purchase order",
  },
  knowledge: {
    blurb: "Useful facts, decisions or context worth remembering.",
    example: "Releases normally happen on Thursday evenings",
  },
} as const;

export function NewProjectExperience({
  variant = "page",
}: {
  variant?: "first-run" | "page";
}) {
  const router = useRouter();
  const { createProject, state } = useMission();
  const [draft, setDraft] = useState<CreateProjectInput>(emptyDraft);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [stage, setStage] = useState<"tell" | "review">("tell");
  const [codeEnabled, setCodeEnabled] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const createLockRef = useRef(false);
  const clientProjectIdRef = useRef<string | null>(null);
  const organiseAbortRef = useRef<AbortController | null>(null);

  const existingProjects = state.projects ?? [];
  const needsYou = useMemo(() => needsYouFromDraft(draft), [draft]);
  const nameTaken = Boolean(
    draft.name.trim() && isProjectNameTaken(existingProjects, draft.name),
  );
  const codeTaken = Boolean(
    draft.code.trim() && isProjectCodeTaken(existingProjects, draft.code),
  );

  const mic = useMicrophoneTranscript({
    disabled: busy,
    onTranscript: (text) => {
      setNotes((current) => [current.trim(), text].filter(Boolean).join("\n\n"));
    },
  });

  const createFromDraft = useCallback(
    async (input: CreateProjectInput) => {
      if (createLockRef.current) return;
      createLockRef.current = true;
      setBusy(true);
      setError(null);
      if (!clientProjectIdRef.current) {
        clientProjectIdRef.current = crypto.randomUUID();
      }
      try {
        const id = await createProject({
          ...input,
          sourceMode: "compose",
          clientProjectId: clientProjectIdRef.current,
        });
        clientProjectIdRef.current = null;
        setSuccess(`${input.name.trim() || input.code} is ready.`);
        router.push(`/projects/${id}`);
      } catch (err) {
        setSuccess(null);
        setError(
          err instanceof Error
            ? err.message
            : "Could not create the project. Please try again.",
        );
      } finally {
        createLockRef.current = false;
        setBusy(false);
      }
    },
    [createProject, router],
  );

  function applySuggestedCode(name: string) {
    if (codeTouched) {
      setCodeEnabled(true);
      return;
    }
    const next = suggestCode(name);
    if (next.length >= 2) {
      setDraft((d) => ({ ...d, code: next }));
    }
    setCodeEnabled(true);
  }

  function openManualReview() {
    const overview = notes.trim();
    setDraft((d) => ({
      ...d,
      sourceNarrative: [d.sourceNarrative, overview]
        .filter((s) => s?.trim())
        .join("\n\n"),
      summary: d.summary.trim() || deriveProjectSummary(overview),
    }));
    setStage("review");
  }

  async function organiseNotes() {
    const content = notes.trim();
    if (!content) {
      setError("Tell Lume a little about the project first.");
      return;
    }
    setBusy(true);
    setError(null);
    organiseAbortRef.current?.abort();
    const controller = new AbortController();
    organiseAbortRef.current = controller;
    try {
      const res = await fetch("/api/new-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          content,
          sourceMode: "paste",
          kind: "delivery",
        }),
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const fail = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          fail?.error ||
            "Could not organise this into a project map. Nothing was created.",
        );
        return;
      }
      const data = (await res.json()) as { draft?: CreateProjectInput };
      if (!data.draft) {
        setError(
          "Could not organise this into a project map. Nothing was created.",
        );
        return;
      }
      setDraft((current) =>
        mergeOrganisedDraft(
          {
            ...current,
            sourceNarrative: [current.sourceNarrative, content]
              .filter((s) => s?.trim())
              .join("\n\n"),
          },
          { ...emptyDraft(), ...data.draft, sourceMode: "compose" },
          { codeLocked: Boolean(current.code.trim()) || codeTouched },
        ),
      );
      setStage("review");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError(null);
        return;
      }
      setError(
        "Could not organise this into a project map. Nothing was created.",
      );
    } finally {
      if (organiseAbortRef.current === controller) {
        organiseAbortRef.current = null;
      }
      setBusy(false);
    }
  }

  function onCreate() {
    if (!draft.name.trim()) {
      setError("Give the project a name.");
      return;
    }
    if (nameTaken) {
      setError(projectNameTakenMessage(draft.name));
      return;
    }
    const code = draft.code.trim() || suggestCode(draft.name);
    if (code.length < 2) {
      setError("Give the project a code of at least 2 characters.");
      return;
    }
    if (isProjectCodeTaken(existingProjects, code)) {
      setError(projectCodeTakenMessage(code));
      return;
    }
    setStage("review");
    void createFromDraft({
      ...draft,
      code,
      sourceMode: "compose",
    });
  }

  return (
    <div
      className={`np-experience ${variant === "first-run" ? "is-first-run" : ""}`}
      data-testid="np-experience"
      data-np-variant={variant}
      data-np-stage={stage}
    >
      <header className="np-hero">
        <LumeLogo className="np-hero-logo" />
        <p className="np-brand">LUME</p>
        <h1 className="np-hero-title">
          {stage === "review"
            ? "Review what Lume found"
            : "Tell Lume about this project"}
        </h1>
        <p className="np-hero-sub np-hero-lead">
          {stage === "review"
            ? "I’ve added what I could find. Change anything that’s wrong and add anything I missed."
            : "Give me whatever you know so far. Describe it, paste notes, or use the mic. I’ll organise what I can, then you can review everything."}
        </p>
      </header>

      <div className="np-four-frame" data-testid="np-four-frame">
        <section className="np-identity" data-testid="np-identity">
          <div className="np-identity-row">
            <label className="np-field">
              Name
              <input
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({ ...d, name }));
                }}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (!name) return;
                  applySuggestedCode(name);
                  if (isProjectNameTaken(existingProjects, name)) {
                    setError(projectNameTakenMessage(name));
                  } else if (error?.startsWith("Project name already exists")) {
                    setError(null);
                  }
                }}
                placeholder="Member Claims Upload"
                autoComplete="off"
                data-testid="np-name"
              />
            </label>
            <label className={`np-field ${codeEnabled ? "" : "is-muted"}`}>
              Code
              <input
                value={draft.code}
                disabled={!codeEnabled}
                onChange={(e) => {
                  setCodeTouched(true);
                  setDraft((d) => ({
                    ...d,
                    code: e.target.value.toUpperCase().slice(0, 12),
                  }));
                }}
                onBlur={(e) => {
                  const code = e.target.value.trim();
                  if (code && isProjectCodeTaken(existingProjects, code)) {
                    setError(projectCodeTakenMessage(code));
                  } else if (error?.startsWith("Project code already exists")) {
                    setError(null);
                  }
                }}
                placeholder="MCU"
                autoComplete="off"
                aria-disabled={!codeEnabled}
                data-testid="np-code"
              />
            </label>
          </div>
          {nameTaken ? (
            <p className="np-field-hint is-error">{projectNameTakenMessage(draft.name)}</p>
          ) : null}
          {codeTaken ? (
            <p className="np-field-hint is-error">{projectCodeTakenMessage(draft.code)}</p>
          ) : null}
          {!codeEnabled ? (
            <p className="np-field-hint">
              Code is suggested after you enter a name, then you can edit it.
            </p>
          ) : null}
        </section>

        {stage === "tell" ? (
          <section className="np-overview" data-testid="np-overview">
            <div className="np-overview-head">
              <h2>Tell Lume about this project</h2>
              <p>
                Add what you know now. Paste a brief, email, or notes — or talk
                it through with the mic.
              </p>
            </div>
            <div className="np-overview-input">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="This is monthly web BAU. Olga is QA lead. Andris is responsible for Legacy…"
                data-testid="np-organise-notes"
              />
              <button
                type="button"
                className={`np-mic ${mic.active ? "is-active" : ""}`}
                onClick={() => mic.toggle()}
                disabled={busy || mic.busy}
                data-testid="np-mic"
                aria-pressed={mic.active}
              >
                {mic.active ? "Stop" : mic.busy ? "Transcribing…" : "Mic"}
              </button>
            </div>
            {mic.error ? (
              <p className="np-field-hint is-error" role="status">
                {mic.error}
              </p>
            ) : null}
            <div className="np-overview-actions">
              <button
                type="button"
                className="primary-btn"
                disabled={busy || !notes.trim()}
                onClick={() => void organiseNotes()}
                data-testid="np-organise"
              >
                {busy ? "Organising…" : "Organise my project"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy || !draft.name.trim()}
                onClick={openManualReview}
                data-testid="np-skip-organise"
              >
                I’ll add items myself
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="np-summary-block" data-testid="np-summary-block">
              <label className="np-field">
                Project summary
                <textarea
                  value={draft.summary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, summary: e.target.value }))
                  }
                  placeholder="A short description Lume will remember as this project’s objective."
                  data-testid="np-summary"
                />
              </label>
              <p className="np-field-hint">
                This becomes the project’s stored summary — the compact objective
                Lume uses later. Edit it before you create.
              </p>
              {notes.trim() ? (
                <details className="np-source-notes">
                  <summary>What you told Lume</summary>
                  <p>{notes}</p>
                </details>
              ) : null}
            </section>

            {needsYou.length ? (
              <aside className="np-needs-you" data-testid="np-needs-you">
                <p>Needs You {needsYou.length}</p>
                <ul>
                  {needsYou.map((item) => (
                    <li key={item.id}>{item.question}</li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <div className="np-frames">
              <ComposeFrame
                title="Issues"
                testId="np-frame-issues"
                addLabel="Add issue"
                help={FRAME_HELP.issues}
                items={(draft.risks ?? []).map((risk) => ({
                  key: risk.clientKey ?? risk.title,
                  title: risk.title,
                  needsYou: Boolean(risk.needsReview),
                }))}
                onAdd={(title) =>
                  setDraft((d) => ({
                    ...d,
                    risks: [
                      ...(d.risks ?? []),
                      { clientKey: newSetupClientKey(), title } satisfies SetupRiskDraft,
                    ],
                  }))
                }
                onEdit={(i, title) =>
                  setDraft((d) => ({
                    ...d,
                    risks: (d.risks ?? []).map((risk, idx) =>
                      idx === i ? { ...risk, title, needsReview: false } : risk,
                    ),
                  }))
                }
                onRemove={(i) =>
                  setDraft((d) => ({
                    ...d,
                    risks: (d.risks ?? []).filter((_, idx) => idx !== i),
                  }))
                }
              />
              <PeopleFrame
                people={draft.stakeholders ?? []}
                onChange={(stakeholders) =>
                  setDraft((d) => ({ ...d, stakeholders }))
                }
              />
              <ComposeFrame
                title="To Do"
                testId="np-frame-todo"
                addLabel="Add to do"
                help={FRAME_HELP.todo}
                items={(draft.todos ?? []).map((todo) => ({
                  key: todo.clientKey ?? todo.title,
                  title: todo.title,
                  needsYou: Boolean(todo.needsReview),
                }))}
                onAdd={(title) =>
                  setDraft((d) => ({
                    ...d,
                    todos: [
                      ...(d.todos ?? []),
                      { clientKey: newSetupClientKey(), title } satisfies SetupTodoDraft,
                    ],
                  }))
                }
                onEdit={(i, title) =>
                  setDraft((d) => ({
                    ...d,
                    todos: (d.todos ?? []).map((todo, idx) =>
                      idx === i ? { ...todo, title, needsReview: false } : todo,
                    ),
                  }))
                }
                onRemove={(i) =>
                  setDraft((d) => ({
                    ...d,
                    todos: (d.todos ?? []).filter((_, idx) => idx !== i),
                  }))
                }
              />
              <ComposeFrame
                title="Knowledge"
                testId="np-frame-knowledge"
                addLabel="Add knowledge"
                help={FRAME_HELP.knowledge}
                items={[
                  ...(draft.importantDates ?? []).map((date) => ({
                    key: date.clientKey ?? date.label,
                    title: date.label,
                    needsYou: Boolean(date.needsReview || !date.date),
                  })),
                  ...(draft.knowledgeRemember ?? []).map((item) => ({
                    key: item.clientKey ?? item.text,
                    title: item.text,
                    needsYou: Boolean(item.needsReview),
                  })),
                ]}
                onAdd={(text) =>
                  setDraft((d) => ({
                    ...d,
                    knowledgeRemember: [
                      ...(d.knowledgeRemember ?? []),
                      {
                        clientKey: newSetupClientKey(),
                        text,
                        remember: true,
                      } satisfies SetupKnowledgeDraft,
                    ],
                  }))
                }
                onEdit={(i, text) => {
                  const dates = draft.importantDates ?? [];
                  if (i < dates.length) {
                    setDraft((d) => ({
                      ...d,
                      importantDates: (d.importantDates ?? []).map((date, idx) =>
                        idx === i ? { ...date, label: text } : date,
                      ),
                    }));
                    return;
                  }
                  const offset = i - dates.length;
                  setDraft((d) => ({
                    ...d,
                    knowledgeRemember: (d.knowledgeRemember ?? []).map((item, idx) =>
                      idx === offset
                        ? {
                            ...item,
                            text,
                            needsReview: false,
                            remember: true,
                            needsYouQuestion: undefined,
                          }
                        : item,
                    ),
                  }));
                }}
                onRemove={(i) => {
                  const dates = draft.importantDates ?? [];
                  if (i < dates.length) {
                    setDraft((d) => ({
                      ...d,
                      importantDates: (d.importantDates ?? []).filter(
                        (_, idx) => idx !== i,
                      ),
                    }));
                    return;
                  }
                  const offset = i - dates.length;
                  setDraft((d) => ({
                    ...d,
                    knowledgeRemember: (d.knowledgeRemember ?? []).filter(
                      (_, idx) => idx !== offset,
                    ),
                  }));
                }}
              />
            </div>
          </>
        )}

        {error ? (
          <p className="np-create-error" data-testid="np-create-error" role="alert">
            {error}
          </p>
        ) : null}

        {stage === "review" ? (
          <div className="np-create-row">
            <button
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => setStage("tell")}
            >
              Back to overview
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={busy || !draft.name.trim() || nameTaken || codeTaken}
              onClick={onCreate}
              data-testid="np-create"
            >
              {busy ? "Creating…" : "Create Project"}
            </button>
          </div>
        ) : null}
      </div>

      {success ? (
        <div className="np-success-block" role="status" data-testid="np-create-success">
          <p className="np-success">
            {success} Opening the workspace — Capture is how you tell Lume what
            happens next.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ProposedCard({
  title,
  needsYou,
  onRemove,
  children,
}: {
  title: string;
  needsYou?: boolean;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const family = needsYou ? "needs_you" : "create";
  return (
    <article
      className={`lume-review-card ${needsYou ? "is-needs-you" : "is-create"}`}
      data-review-family={family}
    >
      <header className="lume-review-head">
        <OperationBar
          family={family}
          operation={needsYou ? "update" : "create"}
        />
      </header>
      <div className="lume-review-body">
        {children ?? <p className="np-proposed-title">{title}</p>}
        <div className="lume-review-actions">
          <button type="button" className="ghost-btn" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function ComposeFrame({
  title,
  testId,
  addLabel,
  help,
  items,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  testId: string;
  addLabel: string;
  help: { blurb: string; example: string };
  items: Array<{ key: string; title: string; needsYou?: boolean }>;
  onAdd: (value: string) => void;
  onEdit: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <section className="np-frame" data-testid={testId}>
      <h2>{title}</h2>
      <p className="np-frame-help">{help.blurb}</p>
      {items.length === 0 ? (
        <p className="np-frame-example" data-example="true" aria-hidden>
          Example: {help.example}
        </p>
      ) : (
        <ul className="np-proposed-list">
          {items.map((item, index) => (
            <li key={item.key || `${item.title}-${index}`}>
              <ProposedCard
                title={item.title}
                needsYou={item.needsYou}
                onRemove={() => onRemove(index)}
              >
                <input
                  className="np-inline-edit"
                  value={item.title}
                  onChange={(e) => onEdit(index, e.target.value)}
                  aria-label={`Edit ${title}`}
                />
              </ProposedCard>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = value.trim();
          if (!next) return;
          onAdd(next);
          setValue("");
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={addLabel}
          placeholder={addLabel}
        />
        <button type="submit">{addLabel}</button>
      </form>
    </section>
  );
}

function PeopleFrame({
  people,
  onChange,
}: {
  people: SetupStakeholderDraft[];
  onChange: (next: SetupStakeholderDraft[]) => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");

  function addPerson() {
    const parsed = parsePersonLine(name);
    const extra = scope.trim();
    const responsibilities = [
      ...parsed.responsibilities,
      ...(extra ? [extra] : []),
    ].filter((item, index, all) => {
      const key = item.toLowerCase();
      return all.findIndex((s) => s.toLowerCase() === key) === index;
    });
    const nextName = parsed.name || name.trim();
    if (!nextName) return;
    onChange([
      ...people,
      {
        clientKey: newSetupClientKey(),
        name: nextName,
        responsibilities,
        needsReview: false,
      } satisfies SetupStakeholderDraft,
    ]);
    setName("");
    setScope("");
  }

  return (
    <section className="np-frame" data-testid="np-frame-people">
      <h2>People</h2>
      <p className="np-frame-help">{FRAME_HELP.people.blurb}</p>
      {people.length === 0 ? (
        <p className="np-frame-example" data-example="true" aria-hidden>
          Example: {FRAME_HELP.people.example}
        </p>
      ) : (
        <ul className="np-proposed-list">
          {people.map((person, index) => {
            const scopes = scopesOf(person);
            return (
              <li key={person.clientKey ?? `${person.name}-${index}`}>
                <ProposedCard
                  title={person.name}
                  needsYou={Boolean(person.needsReview)}
                  onRemove={() =>
                    onChange(people.filter((_, idx) => idx !== index))
                  }
                >
                  <label className="np-field">
                    Name
                    <input
                      className="np-inline-edit"
                      value={person.name}
                      onChange={(e) =>
                        onChange(
                          people.map((item, idx) =>
                            idx === index ? { ...item, name: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="np-scope-list">
                    {scopes.map((item, scopeIndex) => (
                      <span key={`${item}-${scopeIndex}`} className="np-scope-chip">
                        <input
                          value={item}
                          aria-label={`Responsibility ${scopeIndex + 1} for ${person.name}`}
                          onChange={(e) => {
                            const next = scopes.map((scopeValue, idx) =>
                              idx === scopeIndex ? e.target.value : scopeValue,
                            );
                            onChange(
                              people.map((entry, idx) =>
                                idx === index
                                  ? {
                                      ...entry,
                                      responsibilities: next.filter(Boolean),
                                      needsReview: false,
                                    }
                                  : entry,
                              ),
                            );
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          onClick={() =>
                            onChange(
                              people.map((entry, idx) =>
                                idx === index
                                  ? {
                                      ...entry,
                                      responsibilities: scopes.filter(
                                        (_, sidx) => sidx !== scopeIndex,
                                      ),
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        onChange(
                          people.map((entry, idx) =>
                            idx === index
                              ? {
                                  ...entry,
                                  responsibilities: [...scopes, ""],
                                }
                              : entry,
                          ),
                        )
                      }
                    >
                      Add responsibility
                    </button>
                  </div>
                </ProposedCard>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="np-people-add"
        onSubmit={(e) => {
          e.preventDefault();
          addPerson();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Add person"
          placeholder="Name"
          data-testid="np-add-person-name"
        />
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Add responsibility"
          placeholder="Responsibility (optional)"
          data-testid="np-add-person-scope"
        />
        <button type="submit">Add person</button>
      </form>
    </section>
  );
}
