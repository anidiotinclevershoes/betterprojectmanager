"use client";

import { useMemo, useState } from "react";
import {
  countSetupItems,
  includedItemCount,
  suggestCode,
  type CreateProjectInput,
  type SetupDateDraft,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";
import type { TodoKind } from "@/lib/types";

export function ProjectSetupReview({
  draft,
  onChange,
  onConfirm,
  onBack,
  busy,
  error,
}: {
  draft: CreateProjectInput;
  onChange: (next: CreateProjectInput) => void;
  onConfirm: () => void;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const counts = countSetupItems(draft);
  const included = includedItemCount(draft);
  const [open, setOpen] = useState({
    project: true,
    dates: true,
    todos: true,
    risks: true,
    stakeholders: true,
    knowledge: true,
  });

  const remember = draft.knowledgeRemember ?? [];

  return (
    <div className="np-review">
      <header className="np-review-head">
        <p className="np-kicker">Project setup review</p>
        <h2 className="np-review-title">Here&apos;s the project Lume built</h2>
        <p className="np-review-lead">
          Review anything you&apos;d like to change. Nothing will be created until
          you confirm.
        </p>
      </header>

      <div className="np-review-summary" aria-label="Extraction summary">
        <p className="np-review-summary-label">Lume found</p>
        <ul className="np-review-summary-stats">
          <li>
            <strong>{counts.todos}</strong> To Dos
          </li>
          <li>
            <strong>{counts.risks}</strong> Risks
          </li>
          <li>
            <strong>{counts.stakeholders}</strong> Stakeholders
          </li>
          <li>
            <strong>{counts.dates}</strong> important dates
          </li>
          <li>
            <strong>{counts.knowledge}</strong> things worth remembering
          </li>
        </ul>
      </div>

      <Section
        id="project"
        title="Project"
        open={open.project}
        onToggle={() => setOpen((s) => ({ ...s, project: !s.project }))}
      >
        <label className="field">
          Project name
          <input
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value;
              onChange({
                ...draft,
                name,
                code: draft.code || suggestCode(name),
              });
            }}
          />
        </label>
        <label className="field">
          Code
          <input
            value={draft.code}
            onChange={(e) =>
              onChange({
                ...draft,
                code: e.target.value.toUpperCase().slice(0, 12),
              })
            }
          />
        </label>
        <label className="field">
          Objective
          <textarea
            rows={3}
            value={draft.summary}
            onChange={(e) => onChange({ ...draft, summary: e.target.value })}
          />
        </label>
        <label className="field">
          Current focus
          <input
            value={draft.currentFocus}
            onChange={(e) =>
              onChange({ ...draft, currentFocus: e.target.value })
            }
          />
        </label>
      </Section>

      <Section
        id="dates"
        title={`Important dates · ${counts.dates}`}
        open={open.dates}
        onToggle={() => setOpen((s) => ({ ...s, dates: !s.dates }))}
      >
        <DateList
          items={draft.importantDates ?? []}
          onChange={(importantDates) => onChange({ ...draft, importantDates })}
        />
      </Section>

      <Section
        id="todos"
        title={`To Do · ${counts.todos}`}
        open={open.todos}
        onToggle={() => setOpen((s) => ({ ...s, todos: !s.todos }))}
      >
        <TodoList
          items={draft.todos ?? []}
          onChange={(todos) => onChange({ ...draft, todos })}
        />
      </Section>

      <Section
        id="risks"
        title={`Risks · ${counts.risks}`}
        open={open.risks}
        onToggle={() => setOpen((s) => ({ ...s, risks: !s.risks }))}
      >
        <RiskList
          items={
            draft.risks ??
            (draft.knowledgeRisks ?? []).map((title) => ({ title }))
          }
          onChange={(risks) =>
            onChange({
              ...draft,
              risks,
              knowledgeRisks: risks.map((r) => r.title),
            })
          }
        />
      </Section>

      <Section
        id="stakeholders"
        title={`Stakeholders · ${counts.stakeholders}`}
        open={open.stakeholders}
        onToggle={() =>
          setOpen((s) => ({ ...s, stakeholders: !s.stakeholders }))
        }
      >
        <StakeholderList
          items={draft.stakeholders ?? []}
          onChange={(stakeholders) => onChange({ ...draft, stakeholders })}
        />
      </Section>

      <Section
        id="knowledge"
        title="Things Lume will remember"
        badge="Knowledge"
        open={open.knowledge}
        onToggle={() => setOpen((s) => ({ ...s, knowledge: !s.knowledge }))}
        emphasis
      >
        <p className="np-knowledge-intro meta">
          These are useful project facts Lume can use later in Capture, Coach
          and Meeting Prep.
        </p>
        <KnowledgeList
          items={
            remember.length
              ? remember
              : [
                  ...(draft.knowledgeDecisions ?? []),
                  ...(draft.knowledgeNow ?? []),
                ].map((text) => ({ text, remember: true }))
          }
          onChange={(knowledgeRemember) =>
            onChange({ ...draft, knowledgeRemember })
          }
        />
      </Section>

      {(draft.notMentioned?.length ?? 0) > 0 ? (
        <div className="np-not-mentioned">
          <p className="np-not-mentioned-title">Not mentioned yet</p>
          <ul>
            {draft.notMentioned!.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="meta">You can add these later.</p>
        </div>
      ) : null}

      {error ? <p className="error-copy">{error}</p> : null}

      <div className="np-review-sticky">
        <button type="button" className="ghost-btn" onClick={onBack} disabled={busy}>
          Back
        </button>
        <div className="np-review-sticky-main">
          <p className="meta">
            {included} item{included === 1 ? "" : "s"} will be added · You can
            change everything later.
          </p>
          <button
            type="button"
            className="primary-btn np-create-btn"
            onClick={onConfirm}
            disabled={busy || !draft.name.trim()}
          >
            {busy ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  open,
  onToggle,
  children,
  emphasis,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <section
      className={`np-section ${emphasis ? "is-emphasis" : ""} ${open ? "is-open" : ""}`}
    >
      <button type="button" className="np-section-toggle" onClick={onToggle}>
        <span>
          {title}
          {badge ? <span className="np-section-badge">{badge}</span> : null}
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="np-section-body">{children}</div> : null}
    </section>
  );
}

function TodoList({
  items,
  onChange,
}: {
  items: SetupTodoDraft[];
  onChange: (items: SetupTodoDraft[]) => void;
}) {
  return (
    <div className="np-compact-list">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className={`np-compact-row ${item.needsReview ? "is-needs-review" : ""}`}
        >
          <input
            className="np-compact-title"
            value={item.title}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, title: e.target.value };
              onChange(next);
            }}
          />
          <select
            value={item.kind ?? "ACTION"}
            aria-label="To Do kind"
            onChange={(e) => {
              const next = [...items];
              next[index] = {
                ...item,
                kind: e.target.value as TodoKind,
              };
              onChange(next);
            }}
          >
            <option value="ACTION">Action</option>
            <option value="WAITING">Waiting</option>
            <option value="CHASE">Chase</option>
            <option value="REMINDER">Reminder</option>
          </select>
          <input
            type="date"
            value={item.dueAt?.slice(0, 10) ?? ""}
            onChange={(e) => {
              const next = [...items];
              next[index] = {
                ...item,
                dueAt: e.target.value || undefined,
              };
              onChange(next);
            }}
          />
          {item.needsReview ? (
            <span className="np-needs-review">Needs Review</span>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost-btn"
        onClick={() =>
          onChange([...items, { title: "New To Do", kind: "ACTION" }])
        }
      >
        + Add
      </button>
    </div>
  );
}

