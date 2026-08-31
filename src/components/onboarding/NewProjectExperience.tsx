"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { TagChips } from "@/components/tags/TagChips";
import {
  isProjectCodeTaken,
  newSetupClientKey,
  normaliseProjectCode,
  projectCodeTakenMessage,
  suggestCode,
  type CreateProjectInput,
  type SetupDateDraft,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";
import { mergeOrganisedDraft } from "@/lib/new-project/merge-organised";
import { needsYouFromDraft } from "@/lib/new-project/needs-you";
import type { ProvisionalItem } from "@/lib/new-project-v2";
import { useMission } from "@/lib/store";
import { dedupeTagNames, tagSlug, type ProjectTag } from "@/lib/tags";

type KnowledgeKind = NonNullable<SetupKnowledgeDraft["kind"]>;

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
    knowledgeDecisions: [],
  };
}

function draftProjectTags(draft: CreateProjectInput): ProjectTag[] {
  const names = [
    ...(draft.risks ?? []).flatMap((r) => r.tags ?? []),
    ...(draft.todos ?? []).flatMap((t) => t.tags ?? []),
    ...(draft.stakeholders ?? []).flatMap((s) => s.tags ?? []),
    ...(draft.importantDates ?? []).flatMap((d) => d.tags ?? []),
    ...(draft.knowledgeRemember ?? []).flatMap((k) => k.tags ?? []),
  ];
  return dedupeTagNames(names).map((name) => ({
    id: tagSlug(name),
    projectId: "draft",
    name,
    slug: tagSlug(name),
    origin: "custom",
  }));
}

