"use client";

import { useEffect, useState } from "react";
import { useMission } from "@/lib/store";

export function SuggestionAddModal({
  recommendationId,
  onClose,
}: {
  recommendationId: string | null;
  onClose: () => void;
}) {
  const { state, saveSuggestedTodo, dismissSuggestionDurable } = useMission();
  const rec = (state.recommendations ?? []).find((r) => r.id === recommendationId);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(rec?.title ?? "");
    setDetail(rec?.action ?? "");
    setError(null);
  }, [rec?.id, rec?.title, rec?.action]);

  if (!recommendationId || !rec) return null;
  const current = rec;

  async function onSave() {
    setError(null);
    if (!title.trim()) {
      setError("Enter a To Do title before saving.");
      return;
    }
    setBusy(true);
    try {
      const result = await saveSuggestedTodo({
        recommendationId: current.id,
        title: title.trim(),
        detail: detail.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not save To Do.");
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard() {
    setBusy(true);
    setError(null);
    try {
      const result = await dismissSuggestionDurable(current.id);
      if (!result.ok) {
        setError(result.error ?? "Could not remember this dismissal.");
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ocean-suggestion-modal" data-testid="ocean-suggestion-modal">
      <button
        type="button"
        className="ocean-item-detail-backdrop"
        aria-label="Close suggestion"
        onClick={onClose}
      />
      <div
        className="ocean-suggestion-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add suggested To Do"
      >
        <h2>Add suggested To Do</h2>
        <p>Nothing is created until you Save To Do.</p>
        <label className="ocean-item-detail-edit">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="ocean-suggestion-title"
          />
        </label>
        <label className="ocean-item-detail-edit">
          <span>Detail</span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            data-testid="ocean-suggestion-detail"
          />
        </label>
        {error ? (
          <p className="ocean-item-detail-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="ocean-item-detail-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            data-testid="ocean-suggestion-discard"
            onClick={() => void onDiscard()}
          >
            Discard
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            data-testid="ocean-suggestion-save"
            onClick={() => void onSave()}
          >
            {busy ? "Saving…" : "Save To Do"}
          </button>
        </footer>
        <p className="ocean-home-muted">
          Discard remembers the dismissal and does not change the project.
        </p>
      </div>
    </div>
  );
}
