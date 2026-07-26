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
import {
  analyseCapture,
  generateProactiveRecommendations,
} from "./coach";
import { extractKnowledgePatchFromText, emptyKnowledge, mergeKnowledge } from "./knowledge";
import { createSeedState } from "./seed";
import type {
  CaptureInput,
  CaptureResult,
  KnowledgeSectionId,
  MissionState,
  ProjectKnowledge,
  Recommendation,
  TodoItem,
} from "./types";

const STORAGE_KEY = "mission-control-state-v3";

type OpenAIDiagnostics = {
  keyPrefix: string | null;
  keyLength: number;
  reason: string | null;
};

type MissionContextValue = {
  state: MissionState;
  hydrated: boolean;
  openaiConfigured: boolean | null;
  openaiDiagnostics: OpenAIDiagnostics | null;
  capture: (input: CaptureInput) => CaptureResult;
  captureWithAI: (input: CaptureInput) => Promise<CaptureResult>;
  applyCaptureResult: (result: CaptureResult) => void;
  setRecommendationStatus: (
    id: string,
    status: Recommendation["status"],
  ) => void;
  acceptSuggestion: (recommendationId: string) => void;
  dismissSuggestion: (recommendationId: string) => void;
  toggleTodo: (todoId: string) => void;
  removeTodo: (todoId: string) => void;
  updateKnowledgeSection: (
    projectId: string,
    sectionId: KnowledgeSectionId,
    bullets: string[],
  ) => void;
  addKnowledgeBullet: (
    projectId: string,
    sectionId: KnowledgeSectionId,
    bullet: string,
  ) => void;
  replaceKnowledge: (knowledge: ProjectKnowledge) => void;
  refreshCoaching: () => void;
  resetDemo: () => void;
};

const MissionContext = createContext<MissionContextValue | null>(null);

function normaliseState(raw: MissionState): MissionState {
  return {
    ...raw,
    todos: raw.todos ?? [],
    knowledge: raw.knowledge ?? [],
  };
}

function readStoredState(): MissionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    return normaliseState(JSON.parse(raw) as MissionState);
  } catch {
    return createSeedState();
  }
}

function withProactiveCoaching(state: MissionState): MissionState {
  const extras = generateProactiveRecommendations(state);
  return {
    ...state,
    todos: state.todos ?? [],
    knowledge: state.knowledge ?? [],
    recommendations: [...extras, ...state.recommendations],
    lastAnalyzedAt: new Date().toISOString(),
  };
}