export function NewProjectExperience({
  variant = "page",
}: {
  variant?: "first-run" | "page";
}) {
  const router = useRouter();
  const { createProject, openaiConfigured, state } = useMission();
  const [draft, setDraft] = useState<CreateProjectInput>(emptyDraft);
  const [codeLocked, setCodeLocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [organiseSummary, setOrganiseSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [organising, setOrganising] = useState(false);
  const createLockRef = useRef(false);
  const clientProjectIdRef = useRef<string | null>(null);

  const codeTaken = isProjectCodeTaken(state.projects, draft.code);
  const canCreate = Boolean(draft.name.trim()) && Boolean(draft.code.trim()) && !codeTaken;
  const needsYou = useMemo(() => needsYouFromDraft(draft), [draft]);
  const projectTags = useMemo(() => draftProjectTags(draft), [draft]);
  const foundCount =
    (draft.risks ?? []).filter((r) => r.title.trim()).length +
    (draft.stakeholders ?? []).filter((s) => s.name.trim()).length +
    (draft.todos ?? []).filter((t) => t.title.trim()).length +
    (draft.importantDates ?? []).filter((d) => d.label.trim()).length +
    (draft.knowledgeRemember ?? []).filter((k) => k.text.trim() && k.remember !== false)
      .length;

  const setName = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      name,
      code: codeLocked ? prev.code : suggestCode(name),
    }));
  };

  const organiseNotes = async () => {
    const content = notes.trim();
    if (!content || organising) return;
    setOrganising(true);
    setError(null);
    setOrganiseSummary(null);
    try {
      const res = await fetch("/api/new-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sourceMode: "paste", kind: "delivery" }),
      });
      const data = (await res.json().catch(() => null)) as {
        draft?: CreateProjectInput;
        error?: string;
        note?: string;
        pipeline?: string;
        provisionalItems?: ProvisionalItem[];
      } | null;
      if (!res.ok || !data?.draft) {
        setError(
          data?.error ||
            "Could not organise these notes. Nothing was saved — you can add items by hand.",
        );
        return;
      }
      setDraft((prev) => {
        const merged = mergeOrganisedDraft(prev, data.draft!, {
          codeLocked,
        });
        return { ...merged, sourceMode: "compose" };
      });
      const next = data.draft;
      const issues = (next.risks ?? []).filter((r) => r.title.trim()).length;
      const people = (next.stakeholders ?? []).filter((s) => s.name.trim()).length;
      const todos = (next.todos ?? []).filter((t) => t.title.trim()).length;
      const knowledge =
        (next.importantDates ?? []).filter((d) => d.label.trim()).length +
        (next.knowledgeRemember ?? []).filter((k) => k.text.trim()).length;
      const total = issues + people + todos + knowledge;
      setOrganiseSummary(
        total
          ? `Lume found ${total} thing${total === 1 ? "" : "s"} to start with`
          : "Lume could not confidently organise these notes. Add what you know by hand.",
      );
      if (data.note) setError(data.note);
    } catch {
      setError(
        "Could not organise these notes. Nothing was saved — you can add items by hand.",
      );
    } finally {
      setOrganising(false);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("Give the project a name.");
      return;
    }
    if (!draft.code.trim()) {
      setError("Give the project a code.");
      return;
    }
    if (codeTaken) {
      setError(projectCodeTakenMessage(draft.code));
      return;
    }
    if (createLockRef.current) return;
    createLockRef.current = true;
    setBusy(true);
    setError(null);
    if (!clientProjectIdRef.current) {
      clientProjectIdRef.current = crypto.randomUUID();
    }
    try {
      const id = await createProject({
        ...draft,
        code: normaliseProjectCode(draft.code),
        sourceMode: "compose",
        sourceNarrative: notes.trim() || draft.sourceNarrative,
        clientProjectId: clientProjectIdRef.current,
      });
      clientProjectIdRef.current = null;
      router.push(`/projects/${id}?created=1`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create the project.";
      setError(message);
    } finally {
      createLockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form
      className={`np-experience np-four-frame ${variant === "first-run" ? "is-first-run" : ""}`}
      onSubmit={(e) => void onCreate(e)}
      data-testid="np-four-frame"
    >
      <header className="np-compose-head">
        <p className="np-kicker">New project</p>
        <h1 className="np-compose-title">Establish the first known picture</h1>
        <p className="np-compose-lead">
          Name it, add what you already know, and create. Capture keeps Lume
          current afterwards.
        </p>
      </header>

      <section className="np-identity ocean-knowledge-frame accent-position">
        <header className="ocean-knowledge-frame-header">
          <h3>Project identity</h3>
        </header>
        <div className="ocean-knowledge-frame-body np-identity-body">
          <label className="field">
            Project name
            <input
              required
              value={draft.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Member Claims Upload"
              data-testid="np-project-name"
            />
          </label>
          <label className="field">
            Project code
            <input
              required
              value={draft.code}
              onChange={(e) => {
                setCodeLocked(true);
                setDraft((prev) => ({
                  ...prev,
                  code: normaliseProjectCode(e.target.value),
                }));
              }}
              aria-invalid={codeTaken}
              data-testid="np-project-code"
            />
          </label>
          {codeTaken ? (
            <p className="field-error" data-testid="np-code-taken">
              {projectCodeTakenMessage(draft.code)}
            </p>
          ) : (
            <p className="field-hint">
              Generated from the name. Edit it if you prefer a different code.
            </p>
          )}
        </div>
      </section>

      <section className="np-organiser" data-testid="np-organiser">
        <button
          type="button"
          className="np-organiser-toggle"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((v) => !v)}
        >
          Have project notes already?
        </button>
        {notesOpen ? (
          <div className="np-organiser-body">
            <label className="field">
              Paste them here and Lume can organise what it recognises.
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Meeting notes, a handover, or anything already written."
                data-testid="np-organiser-notes"
              />
            </label>
            <button
              type="button"
              className="ghost-btn"
              disabled={!notes.trim() || organising}
              onClick={() => void organiseNotes()}
              data-testid="np-organise-notes"
            >
              {organising ? "Organising…" : "Organise notes"}
            </button>
            <p className="meta">
              {openaiConfigured === false
                ? "Local organisation — OpenAI is not configured."
                : "Creates editable proposals only. Nothing is saved until you create the project."}
            </p>
          </div>
        ) : null}
        {organiseSummary ? (
          <div className="np-organise-found" data-testid="np-organise-found">
            <p>
              <strong>{organiseSummary}</strong>
            </p>
            {foundCount ? (
              <ul>
                <li>Issues · {(draft.risks ?? []).filter((r) => r.title.trim()).length}</li>
                <li>
                  People ·{" "}
                  {(draft.stakeholders ?? []).filter((s) => s.name.trim()).length}
                </li>
                <li>To Do · {(draft.todos ?? []).filter((t) => t.title.trim()).length}</li>
                <li>
                  Knowledge ·{" "}
                  {(draft.importantDates ?? []).filter((d) => d.label.trim()).length +
                    (draft.knowledgeRemember ?? []).filter(
                      (k) => k.text.trim() && k.remember !== false,
                    ).length}
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="np-frames-primary">
        <IssueFrame
          items={draft.risks ?? []}
          projectTags={projectTags}
          onChange={(risks) => setDraft((prev) => ({ ...prev, risks, knowledgeRisks: risks.map((r) => r.title) }))}
        />
        <PeopleFrame
          items={draft.stakeholders ?? []}
          projectTags={projectTags}
          onChange={(stakeholders) => setDraft((prev) => ({ ...prev, stakeholders }))}
        />
        <TodoFrame
          items={draft.todos ?? []}
          projectTags={projectTags}
          onChange={(todos) => setDraft((prev) => ({ ...prev, todos }))}
        />
      </div>

      <KnowledgeFrame
        dates={draft.importantDates ?? []}
        facts={draft.knowledgeRemember ?? []}
        projectTags={projectTags}
        onChangeDates={(importantDates) =>
          setDraft((prev) => ({ ...prev, importantDates }))
        }
        onChangeFacts={(knowledgeRemember) =>
          setDraft((prev) => ({ ...prev, knowledgeRemember }))
        }
      />

      {needsYou.length ? (
        <p className="np-needs-you-summary" data-testid="np-needs-you-summary">
          <span className="np-needs-you-dot" aria-hidden />
          Needs you · {needsYou.length} optional{" "}
          {needsYou.length === 1 ? "question" : "questions"} — the project can
          still be created.
        </p>
      ) : (
        <p className="np-compose-reassure meta">
          Sparse is fine. You can teach Lume the rest as the project moves.
        </p>
      )}

      {error ? (
        <p className="error-copy" role="alert">
          {error}
        </p>
      ) : null}

      <div className="np-review-sticky">
        <p className="meta">Only a name and unique code are required.</p>
        <button
          type="submit"
          className="primary-btn np-create-btn"
          disabled={busy || !canCreate}
          data-testid="np-create-project"
        >
          {busy ? "Creating…" : "Create Project"}
        </button>
      </div>
    </form>
  );
}

function IssueFrame({
  items,
  projectTags,
  onChange,
}: {
  items: SetupRiskDraft[];
  projectTags: ProjectTag[];
  onChange: (items: SetupRiskDraft[]) => void;
}) {
  const [adding, setAdding] = useState("");
  return (
    <section className="ocean-knowledge-frame accent-risks" data-testid="np-frame-issues">
      <header className="ocean-knowledge-frame-header">
        <h3>Issues</h3>
      </header>
      <div className="ocean-knowledge-frame-body">
        <p className="np-frame-hint meta">
          Things affecting, threatening or obstructing the project.
        </p>
        {items.map((item, index) => (
          <ComposerRow
            key={item.clientKey ?? `issue-${index}`}
            needsYou={item.needsReview}
            needsYouText="Needs you — can you confirm this issue?"
          >
            <input
              className="np-compact-title"
              value={item.title}
              aria-label="Issue"
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...items];
                next[index] = { ...item, tags };
                onChange(next);
              }}
            />
            <RemoveButton onClick={() => onChange(items.filter((_, i) => i !== index))} />
          </ComposerRow>
        ))}
        <InlineAdd
          value={adding}
          placeholder="Add an issue"
          testId="np-add-issue"
          onChange={setAdding}
          onSubmit={() => {
            if (!adding.trim()) return;
            onChange([
              ...items,
              { clientKey: newSetupClientKey(), title: adding.trim() },
            ]);
            setAdding("");
          }}
        />
      </div>
    </section>
  );
}

function PeopleFrame({
  items,
  projectTags,
  onChange,
}: {
  items: SetupStakeholderDraft[];
  projectTags: ProjectTag[];
  onChange: (items: SetupStakeholderDraft[]) => void;
}) {
  const [name, setName] = useState("");
  return (
    <section className="ocean-knowledge-frame accent-people" data-testid="np-frame-people">
      <header className="ocean-knowledge-frame-header">
        <h3>People</h3>
      </header>
      <div className="ocean-knowledge-frame-body">
        <p className="np-frame-hint meta">
          People can hold several responsibilities. Responsibilities can be shared.
        </p>
        {items.map((item, index) => {
          const scopes = item.responsibilities ?? (item.role ? [item.role] : []);
          const missing = scopes.filter(Boolean).length === 0;
          return (
            <ComposerRow
              key={item.clientKey ?? `person-${index}`}
              needsYou={missing || item.needsReview}
              needsYouText={
                item.name.trim()
                  ? `Needs you — What is ${item.name.trim()} responsible for?`
                  : "Needs you — add a name"
              }
            >
              <input
                value={item.name}
                aria-label="Person name"
                placeholder="Name"
                onChange={(e) => {
                  const next = [...items];
                  next[index] = { ...item, name: e.target.value };
                  onChange(next);
                }}
              />
              <ResponsibilityEditor
                scopes={scopes}
                onChange={(responsibilities) => {
                  const next = [...items];
                  next[index] = {
                    ...item,
                    responsibilities,
                    role: responsibilities[0],
                    needsReview: responsibilities.length === 0,
                  };
                  onChange(next);
                }}
              />
              <TagEditor
                tags={item.tags ?? []}
                projectTags={projectTags}
                onChange={(tags) => {
                  const next = [...items];
                  next[index] = { ...item, tags };
                  onChange(next);
                }}
              />
              <RemoveButton onClick={() => onChange(items.filter((_, i) => i !== index))} />
            </ComposerRow>
          );
        })}
        <InlineAdd
          value={name}
          placeholder="Add a person"
          testId="np-add-person"
          onChange={setName}
          onSubmit={() => {
            if (!name.trim()) return;
            onChange([
              ...items,
              {
                clientKey: newSetupClientKey(),
                name: name.trim(),
                responsibilities: [],
                needsReview: true,
              },
            ]);
            setName("");
          }}
        />
      </div>
    </section>
  );
}

function TodoFrame({
  items,
  projectTags,
  onChange,
}: {
  items: SetupTodoDraft[];
  projectTags: ProjectTag[];
  onChange: (items: SetupTodoDraft[]) => void;
}) {
  const [adding, setAdding] = useState("");
  return (
    <section className="ocean-knowledge-frame accent-todo" data-testid="np-frame-todo">
      <header className="ocean-knowledge-frame-header">
        <h3>To Do</h3>
      </header>
      <div className="ocean-knowledge-frame-body">
        <p className="np-frame-hint meta">Things that already need to be progressed.</p>
        {items.map((item, index) => (
          <ComposerRow key={item.clientKey ?? `todo-${index}`}>
            <input
              className="np-compact-title"
              value={item.title}
              aria-label="To Do"
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
            <input
              type="date"
              aria-label="Due date"
              value={item.dueAt?.slice(0, 10) ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, dueAt: e.target.value || undefined };
                onChange(next);
              }}
            />
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...items];
                next[index] = { ...item, tags };
                onChange(next);
              }}
            />
            <RemoveButton onClick={() => onChange(items.filter((_, i) => i !== index))} />
          </ComposerRow>
        ))}
        <InlineAdd
          value={adding}
          placeholder="Add a to-do"
          testId="np-add-todo"
          onChange={setAdding}
          onSubmit={() => {
            if (!adding.trim()) return;
            onChange([
              ...items,
              {
                clientKey: newSetupClientKey(),
                title: adding.trim(),
                kind: "ACTION",
              },
            ]);
            setAdding("");
          }}
        />
      </div>
    </section>
  );
}

