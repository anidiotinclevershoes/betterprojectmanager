"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMission } from "@/lib/store";
import { type CaptureApplyDecision } from "@/lib/capture/apply";
import {
  buildSuggestions,
  CAPTURE_SESSION_KEY,
  destinationFor,
  type CapturePersistSlice,
  type PendingSuggestion,
} from "@/lib/capture/suggestions";
import type { CaptureResult } from "@/lib/types";
import {
  computeCaptureStatus,
  createCaptureSessionId,
  upsertCaptureSession,
  type CaptureSource,
} from "@/lib/sessions/history";
import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureReliabilityAssessment } from "@/lib/capture/reliability";

type Busy = "idle" | "transcribing" | "analysing";

type CaptureSessionValue = {
  content: string;
  setContent: (value: string) => void;
  projectId: string;
  setProjectId: (value: string) => void;
  fileNames: string[];
  addFileName: (name: string) => void;
  result: CaptureResult | null;
  suggestions: PendingSuggestion[];
  dismissed: Record<string, boolean>;
  added: Record<string, boolean>;
  editing: Record<string, string>;
  setEditingContent: (id: string, value: string | null) => void;
  updateSuggestion: (
    id: string,
    patch: Partial<
      Pick<
        PendingSuggestion,
        | "kind"
        | "op"
        | "content"
        | "date"
        | "targetTodoId"
        | "targetEntityId"
        | "legalDomain"
        | "personId"
          | "personName"
          | "ownershipSemantics"
          | "replacePersonId"
          | "responsibilityScope"
          | "projectId"
        | "projectName"
        | "projectCode"
        | "projectUncertain"
        | "expectedTarget"
      >
    >,
  ) => void;
  reviewOverrides: Record<string, import("@/lib/capture/suggestions").CaptureReviewOverride>;
  setReviewOverride: (
    id: string,
    patch: import("@/lib/capture/suggestions").CaptureReviewOverride | null,
  ) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  maximized: boolean;
  setMaximized: (value: boolean) => void;
  minimiseCapture: () => void;
  expandCapture: () => void;
  restoreCapture: () => void;
  busy: Busy;
  setBusy: (value: Busy) => void;
  error: string | null;
  setError: (value: string | null) => void;
  statusMessage: string | null;
  announce: (message: string) => void;
  analyse: (
    raw: string,
    sourceType: "conversation" | "voice_note",
    scopedProjectId?: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  cancelAnalyse: () => void;
  applyOne: (
    item: PendingSuggestion,
    scopedProjectId?: string,
  ) => Promise<CaptureApplyDecision>;
  dismissOne: (id: string) => void;
  markOneApplied: (id: string) => void;
  clearSession: () => void;
  expandAnalysis: () => void;
  /** Clear analysis but keep transcript — used after limited reliability. */
  editCapture: () => void;
  dismissPreReliabilityWarn: () => void;
  /** True when capture has in-progress work and is not collapsed. */
  isExpandedSession: boolean;
  pendingCount: number;
  hasTranscript: boolean;
  /** True after a successful Analyse — transcript is locked. */
  isAnalysed: boolean;
  source: CaptureSource;
  setSource: (value: CaptureSource) => void;
  analysedAt: string | null;
  contextManifest: CaptureContextManifest | null;
  reliability: CaptureReliabilityAssessment | null;
  preWarnDismissed: boolean;
};

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

function normalizeSlice(raw: CapturePersistSlice | null): CapturePersistSlice {
  const base = emptySlice();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    source: raw.source ?? "typed",
    historyId: raw.historyId ?? null,
    analysedAt: raw.analysedAt ?? null,
    contextManifest: raw.contextManifest ?? null,
    reliability: raw.reliability ?? null,
    preWarnDismissed: raw.preWarnDismissed ?? false,
    dismissed: raw.dismissed ?? {},
    added: raw.added ?? {},
    editing: raw.editing ?? {},
    fileNames: raw.fileNames ?? [],
    suggestions: raw.suggestions ?? [],
    maximized: raw.maximized ?? false,
    reviewOverrides: raw.reviewOverrides ?? {},
  };
}