function persist(state: MissionState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyKnowledgePatch(
  knowledge: ProjectKnowledge[],
  projectId: string,
  patch?: Partial<ProjectKnowledge["sections"]>,
): ProjectKnowledge[] {
  if (!patch || !projectId) return knowledge;
  const current = knowledge.find((k) => k.projectId === projectId);
  const merged = mergeKnowledge(current, projectId, patch);
  const others = knowledge.filter((k) => k.projectId !== projectId);
  return [...others, merged];
}

function mergeCapture(prev: MissionState, result: CaptureResult): MissionState {
  const projectId = result.knowledgeProjectId || result.memory.projectId;
  const next: MissionState = {
    ...prev,
    todos: prev.todos ?? [],
    knowledge: applyKnowledgePatch(
      prev.knowledge ?? [],
      projectId ?? "",
      result.knowledgePatch,
    ),
    memories: [result.memory, ...prev.memories],
    recommendations: [...result.recommendations, ...prev.recommendations],
    lastAnalyzedAt: new Date().toISOString(),
  };
  return withProactiveCoaching(next);
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MissionState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(
    null,
  );
  const [openaiDiagnostics, setOpenaiDiagnostics] =
    useState<OpenAIDiagnostics | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setState(withProactiveCoaching(readStoredState()));
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persist(state);
  }, [state, hydrated]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/capture")
      .then((res) => res.json())
      .then(
        (data: {
          openaiConfigured?: boolean;
          keyPrefix?: string | null;
          keyLength?: number;
          reason?: string | null;
        }) => {
          if (cancelled) return;
          setOpenaiConfigured(Boolean(data.openaiConfigured));
          setOpenaiDiagnostics({
            keyPrefix: data.keyPrefix ?? null,
            keyLength: data.keyLength ?? 0,
            reason: data.reason ?? null,
          });
        },
      )
      .catch(() => {
        if (!cancelled) {
          setOpenaiConfigured(false);
          setOpenaiDiagnostics({
            keyPrefix: null,
            keyLength: 0,
            reason: "Could not reach /api/capture",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCaptureResult = useCallback((result: CaptureResult) => {
    setState((prev) => mergeCapture(prev, result));
  }, []);

  const capture = useCallback((input: CaptureInput) => {
    let result!: CaptureResult;
    setState((prev) => {
      const analysed = analyseCapture(input, prev);
      const projectId = analysed.memory.projectId || input.projectId;
      result = {
        ...analysed,
        rawContent: input.content,
        tidied: false,
        provider: "local",
        knowledgePatch: projectId
          ? extractKnowledgePatchFromText(input.content)
          : undefined,
        knowledgeProjectId: projectId,
      };
      return mergeCapture(prev, result);
    });
    return result;
  }, []);

  const captureWithAI = useCallback(async (input: CaptureInput) => {
    const latest = stateRef.current;
    const response = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: input.content,
        projectId: input.projectId,
        sourceType: input.sourceType,
        state: {
          projects: latest.projects,
          memories: latest.memories.slice(0, 40),
          recommendations: latest.recommendations
            .filter((r) => r.status === "active")
            .slice(0, 20),
          meetings: latest.meetings,
          releases: latest.releases,
          knowledge: latest.knowledge ?? [],
        },
      }),
    });

    const data = (await response.json()) as {
      result?: CaptureResult;
      error?: string;
      openaiConfigured?: boolean;
    };

    if (typeof data.openaiConfigured === "boolean") {
      setOpenaiConfigured(data.openaiConfigured);
    }

    if (!response.ok || !data.result) {
      throw new Error(data.error || "Capture failed");
    }

    setState((prev) => mergeCapture(prev, data.result!));
    return data.result;
  }, []);

  const setRecommendationStatus = useCallback(
    (recId: string, status: Recommendation["status"]) => {
      setState((prev) => ({
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.id === recId ? { ...r, status } : r,
        ),
      }));
    },
    [],
  );

  const acceptSuggestion = useCallback((recommendationId: string) => {
    setState((prev) => {
      const rec = prev.recommendations.find((r) => r.id === recommendationId);
      if (!rec || !rec.projectId) return prev;
      const todo: TodoItem = {
        id: id("todo"),
        projectId: rec.projectId,
        title: rec.title,
        detail: rec.action,
        done: false,
        createdAt: new Date().toISOString(),
        sourceRecommendationId: rec.id,
      };
      return {
        ...prev,
        todos: [todo, ...(prev.todos ?? [])],
        recommendations: prev.recommendations.map((r) =>
          r.id === recommendationId ? { ...r, status: "done" } : r,
        ),
      };
    });
  }, []);

  const dismissSuggestion = useCallback((recommendationId: string) => {
    setState((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((r) =>
        r.id === recommendationId ? { ...r, status: "dismissed" } : r,
      ),
    }));
  }, []);

  const toggleTodo = useCallback((todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: (prev.todos ?? []).map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t,
      ),
    }));
  }, []);

  const removeTodo = useCallback((todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: (prev.todos ?? []).filter((t) => t.id !== todoId),
    }));
  }, []);

  const updateKnowledgeSection = useCallback(
    (
      projectId: string,
      sectionId: KnowledgeSectionId,
      bullets: string[],
    ) => {
      setState((prev) => {
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const cleaned = bullets
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 8);
        const next: ProjectKnowledge = {
          ...current,
          updatedAt: new Date().toISOString(),
          sections: { ...current.sections, [sectionId]: cleaned },
        };
        return {
          ...prev,
          knowledge: [
            ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
            next,
          ],
        };
      });
    },
    [],
  );

  const addKnowledgeBullet = useCallback(
    (projectId: string, sectionId: KnowledgeSectionId, bullet: string) => {
      setState((prev) => {
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const merged = mergeKnowledge(current, projectId, {
          [sectionId]: [bullet],
        });
        return {
          ...prev,
          knowledge: [
            ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
            merged,
          ],
        };
      });
    },
    [],
  );

  const replaceKnowledge = useCallback((knowledge: ProjectKnowledge) => {
    setState((prev) => ({
      ...prev,
      knowledge: [
        ...(prev.knowledge ?? []).filter(
          (k) => k.projectId !== knowledge.projectId,
        ),
        { ...knowledge, updatedAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const refreshCoaching = useCallback(() => {
    setState((prev) => withProactiveCoaching(prev));
  }, []);

  const resetDemo = useCallback(() => {
    const seed = createSeedState();
    persist(seed);
    setState(seed);
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      openaiConfigured,
      openaiDiagnostics,
      capture,
      captureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
      acceptSuggestion,
      dismissSuggestion,
      toggleTodo,
      removeTodo,
      updateKnowledgeSection,
      addKnowledgeBullet,
      replaceKnowledge,
      refreshCoaching,
      resetDemo,
    }),
    [
      state,
      hydrated,
      openaiConfigured,
      openaiDiagnostics,
      capture,
      captureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
      acceptSuggestion,
      dismissSuggestion,
      toggleTodo,
      removeTodo,
      updateKnowledgeSection,
      addKnowledgeBullet,
      replaceKnowledge,
      refreshCoaching,
      resetDemo,
    ],
  );

  return (
    <MissionContext.Provider value={value}>{children}</MissionContext.Provider>
  );
}

export function useMission() {
  const ctx = useContext(MissionContext);
  if (!ctx) {
    throw new Error("useMission must be used within MissionProvider");
  }
  return ctx;
}