function RiskList({
  items,
  onChange,
}: {
  items: SetupRiskDraft[];
  onChange: (items: SetupRiskDraft[]) => void;
}) {
  return (
    <div className="np-compact-list">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className={`np-compact-row ${item.needsReview ? "is-needs-review" : ""}`}
        >
          <input
            className="np-compact-title"
            value={item.title}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, title: e.target.value };
              onChange(next);
            }}
          />
          {item.needsReview ? (
            <span className="np-needs-review">Needs Review</span>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost-btn"
        onClick={() => onChange([...items, { title: "New risk" }])}
      >
        + Add Risk
      </button>
    </div>
  );
}

function StakeholderList({
  items,
  onChange,
}: {
  items: SetupStakeholderDraft[];
  onChange: (items: SetupStakeholderDraft[]) => void;
}) {
  return (
    <div className="np-compact-list np-stakeholder-list">
      {items.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          className={`np-compact-row ${item.needsReview ? "is-needs-review" : ""}`}
        >
          <input
            value={item.name}
            aria-label="Stakeholder name"
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            value={item.role ?? ""}
            aria-label="Role"
            placeholder="Role"
            onChange={(e) => {
              const next = [...items];
              next[index] = {
                ...item,
                role: e.target.value,
                needsReview: false,
              };
              onChange(next);
            }}
          />
          {item.needsReview ? (
            <span className="np-needs-review">
              {item.role && item.role !== item.name
                ? `${item.role}?`
                : "Needs Review"}
            </span>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost-btn"
        onClick={() =>
          onChange([...items, { name: "", role: "Stakeholder" }])
        }
      >
        + Add
      </button>
    </div>
  );
}

function DateList({
  items,
  onChange,
}: {
  items: SetupDateDraft[];
  onChange: (items: SetupDateDraft[]) => void;
}) {
  return (
    <div className="np-compact-list np-date-list">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={`np-compact-row ${item.needsReview ? "is-needs-review" : ""}`}
        >
          <input
            className="np-compact-title"
            value={item.label}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, label: e.target.value };
              onChange(next);
            }}
          />
          <input
            type="date"
            value={item.date?.slice(0, 10) ?? ""}
            onChange={(e) => {
              const next = [...items];
              next[index] = {
                ...item,
                date: e.target.value || undefined,
                needsReview: false,
              };
              onChange(next);
            }}
          />
          {item.needsReview ? (
            <span className="np-needs-review">Needs Review</span>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost-btn"
        onClick={() => onChange([...items, { label: "New date" }])}
      >
        + Add
      </button>
    </div>
  );
}

function KnowledgeList({
  items,
  onChange,
}: {
  items: SetupKnowledgeDraft[];
  onChange: (items: SetupKnowledgeDraft[]) => void;
}) {
  const pending = useMemo(
    () => items.filter((i) => i.remember !== false),
    [items],
  );

  return (
    <div className="np-remember-list">
      {items.map((item, index) => (
        <div
          key={`${item.text}-${index}`}
          className={`np-remember-row ${item.remember === false ? "is-skipped" : ""}`}
        >
          <span className="np-remember-check" aria-hidden>
            {item.remember === false ? "·" : "✓"}
          </span>
          <input
            className="np-remember-text"
            value={item.text}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, text: e.target.value };
              onChange(next);
            }}
          />
          <div className="np-remember-actions">
            {item.remember === false ? (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const next = [...items];
                  next[index] = { ...item, remember: true };
                  onChange(next);
                }}
              >
                Remember
              </button>
            ) : (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  const next = [...items];
                  next[index] = { ...item, remember: false };
                  onChange(next);
                }}
              >
                Don&apos;t Remember
              </button>
            )}
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {pending.length > 1 ? (
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            onChange(items.map((i) => ({ ...i, remember: true })))
          }
        >
          Remember All
        </button>
      ) : null}
      <button
        type="button"
        className="ghost-btn"
        onClick={() =>
          onChange([...items, { text: "New durable fact", remember: true }])
        }
      >
        + Add
      </button>
    </div>
  );
}
