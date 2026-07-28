"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_OVERVIEW_LAYOUT,
  defaultProjectLayout,
  readWorkspaceLayout,
  writeWorkspaceLayout,
  type FrameSize,
  type WorkspaceFrameConfig,
  type WorkspaceLayout,
} from "@/lib/workspace/layout";

export function useWorkspaceLayout(scope = "overview") {
  const [layout, setLayout] = useState<WorkspaceLayout>(() =>
    scope === "overview" ? DEFAULT_OVERVIEW_LAYOUT : defaultProjectLayout(scope),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (scope === "overview") {
      setLayout(readWorkspaceLayout("overview"));
    } else {
      try {
        const raw = window.localStorage.getItem(`mc-workspace-layout-v1:${scope}`);
        setLayout(raw ? readWorkspaceLayout(scope) : defaultProjectLayout(scope));
      } catch {
        setLayout(defaultProjectLayout(scope));
      }
    }
    setHydrated(true);
  }, [scope]);

  const persist = useCallback(
    (next: WorkspaceLayout) => {
      setLayout(next);
      writeWorkspaceLayout(next, scope);
    },
    [scope],
  );

  const toggleFrame = useCallback(
    (id: string) => {
      setLayout((current) => {
        const next = {
          frames: current.frames.map((f) =>
            f.id === id ? { ...f, visible: !f.visible } : f,
          ),
        };
        writeWorkspaceLayout(next, scope);
        return next;
      });
    },
    [scope],
  );

  const moveFrame = useCallback(
    (id: string, direction: "up" | "down") => {
      setLayout((current) => {
        const ordered = [...current.frames].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex((f) => f.id === id);
        if (index < 0) return current;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= ordered.length) return current;
        const a = ordered[index];
        const b = ordered[swapWith];
        const next = {
          frames: current.frames.map((f) => {
            if (f.id === a.id) return { ...f, order: b.order };
            if (f.id === b.id) return { ...f, order: a.order };
            return f;
          }),
        };
        writeWorkspaceLayout(next, scope);
        return next;
      });
    },
    [scope],
  );

  const setFrameSize = useCallback(
    (id: string, size: FrameSize) => {
      setLayout((current) => {
        const next = {
          frames: current.frames.map((f) =>
            f.id === id ? { ...f, size } : f,
          ),
        };
        writeWorkspaceLayout(next, scope);
        return next;
      });
    },
    [scope],
  );

  const resetLayout = useCallback(() => {
    const next =
      scope === "overview"
        ? DEFAULT_OVERVIEW_LAYOUT
        : defaultProjectLayout(scope);
    persist(next);
  }, [persist, scope]);

  return {
    layout,
    frames: layout.frames as WorkspaceFrameConfig[],
    hydrated,
    toggleFrame,
    moveFrame,
    setFrameSize,
    resetLayout,
  };
}