function readPersisted(): CapturePersistSlice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CAPTURE_SESSION_KEY);
    if (!raw) return null;
    return normalizeSlice(JSON.parse(raw) as CapturePersistSlice);
  } catch {
    return null;
  }
}

function emptySlice(): CapturePersistSlice {
  return {
    content: "",
    projectId: "",
    fileNames: [],
    result: null,
    suggestions: [],
    dismissed: {},
    added: {},
    editing: {},
    collapsed: false,
    maximized: false,
    reviewOverrides: {},
    error: null,
    source: "typed",
    historyId: null,
    analysedAt: null,
    contextManifest: null,
    reliability: null,
    preWarnDismissed: false,
  };
}

function persistHistory(slice: CapturePersistSlice) {
  if (!slice.result || !slice.historyId || !slice.analysedAt) return;
  upsertCaptureSession({
    id: slice.historyId,
    createdAt: slice.analysedAt,
    analysedAt: slice.analysedAt,
    projectId: slice.projectId || null,
    source: slice.source,
    transcript: slice.content,
    result: slice.result,
    suggestions: slice.suggestions,
    dismissed: slice.dismissed,
    added: slice.added,
    status: computeCaptureStatus(
      slice.suggestions,
      slice.added,
      slice.dismissed,
    ),
    contextManifest: slice.contextManifest ?? null,
  });
}

