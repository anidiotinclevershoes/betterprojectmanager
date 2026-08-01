"use client";

import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useMission } from "@/lib/store";

/**
 * Development-only control: restore canonical seeded demo data.
 * Must not be rendered when NODE_ENV !== "development".
 */
export function ResetDemoDataButton({
  collapsed,
  onAfterReset,
}: {
  collapsed: boolean;
  onAfterReset?: () => void;
}) {
  const { resetDemo } = useMission();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const runReset = () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = resetDemo();
      if (result.ok) {
        setConfirmOpen(false);
        setMessage({ kind: "success", text: "Demo data restored." });
        onAfterReset?.();
      } else {
        setMessage({
          kind: "error",
          text: result.error || "Could not restore demo data.",
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[ResetDemoDataButton]", err);
      }
      setMessage({
        kind: "error",
        text: "Could not restore demo data.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-link sidebar-btn"
        onClick={() => {
          setMessage(null);
          setConfirmOpen(true);
        }}
        title="Reset demo data (development only)"
      >
        <span className="sidebar-ico" aria-hidden>
          ↺
        </span>
        {!collapsed ? <span>Reset demo data</span> : null}
      </button>

      <DetailModal
        open={confirmOpen}
        title="Reset demo data?"
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="muted-btn"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={runReset}
              disabled={busy}
            >
              {busy ? "Resetting…" : "Reset demo data"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft" style={{ marginBottom: "0.75rem" }}>
          This will delete changes made to seeded projects and restore the
          original development baseline.
        </p>
        <p className="text-sm text-ink-soft">
          Your non-seeded data will not be changed.
        </p>
        {message?.kind === "error" ? (
          <div
            role="alert"
            style={{
              marginTop: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <p className="field-error">{message.text}</p>
            <button
              type="button"
              className="danger-btn"
              onClick={runReset}
              disabled={busy}
            >
              Retry
            </button>
          </div>
        ) : null}
      </DetailModal>

      {message?.kind === "success" && !confirmOpen ? (
        <div
          role="status"
          className="dev-reset-toast"
          style={{
            position: "fixed",
            bottom: "1.25rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            padding: "0.55rem 0.9rem",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
            fontSize: "0.8rem",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {message.text}
          <button
            type="button"
            className="ghost"
            aria-label="Dismiss"
            style={{ marginLeft: "0.65rem" }}
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
