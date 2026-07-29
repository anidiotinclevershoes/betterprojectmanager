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
    patch: Partial<Pick<PendingSuggestion, "kind" | "op" | "content" | "date">>,
  ) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
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
  ) => Promise<void>;
  applyOne: (item: PendingSuggestion, scopedProjectId?: string) => void;
  dismissOne: (id: string) => void;
  clearSession: () => void;
  expandAnalysis: () => void;
  /** True when capture has in-progress work and is not collapsed. */
  isExpandedSession: boolean;
  pendingCount: number;
  hasTranscript: boolean;
  /** True after a successful Analyse — transcript is locked. */
  isAnalysed: boolean;
  source: CaptureSource;
  setSource: (value: CaptureSource) => void;
  analysedAt: string | null;
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
    dismissed: raw.dismissed ?? {},
    added: raw.added ?? {},
    editing: raw.editing ?? {},
    fileNames: raw.fileNames ?? [],
    suggestions: raw.suggestions ?? [],
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
    error: null,
    source: "typed",
    historyId: null,
    analysedAt: null,
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
  } = useMission();

  const [slice, setSlice] = useState<CapturePersistSlice>(emptySlice);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<Busy>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
      // Lock transcript once analysed — New capture is the only clear path.
      if (prev.result) return prev;
      return { ...prev, content: value, collapsed: false };
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
      patch: Partial<Pick<PendingSuggestion, "kind" | "op" | "content" | "date">>,
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

  const analyse = useCallback(
    async (
      raw: string,
      sourceType: "conversation" | "voice_note",
      scopedProjectId?: string,
    ) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      // Do not re-analyse an already analysed Capture.
      if (slice.result) return;
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
      }));
      try {
        const effective = scopedProjectId || slice.projectId || undefined;
        const next = await analyzeCaptureWithAI({
          content: trimmed,
          projectId: effective,
          sourceType,
        });
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
        const suggestions = buildSuggestions(next, openTodos);
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
            historyId,
            analysedAt,
            source,
          };
          persistHistory(nextSlice);
          return nextSlice;
        });
        announce("Capture analysis complete. Review suggested actions.");
      } catch (err) {
        setSlice((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Capture failed",
        }));
      } finally {
        setBusy("idle");
      }
    },
    [analyzeCaptureWithAI, announce, slice.projectId, slice.result, slice.source, state.todos],
  );

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
        });
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
          item.kind === "risk" ||
          item.kind === "stakeholder")
      ) {
        const section =
          item.kind === "risk"
            ? "risks"
            : item.kind === "decision"
              ? "decisions"
              : item.kind === "stakeholder"
                ? "people"
                : "now";
        addKnowledgeBullet(pid, section, text);
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
      slice.editing,
      slice.projectId,
      slice.result,
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
      collapsed: slice.collapsed,
      setCollapsed,
      busy,
      setBusy,
      error: slice.error,
      setError,
      statusMessage,
      announce,
      analyse,
      applyOne,
      dismissOne,
      clearSession,
      expandAnalysis,
      isExpandedSession,
      pendingCount,
      hasTranscript,
      isAnalysed,
      source: slice.source,
      setSource,
      analysedAt: slice.analysedAt,
    }),
    [
      addFileName,
      analyse,
      announce,
      applyOne,
      busy,
      clearSession,
      dismissOne,
      expandAnalysis,
      hasTranscript,
      isAnalysed,
      isExpandedSession,
      pendingCount,
      setCollapsed,
      setContent,
      setEditingContent,
      setError,
      setProjectId,
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
