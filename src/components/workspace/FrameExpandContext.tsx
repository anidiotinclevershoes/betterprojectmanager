"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type FrameExpandValue = {
  expandedId: string | null;
  expand: (id: string) => void;
  collapse: () => void;
  isExpanded: (id: string) => boolean;
};

const FrameExpandContext = createContext<FrameExpandValue | null>(null);

export function FrameExpandProvider({ children }: { children: ReactNode }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const expand = useCallback((id: string) => {
    setExpandedId(id);
  }, []);

  const collapse = useCallback(() => setExpandedId(null), []);

  const isExpanded = useCallback(
    (id: string) => expandedId === id,
    [expandedId],
  );

  useEffect(() => {
    if (!expandedId) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Prefer closing nested overlays first — DetailModal handles its own Escape.
        const overlay = document.querySelector(
          ".detail-modal-backdrop, .nudge-draft-drawer",
        );
        if (overlay) return;
        setExpandedId(null);
      }
    };

    const onPointer = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest(`[data-frame-expand="${expandedId}"]`)) return;
      if (
        target.closest(
          ".detail-modal-backdrop, .nudge-draft-drawer, .nudge-due-row, input, select, textarea, button, label, [role='dialog']",
        )
      ) {
        return;
      }
      setExpandedId(null);
    };

    window.addEventListener("keydown", onKey);
    // Capture phase so we see outside clicks after overlays decide.
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [expandedId]);

  useEffect(() => {
    const onNav = () => setExpandedId(null);
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  const value = useMemo(
    () => ({ expandedId, expand, collapse, isExpanded }),
    [expandedId, expand, collapse, isExpanded],
  );

  return (
    <FrameExpandContext.Provider value={value}>
      {children}
    </FrameExpandContext.Provider>
  );
}

export function useFrameExpand() {
  const ctx = useContext(FrameExpandContext);
  if (!ctx) {
    return {
      expandedId: null as string | null,
      expand: (_id: string) => {},
      collapse: () => {},
      isExpanded: (_id: string) => false,
    };
  }
  return ctx;
}
