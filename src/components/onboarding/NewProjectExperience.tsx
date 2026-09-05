"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { LumeLogo } from "@/components/brand/LumeLogo";
import "./new-project-ocean.css";
import {
  newSetupClientKey,
  suggestCode,
  type CreateProjectInput,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";
import { mergeOrganisedDraft } from "@/lib/new-project/merge-organised";
import { needsYouFromDraft } from "@/lib/new-project/needs-you";
import { useMission } from "@/lib/store";

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

export function NewProjectExperience({
  variant = "page",
}: {
  variant?: "first-run" | "page";
}) {
  const router = useRouter();
  const { createProject } = useMission();
  const [draft, setDraft] = useState<CreateProjectInput>(emptyDraft);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [organiseOpen, setOrganiseOpen] = useState(false);
  const createLockRef = useRef(false);
  const clientProjectIdRef = useRef<string | null>(null);
  const organiseAbortRef = useRef<AbortController | null>(null);

  const needsYou = useMemo(() => needsYouFromDraft(draft), [draft]);

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

  async function organiseNotes() {
    const content = notes.trim();
    if (!content) {
      setError("Paste some notes first.");
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
          { codeLocked: Boolean(current.code.trim()) },
        ),
      );
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
    void createFromDraft({
      ...draft,
      code: draft.code.trim() || suggestCode(draft.name),
      sourceMode: "compose",
    });
  }

  return (
    <div
      className={`np-experience ${variant === "first-run" ? "is-first-run" : ""}`}
      data-testid="np-experience"
      data-np-variant={variant}
    >
      <header className="np-hero">
        <LumeLogo className="np-hero-logo" />
        <p className="np-brand">LUME</p>
        <h1 className="np-hero-title">Tell Lume what this project is about</h1>
        <p className="np-hero-sub">Add what you know now. Organise notes when you want help.</p>
      </header>

      <div className="np-four-frame" data-testid="np-four-frame">
        <section className="np-identity">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  name: e.target.value,
                  code: d.code || suggestCode(e.target.value),
                }))
              }
              data-testid="np-name"
            />
          </label>
          <label>
            Code
            <input
              value={draft.code}
              onChange={(e) =>
                setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))
              }
              data-testid="np-code"
            />
          </label>
          <label>
            Summary
            <textarea
              value={draft.summary}
              onChange={(e) =>
                setDraft((d) => ({ ...d, summary: e.target.value }))
              }
              data-testid="np-summary"
            />
          </label>
        </section>

        <details
          className="np-organise"
          open={organiseOpen}
          onToggle={(e) => setOrganiseOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Organise notes</summary>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste a brief, email, or notes…"
            data-testid="np-organise-notes"
          />
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void organiseNotes()}
            data-testid="np-organise"
          >
            {busy ? "Organising…" : "Organise"}
          </button>
        </details>

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
            items={(draft.risks ?? []).map((r) => r.title)}
            onAdd={(title) =>
              setDraft((d) => ({
                ...d,
                risks: [
                  ...(d.risks ?? []),
                  { clientKey: newSetupClientKey(), title } satisfies SetupRiskDraft,
                ],
              }))
            }
            onRemove={(i) =>
              setDraft((d) => ({
                ...d,
                risks: (d.risks ?? []).filter((_, idx) => idx !== i),
              }))
            }
          />
          <ComposeFrame
            title="People"
            testId="np-frame-people"
            addLabel="Add person"
            items={(draft.stakeholders ?? []).map((s) => s.name)}
            onAdd={(name) =>
              setDraft((d) => ({
                ...d,
                stakeholders: [
                  ...(d.stakeholders ?? []),
                  {
                    clientKey: newSetupClientKey(),
                    name,
                    responsibilities: [],
                    needsReview: true,
                  } satisfies SetupStakeholderDraft,
                ],
              }))
            }
            onRemove={(i) =>
              setDraft((d) => ({
                ...d,
                stakeholders: (d.stakeholders ?? []).filter((_, idx) => idx !== i),
              }))
            }
          />
          <ComposeFrame
            title="To Do"
            testId="np-frame-todo"
            addLabel="Add to do"
            items={(draft.todos ?? []).map((t) => t.title)}
            onAdd={(title) =>
              setDraft((d) => ({
                ...d,
                todos: [
                  ...(d.todos ?? []),
                  { clientKey: newSetupClientKey(), title } satisfies SetupTodoDraft,
                ],
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
            items={[
              ...(draft.importantDates ?? []).map((d) => d.label),
              ...(draft.knowledgeRemember ?? []).map((k) => k.text),
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

        {error ? (
          <p className="np-create-error" data-testid="np-create-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="np-create-row">
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !draft.name.trim()}
            onClick={onCreate}
            data-testid="np-create"
          >
            {busy ? "Creating…" : "Create Project"}
          </button>
        </div>
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

function ComposeFrame({
  title,
  testId,
  addLabel,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  testId: string;
  addLabel: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <section className="np-frame" data-testid={testId}>
      <h2>{title}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <span>{item}</span>
            <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${item}`}>
              ×
            </button>
          </li>
        ))}
      </ul>
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