export function CaptureSessionProvider({ children }: { children: ReactNode }) {
  const {
    state,
    analyzeCaptureWithAI,
    adoptAppliedState,
  } = useMission();

  const [slice, setSlice] = useState<CapturePersistSlice>(emptySlice);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<Busy>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const analyseAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) setSlice(persisted);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onDeleted = (event: Event) => {
      const deletedId = (event as CustomEvent<{ projectId?: string }>).detail
        ?.projectId;
      if (!deletedId) return;
      setSlice((prev) => {
        if (prev.projectId !== deletedId) return prev;
        try {
          window.sessionStorage.removeItem(CAPTURE_SESSION_KEY);
        } catch {
          /* ignore */
        }
        return emptySlice();
      });
    };
    window.addEventListener("lume:project-deleted", onDeleted);
    return () => window.removeEventListener("lume:project-deleted", onDeleted);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(CAPTURE_SESSION_KEY, JSON.stringify(slice));
    } catch {
      /* ignore */
    }
  }, [slice, hydrated]);

  const announce = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const isAnalysed = Boolean(slice.result);

  const setContent = useCallback((value: string) => {
    setSlice((prev) => {
      // Lock transcript once analysed — New capture / Edit Capture unlock.
      if (prev.result) return prev;
      return {
        ...prev,
        content: value,
        collapsed: false,
        preWarnDismissed: false,
      };
    });
  }, []);

  const setSource = useCallback((value: CaptureSource) => {
    setSlice((prev) => {
      if (prev.result) return prev;
      return { ...prev, source: value };
    });
  }, []);

  const setProjectId = useCallback((value: string) => {
    setSlice((prev) => ({ ...prev, projectId: value }));
  }, []);

  const addFileName = useCallback((name: string) => {
    setSlice((prev) => {
      if (prev.result) return prev;
      return {
        ...prev,
        fileNames: prev.fileNames.includes(name)
          ? prev.fileNames
          : [...prev.fileNames, name],
        source: "uploaded",
        collapsed: false,
      };
    });
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setSlice((prev) => ({ ...prev, collapsed: value }));
  }, []);

  const expandAnalysis = useCallback(() => {
    setSlice((prev) => {
      if (!prev.result) return prev;
      return { ...prev, collapsed: false };
    });
  }, []);

  const setError = useCallback((value: string | null) => {
    setSlice((prev) => ({ ...prev, error: value }));
  }, []);

  const setEditingContent = useCallback((id: string, value: string | null) => {
    setSlice((prev) => {
      const editing = { ...prev.editing };
      if (value === null) delete editing[id];
      else editing[id] = value;
      return { ...prev, editing };
    });
  }, []);

  const updateSuggestion = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          PendingSuggestion,
          | "kind"
          | "op"
          | "content"
          | "date"
          | "targetTodoId"
          | "targetEntityId"
          | "legalDomain"
          | "personId"
          | "personName"
          | "ownershipSemantics"
          | "replacePersonId"
          | "responsibilityScope"
          | "projectId"
          | "projectName"
          | "projectCode"
          | "projectUncertain"
          | "expectedTarget"
        >
      >,
    ) => {
      setSlice((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          if (patch.kind) next.destination = destinationFor(patch.kind);
          const targetChanged =
            (patch.targetEntityId !== undefined &&
              patch.targetEntityId !== s.targetEntityId) ||
            (patch.targetTodoId !== undefined &&
              patch.targetTodoId !== s.targetTodoId) ||
            (patch.op !== undefined && patch.op !== s.op);
          if (targetChanged && patch.expectedTarget === undefined) {
            next.expectedTarget = null;
          }
          return next;
        }),
      }));
    },
    [],
  );

  const setReviewOverride = useCallback(
    (
      id: string,
      patch: import("@/lib/capture/suggestions").CaptureReviewOverride | null,
    ) => {
      setSlice((prev) => {
        const reviewOverrides = { ...(prev.reviewOverrides ?? {}) };
        if (patch === null) delete reviewOverrides[id];
        else reviewOverrides[id] = { ...reviewOverrides[id], ...patch };
        return { ...prev, reviewOverrides };
      });
    },
    [],
  );

  const setMaximized = useCallback((value: boolean) => {
    setSlice((prev) => ({
      ...prev,
      maximized: value,
      collapsed: value ? false : prev.collapsed,
    }));
  }, []);

  const minimiseCapture = useCallback(() => {
    setSlice((prev) => ({ ...prev, collapsed: true, maximized: false }));
  }, []);

  const expandCapture = useCallback(() => {
    setSlice((prev) => ({ ...prev, collapsed: false, maximized: true }));
  }, []);

  const restoreCapture = useCallback(() => {
    setSlice((prev) => ({ ...prev, collapsed: false, maximized: false }));
  }, []);

  const clearSession = useCallback(() => {
    setSlice((prev) => {
      // Finalize history status; do not delete the persisted record.
      if (prev.result && prev.historyId && prev.analysedAt) {
        persistHistory(prev);
      }
      return emptySlice();
    });
    setBusy("idle");
    setStatusMessage(null);
    try {
      window.sessionStorage.removeItem(CAPTURE_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const editCapture = useCallback(() => {
    setSlice((prev) => ({
      ...prev,
      result: null,
      suggestions: [],
      dismissed: {},
      added: {},
      editing: {},
      analysedAt: null,
      historyId: null,
      reliability: null,
      contextManifest: null,
      collapsed: false,
      preWarnDismissed: false,
      error: null,
    }));
    announce("Capture unlocked for editing.");
  }, [announce]);

  const dismissPreReliabilityWarn = useCallback(() => {
    setSlice((prev) => ({ ...prev, preWarnDismissed: true }));
  }, []);

  const analyse = useCallback(
    async (
      raw: string,
      sourceType: "conversation" | "voice_note",
      scopedProjectId?: string,
      options?: { force?: boolean },
    ) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      // Do not re-analyse an already analysed Capture unless forced (Analyse again).
      if (slice.result && !options?.force) return;
      analyseAbortRef.current?.abort();
      const controller = new AbortController();
      analyseAbortRef.current = controller;
      setBusy("analysing");
      setSlice((prev) => ({
        ...prev,
        error: null,
        result: null,
        suggestions: [],
        dismissed: {},
        added: {},
        editing: {},
        collapsed: false,
        reviewOverrides: {},
        reliability: null,
        contextManifest: null,
        analysedAt: null,
      }));
      try {
        const effective = scopedProjectId || slice.projectId || undefined;
        const {
          result: next,
          contextManifest,
          reliability,
        } = await analyzeCaptureWithAI(
          {
            content: trimmed,
            projectId: effective,
            sourceType,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const openTodos = (state.todos ?? [])
          .filter((t) => !t.done)
          .map((t) => ({
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            dueAt: t.dueAt,
          }));
        const analysedAt = new Date().toISOString();
        const historyId = createCaptureSessionId();
        // Limited analyses: keep facts/summary; suppress actionable suggestions.
        const suggestions =
          reliability?.state === "limited"
            ? []
            : buildSuggestions(next, openTodos);
        const source: CaptureSource =
          sourceType === "voice_note"
            ? "recorded"
            : slice.source === "uploaded"
              ? "uploaded"
              : "typed";
        setSlice((prev) => {
          const nextSlice: CapturePersistSlice = {
            ...prev,
            result: next,
            suggestions,
            content: trimmed,
            collapsed: false,
            reviewOverrides: {},
            historyId,
            analysedAt,
            source,
            contextManifest: contextManifest ?? null,
            reliability: reliability ?? null,
            preWarnDismissed: false,
          };
          persistHistory(nextSlice);
          return nextSlice;
        });
        announce(
          reliability?.state === "limited"
            ? "Limited analysis — review the Capture before accepting changes."
            : reliability?.state === "review_recommended"
              ? "Capture analysed — review recommended."
              : "Capture analysis complete. Review suggested actions.",
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          announce("Analysis cancelled.");
          return;
        }
        setSlice((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Capture failed",
        }));
      } finally {
        if (analyseAbortRef.current === controller) {
          analyseAbortRef.current = null;
        }
        setBusy("idle");
      }
    },
    [analyzeCaptureWithAI, announce, slice.projectId, slice.result, slice.source, state.todos],
  );

  const cancelAnalyse = useCallback(() => {
    analyseAbortRef.current?.abort();
    analyseAbortRef.current = null;
    setBusy("idle");
  }, []);

  const applyOne = useCallback(
    async (
      item: PendingSuggestion,
      scopedProjectId?: string,
    ): Promise<CaptureApplyDecision> => {
      const reviewed = (slice.editing[item.id] ?? item.content).trim();
      const approvedItem: PendingSuggestion = {
        ...item,
        content: reviewed,
      };
      const text = (slice.content.trim() || reviewed);
      const projectId = scopedProjectId || slice.projectId || item.projectId || "";

      const finishApplied = (message: string) => {
        setSlice((prev) => {
          const next = {
            ...prev,
            added: { ...prev.added, [item.id]: true },
          };
          persistHistory(next);
          return next;
        });
        announce(message);
      };

      if (!projectId) {
        const decision: CaptureApplyDecision = {
          kind: "needs_you",
          domain: item.legalDomain ?? "unsupported",
          reason: "Select a project first.",
        };
        announce(decision.reason);
        return decision;
      }
      try {
        const response = await fetch("/api/capture/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            item: approvedItem,
            text,
            expectedTarget: approvedItem.expectedTarget ?? null,
          }),
        });
        const data = (await response.json()) as {
          decision?: CaptureApplyDecision;
          executed?: {
            kind: string;
            reason?: string;
            domain?: string;
          };
          state?: import("@/lib/types").MissionState;
          error?: string;
        };
        if (!response.ok) {
          const reason = data.error || "Could not apply this change.";
          announce(reason);
          return {
            kind: "needs_you",
            domain: item.legalDomain ?? "unsupported",
            reason,
          };
        }
        const decision = data.decision ?? {
          kind: "needs_you" as const,
          domain: item.legalDomain ?? "unsupported",
          reason: data.error || "Could not apply this change.",
        };
        if (data.executed?.kind === "failed") {
          announce(data.executed.reason || "Could not save this change.");
          return {
            kind: "needs_you",
            domain: decision.domain,
            reason: data.executed.reason || "Could not save this change.",
          };
        }
        if (data.state) {
          adoptAppliedState(data.state);
        }
        if (decision.kind === "needs_you") {
          setSlice((prev) => ({
            ...prev,
            reviewOverrides: {
              ...(prev.reviewOverrides ?? {}),
              [item.id]: {
                ...(prev.reviewOverrides?.[item.id] ?? {}),
                accepted: false,
                readiness: "needs_review",
                reviewReason: "OPERATION_UNCERTAIN",
                blockedReason: decision.reason,
              },
            },
          }));
          announce(decision.reason);
          return decision;
        }
        if (decision.kind === "no_change") {
          finishApplied(decision.reason);
          return decision;
        }
        if (data.executed?.kind === "wrote") {
          finishApplied(
            item.op === "create" ? "Item added" : `Action applied: ${item.op}`,
          );
        } else if (data.executed?.kind === "no_change") {
          finishApplied(data.executed.reason || decision.kind);
        } else {
          announce(data.executed?.reason || decision.kind);
        }
        return decision;
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : "Could not apply this change.";
        announce(reason);
        return {
          kind: "needs_you",
          domain: item.legalDomain ?? "unsupported",
          reason,
        };
      }
    },
    [
      adoptAppliedState,
      announce,
      slice.content,
      slice.editing,
      slice.projectId,
    ],
  );

  const dismissOne = useCallback(
    (id: string) => {
      setSlice((prev) => {
        const next = {
          ...prev,
          dismissed: { ...prev.dismissed, [id]: true },
        };
        persistHistory(next);
        return next;
      });
      announce("Item dismissed");
    },
    [announce],
  );

  const markOneApplied = useCallback((id: string) => {
    setSlice((prev) => {
      const next = {
        ...prev,
        added: { ...prev.added, [id]: true },
      };
      persistHistory(next);
      return next;
    });
  }, []);

  const pendingCount = slice.suggestions.filter(
    (s) => !slice.dismissed[s.id] && !slice.added[s.id],
  ).length;

  const hasTranscript = Boolean(slice.content.trim());
  const isExpandedSession =
    !slice.collapsed &&
    (hasTranscript ||
      Boolean(slice.result) ||
      busy !== "idle" ||
      slice.fileNames.length > 0);

  const value = useMemo<CaptureSessionValue>(
    () => ({
      content: slice.content,
      setContent,
      projectId: slice.projectId,
      setProjectId,
      fileNames: slice.fileNames,
      addFileName,
      result: slice.result,
      suggestions: slice.suggestions,
      dismissed: slice.dismissed,
      added: slice.added,
      editing: slice.editing,
      setEditingContent,
      updateSuggestion,
      reviewOverrides: slice.reviewOverrides ?? {},
      setReviewOverride,
      collapsed: slice.collapsed,
      setCollapsed,
      maximized: Boolean(slice.maximized),
      setMaximized,
      minimiseCapture,
      expandCapture,
      restoreCapture,
      busy,
      setBusy,
      error: slice.error,
      setError,
      statusMessage,
      announce,
      analyse,
      cancelAnalyse,
      applyOne,
      dismissOne,
      markOneApplied,
      clearSession,
      expandAnalysis,
      editCapture,
      dismissPreReliabilityWarn,
      isExpandedSession,
      pendingCount,
      hasTranscript,
      isAnalysed,
      source: slice.source,
      setSource,
      analysedAt: slice.analysedAt,
      contextManifest: slice.contextManifest ?? null,
      reliability: slice.reliability ?? null,
      preWarnDismissed: Boolean(slice.preWarnDismissed),
    }),
    [
      addFileName,
      analyse,
      cancelAnalyse,
      announce,
      applyOne,
      busy,
      clearSession,
      dismissOne,
      markOneApplied,
      dismissPreReliabilityWarn,
      editCapture,
      expandAnalysis,
      expandCapture,
      hasTranscript,
      isAnalysed,
      isExpandedSession,
      minimiseCapture,
      pendingCount,
      restoreCapture,
      setCollapsed,
      setContent,
      setEditingContent,
      setError,
      setMaximized,
      setProjectId,
      setReviewOverride,
      setSource,
      slice,
      statusMessage,
      updateSuggestion,
    ],
  );

  return (
    <CaptureSessionContext.Provider value={value}>
      {children}
    </CaptureSessionContext.Provider>
  );
}

export function useCaptureSession() {
  const ctx = useContext(CaptureSessionContext);
  if (!ctx) {
    throw new Error("useCaptureSession must be used within CaptureSessionProvider");
  }
  return ctx;
}
