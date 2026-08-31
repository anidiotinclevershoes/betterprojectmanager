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
import {
  needsYouFromDraft,
  personResponsibilityQuestion,
  uncertainRiskQuestion,
  uncertainTodoQuestion,
  undatedMilestoneQuestion,
} from "@/lib/new-project/needs-you";
import type { ProvisionalItem } from "@/lib/new-project-v2";
import { useMission } from "@/lib/store";
import { dedupeTagNames, tagSlug, type ProjectTag } from "@/lib/tags";

type KnowledgeKind = NonNullable<SetupKnowledgeDraft["kind"]>;

/** Same neutral domain icons as Review CompactChangeCard — not colour. */
const FRAME_ICON = {
  issues: "⚠",
  people: "◎",
  todo: "☑",
  knowledge: "☰",
  date: "◆",
  decision: "◇",
  fact: "☰",
} as const;

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
  const canCreate =
    Boolean(draft.name.trim()) && Boolean(draft.code.trim()) && !codeTaken;
  const needsYou = useMemo(() => needsYouFromDraft(draft), [draft]);
  const projectTags = useMemo(() => draftProjectTags(draft), [draft]);
  const foundCount =
    (draft.risks ?? []).filter((r) => r.title.trim()).length +
    (draft.stakeholders ?? []).filter((s) => s.name.trim()).length +
    (draft.todos ?? []).filter((t) => t.title.trim()).length +
    (draft.importantDates ?? []).filter((d) => d.label.trim()).length +
    (draft.knowledgeRemember ?? []).filter(
      (k) => k.text.trim() && k.remember !== false,
    ).length;

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
        <h1 className="np-compose-title">New Project</h1>
        <p className="np-compose-lead">
          Add what you know now. Lume can build on it as the project moves.
        </p>
      </header>

      <section className="np-identity" data-testid="np-identity">
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
        ) : draft.code.trim() ? (
          <p className="field-hint" data-testid="np-code-available">
            Available
          </p>
        ) : null}
      </section>

      <section className="np-organiser" data-testid="np-organiser">
        <button
          type="button"
          className="np-organiser-toggle"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((v) => !v)}
        >
          <span className="np-organiser-chevron" aria-hidden>
            ▸
          </span>
          Have some notes already?
        </button>
        {notesOpen ? (
          <div className="np-organiser-body">
            <label className="field">
              Paste them here and Lume can organise what it recognises.
              <textarea
                rows={4}
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
              Creates editable proposals only. Nothing is saved until you create the project.
              {openaiConfigured === false ? " Local organisation." : ""}
            </p>
          </div>
        ) : null}
        {organiseSummary ? (
          <div className="np-organise-found" data-testid="np-organise-found">
            <p>
              <strong>{organiseSummary}</strong>
              {foundCount ? (
                <span className="np-organise-found-meta">
                  {" "}
                  Issues {(draft.risks ?? []).filter((r) => r.title.trim()).length}
                  {" · "}
                  People{" "}
                  {(draft.stakeholders ?? []).filter((s) => s.name.trim()).length}
                  {" · "}
                  To Do {(draft.todos ?? []).filter((t) => t.title.trim()).length}
                  {" · "}
                  Knowledge{" "}
                  {(draft.importantDates ?? []).filter((d) => d.label.trim())
                    .length +
                    (draft.knowledgeRemember ?? []).filter(
                      (k) => k.text.trim() && k.remember !== false,
                    ).length}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}
      </section>

      <div className="np-frames-primary">
        <IssueFrame
          items={draft.risks ?? []}
          projectTags={projectTags}
          onChange={(risks) =>
            setDraft((prev) => ({
              ...prev,
              risks,
              knowledgeRisks: risks.map((r) => r.title),
            }))
          }
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

      {error ? (
        <p className="error-copy" role="alert">
          {error}
        </p>
      ) : null}

      <div className="np-create-bar">
        <div className="np-create-copy">
          {needsYou.length ? (
            <p className="np-needs-you-summary" data-testid="np-needs-you-summary">
              <span className="np-needs-you-dot" aria-hidden />
              Needs You {needsYou.length}
            </p>
          ) : null}
          <p className="meta">You can add more at any time.</p>
          <p className="meta">After this, Capture keeps the project current.</p>
        </div>
        <div className="np-create-actions">
          {variant === "page" && state.projects.length > 0 ? (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => router.back()}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            className="primary-btn np-create-btn"
            disabled={busy || !canCreate}
            data-testid="np-create-project"
          >
            {busy ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FrameShell({
  icon,
  title,
  testId,
  wide,
  children,
}: {
  icon: string;
  title: string;
  testId: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`np-frame ${wide ? "is-wide" : ""}`}
      data-testid={testId}
    >
      <header className="np-frame-head">
        <span className="compact-change-ico" aria-hidden>
          {icon}
        </span>
        <h3>{title}</h3>
      </header>
      <div className="np-frame-body">{children}</div>
    </section>
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
  return (
    <FrameShell icon={FRAME_ICON.issues} title="Issues" testId="np-frame-issues">
      {items.map((item, index) => (
        <ItemCard
          key={item.clientKey ?? `issue-${index}`}
          typeLabel="Issue"
          icon={FRAME_ICON.issues}
          needsYou={item.needsReview}
          needsYouText={
            item.title.trim()
              ? uncertainRiskQuestion(item.title)
              : "Needs You"
          }
          title={
            <input
              className="np-item-title"
              value={item.title}
              aria-label="Issue"
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
          }
          tags={
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...items];
                next[index] = { ...item, tags };
                onChange(next);
              }}
            />
          }
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        />
      ))}
      <InlineAdd
        label="Add issue"
        placeholder="Supplier capacity may be limited"
        testId="np-add-issue"
        onSubmit={(title) =>
          onChange([
            ...items,
            { clientKey: newSetupClientKey(), title },
          ])
        }
      />
    </FrameShell>
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
  return (
    <FrameShell icon={FRAME_ICON.people} title="People" testId="np-frame-people">
      {items.map((item, index) => {
        const scopes = item.responsibilities ?? (item.role ? [item.role] : []);
        const missing = scopes.filter(Boolean).length === 0;
        return (
          <ItemCard
            key={item.clientKey ?? `person-${index}`}
            typeLabel="Person"
            icon={FRAME_ICON.people}
            needsYou={missing || item.needsReview}
            needsYouText={
              item.name.trim()
                ? personResponsibilityQuestion(item.name)
                : "Needs You — add a name"
            }
            title={
              <input
                className="np-item-title"
                value={item.name}
                aria-label="Person name"
                placeholder="Name"
                onChange={(e) => {
                  const next = [...items];
                  next[index] = { ...item, name: e.target.value };
                  onChange(next);
                }}
              />
            }
            supporting={
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
            }
            tags={
              <TagEditor
                tags={item.tags ?? []}
                projectTags={projectTags}
                onChange={(tags) => {
                  const next = [...items];
                  next[index] = { ...item, tags };
                  onChange(next);
                }}
              />
            }
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        );
      })}
      <InlineAdd
        label="Add person"
        placeholder="Sarah Murphy"
        testId="np-add-person"
        onSubmit={(name) =>
          onChange([
            ...items,
            {
              clientKey: newSetupClientKey(),
              name,
              responsibilities: [],
              needsReview: true,
            },
          ])
        }
      />
    </FrameShell>
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
  return (
    <FrameShell icon={FRAME_ICON.todo} title="To Do" testId="np-frame-todo">
      {items.map((item, index) => (
        <ItemCard
          key={item.clientKey ?? `todo-${index}`}
          typeLabel="To Do"
          icon={FRAME_ICON.todo}
          needsYou={item.needsReview}
          needsYouText={
            item.title.trim()
              ? uncertainTodoQuestion(item.title)
              : "Needs You"
          }
          title={
            <input
              className="np-item-title"
              value={item.title}
              aria-label="To Do"
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
          }
          supporting={
            <OptionalDate
              label="Due"
              ariaLabel="Due date"
              value={item.dueAt?.slice(0, 10)}
              onChange={(dueAt) => {
                const next = [...items];
                next[index] = { ...item, dueAt };
                onChange(next);
              }}
            />
          }
          tags={
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...items];
                next[index] = { ...item, tags };
                onChange(next);
              }}
            />
          }
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        />
      ))}
      <InlineAdd
        label="Add To Do"
        placeholder="Confirm file format with IT"
        testId="np-add-todo"
        onSubmit={(title) =>
          onChange([
            ...items,
            {
              clientKey: newSetupClientKey(),
              title,
              kind: "ACTION",
            },
          ])
        }
      />
    </FrameShell>
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
  const [mode, setMode] = useState<KnowledgeKind | "date" | null>(null);
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
    <FrameShell
      icon={FRAME_ICON.knowledge}
      title="Knowledge"
      testId="np-frame-knowledge"
      wide
    >
      <div className="np-knowledge-add">
        {mode ? (
          <div className="np-inline-add is-open">
            <input
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCurrent();
                }
                if (e.key === "Escape") setMode(null);
              }}
              placeholder={
                mode === "date"
                  ? "UAT target"
                  : mode === "decision"
                    ? "Claims will be uploaded through DocuFlow."
                    : "Initial delivery is web only."
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
            <button type="button" className="np-add-btn" onClick={() => setMode("date")}>
              + Milestone / Date
            </button>
            <button
              type="button"
              className="np-add-btn"
              onClick={() => setMode("decision")}
            >
              + Decision
            </button>
            <button type="button" className="np-add-btn" onClick={() => setMode("fact")}>
              + Information
            </button>
          </div>
        )}
      </div>
      {dates.map((item, index) => (
        <ItemCard
          key={item.clientKey ?? `date-${index}`}
          typeLabel="Milestone / Date"
          icon={FRAME_ICON.date}
          needsYou={!item.date || item.needsReview}
          needsYouText={undatedMilestoneQuestion(item.label || "milestone")}
          title={
            <input
              className="np-item-title"
              value={item.label}
              aria-label="Milestone"
              onChange={(e) => {
                const next = [...dates];
                next[index] = { ...item, label: e.target.value };
                onChangeDates(next);
              }}
            />
          }
          supporting={
            <label className="np-item-date">
              <span className="np-item-date-label">Date</span>
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
            </label>
          }
          tags={
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...dates];
                next[index] = { ...item, tags };
                onChangeDates(next);
              }}
            />
          }
          onRemove={() => onChangeDates(dates.filter((_, i) => i !== index))}
        />
      ))}
      {facts.map((item, index) => (
        <ItemCard
          key={item.clientKey ?? `fact-${index}`}
          typeLabel={item.kind === "decision" ? "Decision" : "Information"}
          icon={item.kind === "decision" ? FRAME_ICON.decision : FRAME_ICON.fact}
          needsYou={item.needsReview}
          needsYouText={item.needsYouQuestion || "Needs You"}
          title={
            <input
              className="np-item-title"
              value={item.text}
              aria-label="Knowledge"
              onChange={(e) => {
                const next = [...facts];
                next[index] = { ...item, text: e.target.value };
                onChangeFacts(next);
              }}
            />
          }
          tags={
            <TagEditor
              tags={item.tags ?? []}
              projectTags={projectTags}
              onChange={(tags) => {
                const next = [...facts];
                next[index] = { ...item, tags };
                onChangeFacts(next);
              }}
            />
          }
          onRemove={() => onChangeFacts(facts.filter((_, i) => i !== index))}
        />
      ))}
    </FrameShell>
  );
}