function KnowledgeFrame({
  dates,
  facts,
  projectTags,
  onChangeDates,
  onChangeFacts,
}: {
  dates: SetupDateDraft[];
  facts: SetupKnowledgeDraft[];
  projectTags: ProjectTag[];
  onChangeDates: (items: SetupDateDraft[]) => void;
  onChangeFacts: (items: SetupKnowledgeDraft[]) => void;
}) {
  const [mode, setMode] = useState<KnowledgeKind | null>(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  const addCurrent = () => {
    if (!mode || !text.trim()) return;
    if (mode === "date") {
      onChangeDates([
        ...dates,
        {
          clientKey: newSetupClientKey(),
          label: text.trim(),
          date: date || undefined,
          needsReview: !date,
        },
      ]);
    } else {
      onChangeFacts([
        ...facts,
        {
          clientKey: newSetupClientKey(),
          text: text.trim(),
          remember: true,
          kind: mode,
        },
      ]);
    }
    setText("");
    setDate("");
    setMode(null);
  };

  return (
    <section
      className="ocean-knowledge-frame accent-knowledge np-knowledge-frame"
      data-testid="np-frame-knowledge"
    >
      <header className="ocean-knowledge-frame-header">
        <h3>Knowledge</h3>
      </header>
      <div className="ocean-knowledge-frame-body">
        <p className="np-frame-hint meta">
          Things Lume should remember — milestones, decisions, and project context.
        </p>
        {dates.map((item, index) => (
          <ComposerRow
            key={item.clientKey ?? `date-${index}`}
            needsYou={!item.date || item.needsReview}
            needsYouText={`Needs you — When is the ${item.label.trim() || "milestone"}?`}
          >
            <span className="np-kind-pill">Milestone</span>
            <input
              className="np-compact-title"
              value={item.label}
              aria-label="Milestone"
              onChange={(e) => {
                const next = [...dates];
                next[index] = { ...item, label: e.target.value };
                onChangeDates(next);
              }}
            />
            <input
              type="date"
              value={item.date?.slice(0, 10) ?? ""}
              aria-label="Milestone date"
              onChange={(e) => {
                const next = [...dates];
                next[index] = {
                  ...item,
                  date: e.target.value || undefined,
                  needsReview: !e.target.value,
                };
                onChangeDates(next);
              }}
            />
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...dates];
                next[index] = { ...item, tags };
                onChangeDates(next);
              }}
            />
            <RemoveButton onClick={() => onChangeDates(dates.filter((_, i) => i !== index))} />
          </ComposerRow>
        ))}
        {facts.map((item, index) => (
          <ComposerRow
            key={item.clientKey ?? `fact-${index}`}
            needsYou={item.needsReview}
            needsYouText={item.needsYouQuestion || "Needs you"}
          >
            <span className="np-kind-pill">
              {item.kind === "decision" ? "Decision" : "Context"}
            </span>
            <input
              className="np-compact-title"
              value={item.text}
              aria-label="Knowledge"
              onChange={(e) => {
                const next = [...facts];
                next[index] = { ...item, text: e.target.value };
                onChangeFacts(next);
              }}
            />
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...facts];
                next[index] = { ...item, tags };
                onChangeFacts(next);
              }}
            />
            <RemoveButton onClick={() => onChangeFacts(facts.filter((_, i) => i !== index))} />
          </ComposerRow>
        ))}
        <div className="np-knowledge-add">
          {mode ? (
            <div className="np-inline-add is-open">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  mode === "date"
                    ? "Milestone name"
                    : mode === "decision"
                      ? "Decision"
                      : "Something Lume should remember"
                }
                aria-label="New knowledge"
              />
              {mode === "date" ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Milestone date"
                />
              ) : null}
              <button type="button" className="primary-btn" onClick={addCurrent}>
                Add
              </button>
              <button type="button" className="ghost-btn" onClick={() => setMode(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="np-knowledge-add-actions">
              <button type="button" className="ghost-btn" onClick={() => setMode("date")}>
                + Milestone
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setMode("decision")}
              >
                + Decision
              </button>
              <button type="button" className="ghost-btn" onClick={() => setMode("fact")}>
                + Context
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ComposerRow({
  children,
  needsYou,
  needsYouText,
}: {
  children: ReactNode;
  needsYou?: boolean;
  needsYouText?: string;
}) {
  return (
    <div className={`np-composer-row ${needsYou ? "is-needs-you" : ""}`}>
      {children}
      {needsYou ? (
        <p className="np-needs-you-inline">
          <span className="np-needs-you-dot" aria-hidden />
          {needsYouText}
        </p>
      ) : null}
    </div>
  );
}

function InlineAdd({
  value,
  placeholder,
  onChange,
  onSubmit,
  testId,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  testId?: string;
}) {
  return (
    <div className="np-inline-add">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        data-testid={testId}
      />
      <button type="button" className="ghost-btn" onClick={onSubmit}>
        Add
      </button>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ghost-btn np-row-remove" onClick={onClick}>
      Remove
    </button>
  );
}

function TagEditor({
  tags,
  projectTags,
  onChange,
}: {
  tags: string[];
  projectTags: ProjectTag[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <TagChips
      tags={tags}
      projectTags={projectTags}
      onAdd={(name) => onChange(dedupeTagNames([...tags, name]))}
      onRemove={(name) =>
        onChange(tags.filter((t) => tagSlug(t) !== tagSlug(name)))
      }
    />
  );
}

function ResponsibilityEditor({
  scopes,
  onChange,
}: {
  scopes: string[];
  onChange: (scopes: string[]) => void;
}) {
  const [adding, setAdding] = useState("");
  return (
    <div className="np-scope-chips">
      {scopes.filter(Boolean).map((scope) => (
        <button
          key={scope}
          type="button"
          className="tag-chip"
          onClick={() => onChange(scopes.filter((s) => s !== scope))}
        >
          {scope}
          <span aria-hidden>×</span>
        </button>
      ))}
      <input
        value={adding}
        placeholder="Add responsibility"
        aria-label="Add responsibility"
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && adding.trim()) {
            e.preventDefault();
            onChange([...scopes.filter(Boolean), adding.trim()]);
            setAdding("");
          }
        }}
      />
    </div>
  );
}
