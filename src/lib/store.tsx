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
import { createSeedState } from "./seed";
import type {
  CaptureInput,
  CaptureResult,
  MissionState,
  Recommendation,
} from "./types";

const STORAGE_KEY = "mission-control-state-v1";

type MissionContextValue = {
  state: MissionState;
  hydrated: boolean;
  openaiConfigured: boolean | null;
  capture: (input: CaptureInput) => CaptureResult;
  captureWithAI: (input: CaptureInput) => Promise<CaptureResult>;
  applyCaptureResult: (result: CaptureResult) => void;
  setRecommendationStatus: (
    id: string,
    status: Recommendation["status"],
  ) => void;
  refreshCoaching: () => void;
  resetDemo: () => void;
};

const MissionContext = createContext<MissionContextValue | null>(null);

function readStoredState(): MissionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    return JSON.parse(raw) as MissionState;
  } catch {
    return createSeedState();
  }
}

function withProactiveCoaching(state: MissionState): MissionState {
  const extras = generateProactiveRecommendations(state);
  return {
    ...state,
    recommendations: [...extras, ...state.recommendations],
    lastAnalyzedAt: new Date().toISOString(),
  };
}

function persist(state: MissionState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeCapture(prev: MissionState, result: CaptureResult): MissionState {
  const next: MissionState = {
    ...prev,
    memories: [result.memory, ...prev.memories],
    recommendations: [...result.recommendations, ...prev.recommendations],
    lastAnalyzedAt: new Date().toISOString(),
  };
  return withProactiveCoaching(next);
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MissionState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(
    null,
  );
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
      .then((data: { openaiConfigured?: boolean }) => {
        if (!cancelled) setOpenaiConfigured(Boolean(data.openaiConfigured));
      })
      .catch(() => {
        if (!cancelled) setOpenaiConfigured(false);
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
      result = {
        ...analyseCapture(input, prev),
        rawContent: input.content,
        tidied: false,
        provider: "local",
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
    (id: string, status: Recommendation["status"]) => {
      setState((prev) => ({
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.id === id ? { ...r, status } : r,
        ),
      }));
    },
    [],
  );

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
      capture,
      captureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
      refreshCoaching,
      resetDemo,
    }),
    [
      state,
      hydrated,
      openaiConfigured,
      capture,
      captureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
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