function ItemCard({
  typeLabel,
  icon,
  title,
  supporting,
  tags,
  needsYou,
  needsYouText,
  onRemove,
}: {
  typeLabel: string;
  icon?: string;
  title: ReactNode;
  supporting?: ReactNode;
  tags?: ReactNode;
  needsYou?: boolean;
  needsYouText?: string;
  onRemove: () => void;
}) {
  return (
    <article
      className={`np-item compact-change-card ${needsYou ? "is-emphasized" : ""}`}
    >
      <header className="compact-change-head">
        <div className="compact-change-entity">
          {icon ? (
            <span className="compact-change-ico" aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="compact-change-titles">
            <p className="compact-change-type">{typeLabel}</p>
            {title}
          </div>
        </div>
        <button
          type="button"
          className="np-item-remove"
          onClick={onRemove}
          aria-label="Remove"
        >
          ×
        </button>
      </header>
      {supporting ? <div className="np-item-support">{supporting}</div> : null}
      {needsYou ? (
        <p className="np-needs-you-inline">
          <span className="np-needs-you-dot" aria-hidden />
          Needs You — {needsYouText?.replace(/^Needs You — /i, "") ?? "Lume noticed what's missing."}
        </p>
      ) : null}
      {tags ? <div className="np-item-tags">{tags}</div> : null}
    </article>
  );
}

function InlineAdd({
  label,
  placeholder,
  onSubmit,
  testId,
}: {
  label: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const commit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type="button"
        className="np-add-btn"
        onClick={() => setOpen(true)}
        data-testid={testId}
      >
        + {label}
      </button>
    );
  }
  return (
    <div className="np-inline-add is-open">
      <input
        value={value}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setOpen(false);
            setValue("");
          }
        }}
        data-testid={testId}
        aria-label={label}
      />
      <button type="button" className="primary-btn" onClick={commit}>
        Add
      </button>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => {
          setOpen(false);
          setValue("");
        }}
      >
        Cancel
      </button>
    </div>
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

