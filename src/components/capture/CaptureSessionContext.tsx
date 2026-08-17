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
        | "projectId"
        | "projectName"
        | "projectCode"
        | "projectUncertain"
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
  applyOne: (item: PendingSuggestion, scopedProjectId?: string) => void;
  dismissOne: (id: string) => void;
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
    applyCaptureResult,
    addTodo,
    addSuggestion,
    addKnowledgeBullet,
    addTimelineItem,
    toggleTodo,
    removeTodo,
    updateTodo,
    replaceKnowledge,
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
          | "projectId"
          | "projectName"
          | "projectCode"
          | "projectUncertain"
        >
      >,
    ) => {
      setSlice((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          if (patch.kind) next.destination = destinationFor(patch.kind);
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
    (item: PendingSuggestion, scopedProjectId?: string) => {
      const text = (slice.editing[item.id] ?? item.content).trim();
      if (!text) return;
      const pid =
        item.projectId ?? scopedProjectId ?? (slice.projectId || null);

      const finish = () => {
        setSlice((prev) => {
          const next = {
            ...prev,
            added: { ...prev.added, [item.id]: true },
          };
          persistHistory(next);
          return next;
        });
        announce(
          item.op === "create" ? "Item added" : `Action applied: ${item.op}`,
        );
      };

      if (item.op === "complete" && item.targetTodoId) {
        const todo = state.todos.find((t) => t.id === item.targetTodoId);
        if (todo && !todo.done) toggleTodo(item.targetTodoId);
        finish();
        return;
      }
      if (
        (item.op === "delete" || item.op === "remove" || item.op === "archive") &&
        item.targetTodoId
      ) {
        if (item.op === "archive") {
          const todo = state.todos.find((t) => t.id === item.targetTodoId);
          if (todo && !todo.done) toggleTodo(item.targetTodoId!);
        } else {
          removeTodo(item.targetTodoId);
        }
        finish();
        return;
      }
      if (item.op === "update" && item.targetTodoId) {
        updateTodo(item.targetTodoId, {
          title: text,
          detail: item.recommendation?.action,
          dueAt: item.date ?? undefined,
        });
        finish();
        return;
      }

      // create (default)
      if (item.kind === "memory" && slice.result) {
        applyCaptureResult({
          ...slice.result,
          recommendations: [],
          knowledgePatch: undefined,
          timelinePatch: undefined,
          memory: { ...slice.result.memory, title: text },
        });
      } else if (item.kind === "action" || item.kind === "nudge") {
        addTodo({
          title: text,
          detail: item.recommendation?.action,
          projectId: pid,
          dueAt: item.date,
          kind: item.todoKind ?? (item.kind === "nudge" ? "CHASE" : "ACTION"),
          waitingOn: item.waitingOn,
        });
      } else if (item.kind === "risk" && pid) {
        if (item.op === "complete") {
          const knowledge = state.knowledge?.find((k) => k.projectId === pid);
          if (knowledge) {
            let matched = false;
            const nextRisks = (knowledge.sections.risks ?? []).map((r) => {
              const cleaned = r.replace(/^\s*\[resolved\]\s*/i, "").trim();
              if (
                cleaned.toLowerCase() === text.toLowerCase() ||
                text.toLowerCase().includes(cleaned.toLowerCase().slice(0, 24))
              ) {
                matched = true;
                return `[Resolved] ${cleaned}`;
              }
              return r;
            });
            replaceKnowledge({
              ...knowledge,
              sections: {
                ...knowledge.sections,
                risks: matched
                  ? nextRisks
                  : [...nextRisks, `[Resolved] ${text}`],
              },
            });
          } else {
            addKnowledgeBullet(pid, "risks", `[Resolved] ${text}`);
          }
        } else {
          addKnowledgeBullet(pid, "risks", text);
        }
      } else if (item.timelineItem && pid) {
        addTimelineItem(pid, {
          ...item.timelineItem,
          label: text,
          source: "capture",
        });
      } else if (item.knowledgeSection && pid) {
        addKnowledgeBullet(pid, item.knowledgeSection, text);
      } else if (pid && item.recommendation) {
        addSuggestion({
          projectId: pid,
          title: text,
          action: item.recommendation.action,
          why: item.recommendation.why,
          kind: item.recommendation.kind,
          urgency: item.recommendation.urgency,
        });
      } else if (
        pid &&
        (item.kind === "knowledge" ||
          item.kind === "decision" ||
          item.kind === "stakeholder")
      ) {
        const section =
          item.kind === "decision"
            ? "decisions"
            : item.kind === "stakeholder"
              ? "people"
              : "now";
        addKnowledgeBullet(pid, section, text);
      } else if (item.kind === "risk" && !pid) {
        // Risk CREATE/Resolve requires a known project destination.
        announce("Choose a project before applying this Risk change.");
        return;
      } else {
        addTodo({ title: text, projectId: pid });
      }
      finish();
    },
    [
      addKnowledgeBullet,
      addSuggestion,
      addTimelineItem,
      addTodo,
      announce,
      applyCaptureResult,
      removeTodo,
      replaceKnowledge,
      slice.editing,
      slice.projectId,
      slice.result,
      state.knowledge,
      state.todos,
      toggleTodo,
      updateTodo,
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
