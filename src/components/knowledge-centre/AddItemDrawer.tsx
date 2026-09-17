"use client";

import { useState } from "react";
import { ItemTagsEditor } from "@/components/knowledge-centre/ItemTagsEditor";
import { useMission } from "@/lib/store";
import type { ManualItemType } from "@/lib/store";

const TYPES: Array<{ id: ManualItemType; label: string }> = [
  { id: "issue", label: "Issue" },
  { id: "person", label: "Person" },
  { id: "todo", label: "To Do" },
  { id: "knowledge", label: "Knowledge" },
];

export function AddItemDrawer({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { state, addManualItem, saveItemTags } = useMission();
  const [type, setType] = useState<ManualItemType>("todo");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function reset() {
    setTitle("");
    setDetail("");
    setTags([]);
    setError(null);
    setType("todo");
  }

  async function onSave() {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Enter a title before saving.");
      return;
    }
    setBusy(true);
    try {
      const created = await addManualItem({
        projectId,
        type,
        title: trimmed,
        detail: detail.trim() || undefined,
      });
      if (!created.ok || !created.id) {
        setError(created.error ?? "Could not save item.");
        return;
      }
      if (type !== "person" && tags.length) {
        const tagged = await saveItemTags({
          projectId,
          targetKind:
            type === "issue"
              ? "risk"
              : type === "todo"
                ? "todo"
                : "knowledge_item",
          targetId: created.id,
          names: tags,
        });
        if (!tagged.ok) {
          setError(
            tagged.error ??
              "Item saved. Tags could not be attached.",
          );
          return;
        }
      }
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="ocean-item-detail-backdrop"
        aria-label="Close add item"
        onClick={() => {
          if (!busy) {
            reset();
            onClose();
          }
        }}
      />
      <aside
        className="ocean-item-detail-drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-label="Add item"
        data-testid="ocean-add-item-drawer"
      >
        <header className="ocean-item-detail-header">
          <div>
            <p className="ocean-item-detail-kicker">Add item</p>
            <h2 className="ocean-item-detail-heading">Manual add</h2>
          </div>
          <button
            type="button"
            className="ocean-item-detail-close"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            Close
          </button>
        </header>
        <div className="ocean-item-detail-body">
          <p className="ocean-scan-boundary">
            Manual add writes directly to the project only when you Save item.
            No Review is needed.
          </p>
          <div className="ocean-add-types" role="tablist" aria-label="Item type">
            {TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ocean-add-type ${type === item.id ? "is-selected" : ""}`}
                aria-pressed={type === item.id}
                data-testid={`ocean-add-type-${item.id}`}
                onClick={() => setType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="ocean-item-detail-edit">
            <span>{type === "person" ? "Name" : "Title"}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="ocean-add-title"
            />
          </label>
          {type !== "person" ? (
            <label className="ocean-item-detail-edit">
              <span>Detail</span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={4}
                data-testid="ocean-add-detail"
              />
            </label>
          ) : (
            <p className="ocean-home-muted">
              Single owner supported by the current project model. Tags are
              hidden for people.
            </p>
          )}
          {type !== "person" ? (
            <ItemTagsEditor
              projectTags={state.projectTags ?? []}
              value={tags}
              onChange={setTags}
              disabled={busy}
            />
          ) : null}
          {error ? (
            <p className="ocean-item-detail-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="ocean-item-detail-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            data-testid="ocean-add-discard"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Discard
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            data-testid="ocean-add-save"
            onClick={() => void onSave()}
          >
            {busy ? "Saving…" : "Save item"}
          </button>
        </footer>
      </aside>
    </>
  );
}