function OptionalDate({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(Boolean(value));
  if (!open && !value) {
    return (
      <button type="button" className="np-add-btn" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  }
  return (
    <label className="np-item-date">
      <span className="np-item-date-label">{label}</span>
      <input
        type="date"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </label>
  );
}

function ResponsibilityEditor({
  scopes,
  onChange,
}: {
  scopes: string[];
  onChange: (scopes: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const listed = scopes.filter(Boolean);
  const commit = () => {
    if (!value.trim()) return;
    onChange([...listed, value.trim()]);
    setValue("");
  };
  return (
    <div className="np-scopes">
      {listed.length ? (
        <p className="np-scope-line">
          {listed.map((scope, index) => (
            <span key={`${scope}-${index}`}>
              {index > 0 ? <span className="np-scope-sep"> · </span> : null}
              <button
                type="button"
                className="np-scope"
                onClick={() => onChange(listed.filter((s) => s !== scope))}
                aria-label={`Remove ${scope}`}
              >
                {scope}
              </button>
            </span>
          ))}
        </p>
      ) : null}
      {adding ? (
        <input
          className="np-scope-input"
          value={value}
          autoFocus
          placeholder="Product Owner"
          aria-label="Add responsibility"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setAdding(false);
              setValue("");
            }
          }}
          onBlur={() => {
            if (value.trim()) commit();
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="np-add-btn"
          onClick={() => setAdding(true)}
        >
          + Add responsibility
        </button>
      )}
    </div>
  );
}
