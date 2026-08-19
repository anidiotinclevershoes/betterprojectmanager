"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  readMissionSupabaseCache,
  writeMissionSupabaseCache,
} from "@/lib/mission-cache";
import {
  analyseCapture,
  generateProactiveRecommendations,
} from "./coach";
import { extractKnowledgePatchFromText, emptyKnowledge, mergeKnowledge } from "./knowledge";
import { confirmResponsibilityOwner as applyConfirmResponsibilityOwner } from "@/lib/canonical-truth/confirm-responsibility";
import {
  buildNewProject,
  type CreateProjectInput,
} from "./create-project";
import {
  clampDueToWindow,
  cloneRelOpsProject,
  refreshProjectSuggestions,
  type CloneRelOpsInput,
} from "./relops-clone";
import { createSeedState } from "./seed";
import { resetSeedData, type SeedResetResult } from "./seed-reset";
import {
  clearActiveCaptureIfSeeded,
  pruneSeededSessions,
} from "./sessions/history";
import type { CaptureContextManifest } from "./capture/context";
import type { CaptureReliabilityAssessment } from "./capture/reliability";
import {
  extractTimelinePatchFromText,
  mergeTimelineItems,
} from "./timeline";
import type {
  CaptureInput,
  CaptureResult,
  KnowledgeSectionId,
  MissionState,
  ProjectKnowledge,
  Recommendation,
  TimelineItem,
  TimelineItemInput,
  TodoItem,
} from "./types";
import {
  bumpAnalysisUsage,
  makeHistoryEvent,
  pushHistory,
} from "./workspace/history";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { waitForBrowserUser } from "@/lib/supabase/wait-for-browser-user";
import {
  emptyMissionState,
  loadMissionStateFromSupabase,
} from "@/lib/data/supabase/load-mission-state";
import {
  persistCaptureSession,
  persistHistoryEvent,
  persistKnowledgeBullet,
  persistKnowledgeLifecycle,
  persistEnsureStakeholder,
  persistMemory,
  persistNewProject,
  persistRiskStatus,
  persistTimelineItem,
  persistTodoCreate,
  persistTodoDelete,
  persistTodoUpdate,
} from "@/lib/data/supabase/persist-mutations";
import {
  persistKnowledgeReconcile,
  remapStructuredForSections,
  alignSectionItemIds,
} from "@/lib/data/supabase/reconcile-knowledge";
import {
  findProjectRisk,
  resolveKnowledgeOnlyRiskBullet,
  reopenKnowledgeOnlyRiskBullet,
  syncKnowledgeRiskProjection,
} from "@/lib/risks/lifecycle";
import type { RiskStatus } from "@/types/database";

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STORAGE_KEY = "mission-control-state-v5";

type PersistMeta = {
  mode: "local" | "supabase";
  workspaceId: string | null;
  userId: string | null;
};

type OpenAIDiagnostics = {
  keyPrefix: string | null;
  keyLength: number;
  reason: string | null;
};

type AddTodoInput = {
  title: string;
  detail?: string;
  projectId?: string | null;
  dueAt?: string;
  kind?: import("@/lib/types").TodoKind;
  waitingOn?: string;
};

type UpdateTodoInput = {
  title?: string;
  detail?: string | null;
  dueAt?: string | null;
  done?: boolean;
  projectId?: string | null;
  kind?: import("@/lib/types").TodoKind | null;
  waitingOn?: string | null;
};

type AddSuggestionInput = {
  projectId: string;
  title: string;
  action?: string;
  why?: string;
  kind?: Recommendation["kind"];
  urgency?: Recommendation["urgency"];
};

type MissionContextValue = {
  state: MissionState;
  hydrated: boolean;
  openaiConfigured: boolean | null;
  openaiDiagnostics: OpenAIDiagnostics | null;
  capture: (input: CaptureInput) => CaptureResult;
  captureWithAI: (input: CaptureInput) => Promise<CaptureResult>;
  /** Analyse without writing — user confirms additions in Capture review. */
  analyzeCaptureWithAI: (
    input: CaptureInput,
    signal?: AbortSignal,
  ) => Promise<{
    result: CaptureResult;
    contextManifest: CaptureContextManifest | null;
    requestId: string | null;
    reliability: CaptureReliabilityAssessment | null;
  }>;
  applyCaptureResult: (result: CaptureResult) => void;
  setRecommendationStatus: (
    id: string,
    status: Recommendation["status"],
  ) => void;
  acceptSuggestion: (recommendationId: string) => void;
  dismissSuggestion: (recommendationId: string) => void;
  toggleTodo: (todoId: string) => void;
  removeTodo: (todoId: string) => void;
  addTodo: (input: AddTodoInput) => void;
  updateTodo: (todoId: string, patch: UpdateTodoInput) => void;
  updateTodoDueDate: (todoId: string, dueAt: string | undefined) => void;
  resolveNudge: (input: {
    nudgeId: string;
    person: string;
    subject: string;
    projectId?: string | null;
    daysWaiting?: number;
    source?: "stakeholder" | "recommendation";
    recommendationId?: string;
  }) => void;
  updateMeeting: (
    meetingId: string,
    patch: {
      title?: string;
      projectId?: string;
      startsAt?: string;
      objectives?: string[];
      openingScript?: string;
      talkingPoints?: string[];
      questionsToAsk?: string[];
      risksToDiscuss?: string[];
    },
  ) => void;
  addSuggestion: (input: AddSuggestionInput) => string | null;
  createProject: (input: CreateProjectInput) => Promise<string>;
  cloneRelOps: (input: CloneRelOpsInput) => void;
  refreshSuggestions: (projectId: string) => void;
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
  /**
   * Slice 1B: set lifecycle on a genuine Risk (by stable risks.id).
   * Syncs Knowledge projection; does not create duplicate Risk rows.
   */
  setRiskStatus: (
    riskId: string,
    status: RiskStatus,
    projectId: string,
  ) => void;
  /**
   * Slice 1B: resolve/reopen a legacy Knowledge-only risk bullet (no risks row).
   * Does not fabricate a Risk-domain record.
   */
  setKnowledgeOnlyRiskResolved: (
    projectId: string,
    title: string,
    resolved: boolean,
  ) => void;
  /** Slice 1: confirm scoped responsibility owner (explicit UI mutation). */
  confirmResponsibilityOwner: (input: {
    projectId: string;
    scope: string;
    personName: string;
    personId?: string | null;
    resolveTruthItemId?: string | null;
    /** Explicitly supersede this person's current ownership of the same scope. */
    replacePersonId?: string | null;
  }) => void;
  addTimelineItem: (
    projectId: string,
    item: TimelineItemInput & { source?: TimelineItem["source"] },
  ) => void;
  refreshCoaching: () => void;
  /** Development: restore seeded demo baseline; preserve non-seeded data. */
  resetDemo: () => SeedResetResult;
  /** Persistence mode for the current session. */
  persistenceMode: "local" | "supabase";
  /** Soft save status for Supabase-backed sessions. */
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
};

const MissionContext = createContext<MissionContextValue | null>(null);

function normaliseState(raw: MissionState): MissionState {
  return {
    ...raw,
    todos: raw.todos ?? [],
    knowledge: raw.knowledge ?? [],
    risks: raw.risks ?? [],
    timeline: raw.timeline ?? [],
    history: raw.history ?? [],
    analysesThisMonth: raw.analysesThisMonth ?? 0,
    analysesMonthKey: raw.analysesMonthKey,
  };
}

function readStoredState(): MissionState {
  // Production must never hydrate ATLAS/HORIZON/RELOPS seed data.
  if (process.env.NODE_ENV === "production") {
    return emptyMissionState();
  }
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
    risks: state.risks ?? [],
    timeline: state.timeline ?? [],
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
  let timeline = prev.timeline ?? [];
  if (projectId && result.timelinePatch?.length) {
    timeline = mergeTimelineItems(
      timeline,
      projectId,
      result.timelinePatch,
      "capture",
    );
  }

  // Slice 1B: Capture risk adds mint genuine Risk-domain rows (stable ids).
  // Do not mint for [Resolved] prose — that is legacy Knowledge-only display.
  const priorRisks = prev.risks ?? [];
  const mintedRisks: import("@/lib/types").ProjectRisk[] = [];
  if (projectId && result.knowledgePatch?.risks?.length) {
    for (const raw of result.knowledgePatch.risks) {
      const title = raw.trim();
      if (!title) continue;
      if (/^\s*\[resolved\]/i.test(title)) continue;
      const exists = priorRisks.some(
        (r) =>
          r.projectId === projectId &&
          r.title.trim().toLowerCase() === title.toLowerCase(),
      );
      if (exists) continue;
      const alreadyMinted = mintedRisks.some(
        (r) => r.title.trim().toLowerCase() === title.toLowerCase(),
      );
      if (alreadyMinted) continue;
      mintedRisks.push({
        id: newClientId(),
        projectId,
        title,
        status: "open",
        source: "capture",
        createdAt: new Date().toISOString(),
      });
    }
  }

  const next: MissionState = {
    ...prev,
    todos: prev.todos ?? [],
    knowledge: applyKnowledgePatch(
      prev.knowledge ?? [],
      projectId ?? "",
      result.knowledgePatch,
    ),
    risks: [...priorRisks, ...mintedRisks],
    timeline,
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
  const [state, setState] = useState<MissionState>(emptyMissionState);
  const [hydrated, setHydrated] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(
    null,
  );
  const [openaiDiagnostics, setOpenaiDiagnostics] =
    useState<OpenAIDiagnostics | null>(null);
  const [persistenceMode, setPersistenceMode] = useState<"local" | "supabase">(
    "local",
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const persistMetaRef = useRef<PersistMeta>({
    mode: "local",
    workspaceId: null,
    userId: null,
  });
  const cachePaintedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Paint last-known projects before the browser draws — avoids sidebar flash.
  useLayoutEffect(() => {
    if (cachePaintedRef.current) return;
    cachePaintedRef.current = true;
    const cached = readMissionSupabaseCache();
    if (!cached || cached.state.projects.length === 0) return;
    persistMetaRef.current = {
      mode: "supabase",
      workspaceId: cached.workspaceId,
      userId: cached.userId,
    };
    setPersistenceMode("supabase");
    setState(cached.state);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hydrateSucceeded = false;
    let hydrateInFlight = false;
    let authUnsub: (() => void) | undefined;

    function applyLoadedWorkspace(payload: {
      workspaceId: string;
      userId: string;
      state: MissionState;
    }) {
      persistMetaRef.current = {
        mode: "supabase",
        workspaceId: payload.workspaceId,
        userId: payload.userId,
      };
      setPersistenceMode("supabase");
      setState(normaliseState(payload.state));
      setSaveStatus("idle");
      setSaveError(null);
      setHydrated(true);
      hydrateSucceeded = true;
      writeMissionSupabaseCache({
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        state: normaliseState(payload.state),
      });
    }

    async function hydrateFromServerCookies(): Promise<boolean> {
      const serverRes = await fetch("/api/workspace/state", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!serverRes.ok) return false;
      const payload = (await serverRes.json()) as {
        workspaceId: string;
        userId: string;
        state: MissionState;
      };
      if (cancelled) return false;
      applyLoadedWorkspace(payload);
      return true;
    }

    async function hydrateFromBrowserClient(): Promise<boolean> {
      const client = createBrowserSupabaseClient();
      await waitForBrowserUser(client, { timeoutMs: 8_000 });
      if (cancelled) return false;
      const loaded = await loadMissionStateFromSupabase(client);
      if (cancelled) return false;
      applyLoadedWorkspace({
        workspaceId: loaded.workspaceId,
        userId: loaded.userId,
        state: loaded.state,
      });
      return true;
    }

    async function hydrateFromSupabase(): Promise<boolean> {
      if (hydrateInFlight) return false;
      hydrateInFlight = true;
      try {
        // Prefer server cookie load — reliable on hard refresh.
        if (await hydrateFromServerCookies()) return true;
        // Fallback: browser client once its session is ready.
        return await hydrateFromBrowserClient();
      } finally {
        hydrateInFlight = false;
      }
    }

    function applySupabaseHydrateFailure(userId: string | null, message: string) {
      persistMetaRef.current = {
        mode: "supabase",
        workspaceId: null,
        userId,
      };
      setPersistenceMode("supabase");
      setState(emptyMissionState());
      setSaveStatus("error");
      setSaveError(message);
      setHydrated(true);
    }

    function applyLocalHydrate() {
      persistMetaRef.current = {
        mode: "local",
        workspaceId: null,
        userId: null,
      };
      setPersistenceMode("local");
      try {
        setState(withProactiveCoaching(readStoredState()));
      } catch {
        setState(emptyMissionState());
      }
      setHydrated(true);
    }

    function attachAuthRecovery() {
      try {
        const client = createBrowserSupabaseClient();
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((event, session) => {
          if (cancelled || hydrateSucceeded || !session?.user) return;
          if (
            event !== "INITIAL_SESSION" &&
            event !== "SIGNED_IN" &&
            event !== "TOKEN_REFRESHED"
          ) {
            return;
          }
          void hydrateFromSupabase().catch((err) => {
            console.error(
              "[MissionProvider] supabase hydrate recovery failed",
              err,
            );
          });
        });
        authUnsub = () => subscription.unsubscribe();
      } catch {
        /* client unavailable */
      }
    }

    async function hydrate() {
      try {
        let me: {
          persistence?: string;
          mode?: string;
          user?: { id?: string } | null;
        } | null = null;

        for (let i = 0; i < 6; i += 1) {
          me = (await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store",
          }).then((r) => r.json())) as {
            persistence?: string;
            mode?: string;
            user?: { id?: string } | null;
          };
          if (me.persistence !== "supabase") break;
          if (me.user?.id) break;
          await sleep(250 * (i + 1));
        }

        // Supabase persistence: keep showing "Loading…" and retry — never
        // fail-fast into the error/empty screens while the session is settling.
        if (me?.persistence === "supabase") {
          attachAuthRecovery();

          let lastError: unknown = null;
          for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
              // Even without /api/auth/me.user yet, cookies may already work.
              const ok = await hydrateFromSupabase();
              if (cancelled || ok) return;
            } catch (err) {
              lastError = err;
              console.error(
                `[MissionProvider] supabase hydrate attempt ${attempt + 1} failed`,
                err,
              );
            }
            if (cancelled) return;
            if (attempt < 7) await sleep(350 * (attempt + 1));
          }

          if (cancelled) return;
          console.error(
            "[MissionProvider] supabase hydrate failed after retries",
            lastError,
          );
          applySupabaseHydrateFailure(
            me?.user?.id ?? null,
            me?.user?.id
              ? "Could not load your workspace. Please refresh."
              : "Could not restore your session. Please sign in again.",
          );
          return;
        }
      } catch (err) {
        console.error("[MissionProvider] hydrate bootstrap failed", err);
        if (process.env.NODE_ENV === "production") {
          if (cancelled) return;
          applySupabaseHydrateFailure(
            null,
            "Could not load your workspace. Please refresh.",
          );
          return;
        }
      }

      if (cancelled) return;
      applyLocalHydrate();
    }

    void hydrate();
    return () => {
      cancelled = true;
      authUnsub?.();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (persistMetaRef.current.mode === "supabase") return;
    persist(state);
  }, [state, hydrated]);

  // Keep refresh paint cache warm after successful supabase hydrate/mutations.
  useEffect(() => {
    if (!hydrated) return;
    const meta = persistMetaRef.current;
    if (meta.mode !== "supabase" || !meta.workspaceId || !meta.userId) return;
    writeMissionSupabaseCache({
      userId: meta.userId,
      workspaceId: meta.workspaceId,
      state,
    });
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
    let mintedRiskIds = new Map<string, string>();
    setState((prev) => {
      const priorIds = new Set((prev.risks ?? []).map((r) => r.id));
      const next = mergeCapture(prev, result);
      mintedRiskIds = new Map(
        (next.risks ?? [])
          .filter((r) => !priorIds.has(r.id))
          .map((r) => [r.title.trim().toLowerCase(), r.id]),
      );
      return next;
    });
    const meta = persistMetaRef.current;
    if (meta.mode !== "supabase" || !meta.workspaceId) return;
    void (async () => {
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const client = createBrowserSupabaseClient();
        const workspaceId = meta.workspaceId!;
        const userId = meta.userId;
        if (result.memory) {
          await persistMemory(client, workspaceId, userId, result.memory);
        }
        const projectId =
          result.knowledgeProjectId || result.memory.projectId || null;
        if (projectId && result.knowledgePatch) {
          for (const [section, bullets] of Object.entries(
            result.knowledgePatch,
          )) {
            for (const body of bullets ?? []) {
              if (!body?.trim()) continue;
              const trimmed = body.trim();
              const riskId =
                section === "risks"
                  ? mintedRiskIds.get(trimmed.toLowerCase())
                  : undefined;
              await persistKnowledgeBullet(
                client,
                workspaceId,
                projectId,
                section,
                trimmed,
                userId,
                riskId ? { riskId } : undefined,
              );
            }
          }
        }
        if (projectId && result.timelinePatch?.length) {
          for (const item of result.timelinePatch) {
            await persistTimelineItem(client, workspaceId, projectId, {
              label: item.label,
              type: item.type,
              startAt: item.startAt,
              endAt: item.endAt,
              notes: item.notes,
              source: "capture",
            });
          }
        }
        await persistCaptureSession(client, workspaceId, userId, {
          projectId,
          transcript: result.rawContent || result.memory.content || "",
          result,
          suggestions: result.recommendations,
          status: "applied",
        });
        await persistHistoryEvent(client, workspaceId, userId, {
          type: "capture_analysed",
          title: "Capture applied",
          detail: result.memory.title,
          projectId,
          source: "ai",
        });
        setSaveStatus("saved");
      } catch (err) {
        console.error("[applyCaptureResult] persist failed", err);
        setSaveStatus("error");
        setSaveError(
          err instanceof Error ? err.message : "Could not save Capture changes",
        );
      }
    })();
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
        timelinePatch: projectId
          ? extractTimelinePatchFromText(input.content)
          : undefined,
      };
      return mergeCapture(prev, result);
    });
    return result;
  }, []);

  const requestCaptureAnalysis = useCallback(
    async (input: CaptureInput, signal?: AbortSignal) => {
    const latest = stateRef.current;
    const response = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        content: input.content,
        projectId: input.projectId,
        sourceType: input.sourceType,
        state: {
          projects: latest.projects,
          memories: latest.memories.slice(0, 40),
          recommendations: latest.recommendations
            .filter((r) => r.status === "active")
            .slice(0, 40),
          meetings: latest.meetings,
          releases: latest.releases,
          knowledge: latest.knowledge ?? [],
          timeline: latest.timeline ?? [],
          todos: (latest.todos ?? []).slice(0, 80).map((t) => ({
            id: t.id,
            title: t.title,
            detail: t.detail,
            projectId: t.projectId,
            dueAt: t.dueAt,
            done: t.done,
            createdAt: t.createdAt,
          })),
          history: (latest.history ?? []).slice(0, 40).map((h) => ({
            id: h.id,
            type: h.type,
            title: h.title,
            detail: h.detail,
            projectId: h.projectId,
            createdAt: h.createdAt,
            source: h.source,
          })),
        },
      }),
    });

    const data = (await response.json()) as {
      result?: CaptureResult;
      error?: string;
      openaiConfigured?: boolean;
      contextManifest?: CaptureContextManifest | null;
      requestId?: string | null;
      reliability?: CaptureReliabilityAssessment | null;
    };

    if (typeof data.openaiConfigured === "boolean") {
      setOpenaiConfigured(data.openaiConfigured);
    }

    if (!response.ok || !data.result) {
      throw new Error(data.error || "Capture failed");
    }

    return {
      result: data.result,
      contextManifest: data.contextManifest ?? null,
      requestId: data.requestId ?? null,
      reliability: data.reliability ?? null,
    };
  }, []);

  const analyzeCaptureWithAI = useCallback(
    async (input: CaptureInput, signal?: AbortSignal) => {
      const { result, contextManifest, requestId, reliability } =
        await requestCaptureAnalysis(input, signal);
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      setState((prev) =>
        pushHistory(bumpAnalysisUsage(prev), makeHistoryEvent({
          type: "capture_analysed",
          title: "Capture analysed",
          detail: result.memory.title,
          projectId: result.memory.projectId ?? input.projectId,
          source: "ai",
        })),
      );
      return { result, contextManifest, requestId, reliability };
    },
    [requestCaptureAnalysis],
  );

  const captureWithAI = useCallback(
    async (input: CaptureInput) => {
      const { result } = await requestCaptureAnalysis(input);
      setState((prev) => mergeCapture(prev, result));
      return result;
    },
    [requestCaptureAnalysis],
  );

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
      if (!rec) return prev;
      const project = rec.projectId
        ? prev.projects.find((p) => p.id === rec.projectId)
        : undefined;
      const dueAt = project?.releaseDate
        ? clampDueToWindow(project, project.nextMilestoneAt ?? project.releaseDate)
        : project?.nextMilestoneAt;
      const todo: TodoItem = {
        id: id("todo"),
        projectId: rec.projectId ?? null,
        title: rec.title,
        detail: rec.action,
        done: false,
        createdAt: new Date().toISOString(),
        dueAt,
        sourceRecommendationId: rec.id,
      };
      return pushHistory(
        {
          ...prev,
          todos: [todo, ...(prev.todos ?? [])],
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "done" } : r,
          ),
        },
        makeHistoryEvent({
          type: "suggestion_accepted",
          title: "Suggestion accepted",
          detail: rec.title,
          projectId: rec.projectId,
          source: "user",
        }),
      );
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
    let nextDone = false;
    let projectId: string | null | undefined;
    let title = "";
    setState((prev) => {
      const todo = (prev.todos ?? []).find((t) => t.id === todoId);
      if (!todo) return prev;
      nextDone = !todo.done;
      projectId = todo.projectId;
      title = todo.title;
      return pushHistory(
        {
          ...prev,
          todos: (prev.todos ?? []).map((t) =>
            t.id === todoId ? { ...t, done: nextDone } : t,
          ),
        },
        makeHistoryEvent({
          type: nextDone ? "task_completed" : "task_updated",
          title: nextDone ? "You completed a To Do" : "You reopened a To Do",
          detail: todo.title,
          projectId: todo.projectId,
          source: "user",
        }),
      );
    });
    const meta = persistMetaRef.current;
    if (meta.mode === "supabase" && meta.workspaceId) {
      void (async () => {
        try {
          const client = createBrowserSupabaseClient();
          await persistTodoUpdate(client, todoId, { done: nextDone });
          await persistHistoryEvent(client, meta.workspaceId!, meta.userId, {
            type: nextDone ? "task_completed" : "task_updated",
            title: nextDone ? "You completed a To Do" : "You reopened a To Do",
            detail: title,
            projectId,
            source: "user",
          });
        } catch (err) {
          console.error("[toggleTodo] persist failed", err);
          setSaveStatus("error");
          setSaveError(
            err instanceof Error ? err.message : "Could not save To Do",
          );
        }
      })();
    }
  }, []);

  const removeTodo = useCallback((todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: (prev.todos ?? []).filter((t) => t.id !== todoId),
    }));
    const meta = persistMetaRef.current;
    if (meta.mode === "supabase" && meta.workspaceId) {
      void (async () => {
        try {
          const client = createBrowserSupabaseClient();
          await persistTodoDelete(client, todoId);
        } catch (err) {
          console.error("[removeTodo] persist failed", err);
          setSaveStatus("error");
          setSaveError(
            err instanceof Error ? err.message : "Could not delete To Do",
          );
        }
      })();
    }
  }, []);

  const addTodo = useCallback((input: AddTodoInput) => {
    const title = input.title.trim();
    if (!title) return;
    const meta = persistMetaRef.current;

    const buildDueAt = (prev: MissionState) => {
      const project = input.projectId
        ? prev.projects.find((p) => p.id === input.projectId)
        : undefined;
      return input.dueAt
        ? clampDueToWindow(
            project,
            input.dueAt.includes("T")
              ? input.dueAt
              : new Date(`${input.dueAt}T09:00:00`).toISOString(),
          )
        : undefined;
    };

    if (meta.mode === "supabase" && meta.workspaceId) {
      void (async () => {
        setSaveStatus("saving");
        setSaveError(null);
        try {
          const client = createBrowserSupabaseClient();
          const dueAt = buildDueAt(stateRef.current);
          const created = await persistTodoCreate(
            client,
            meta.workspaceId!,
            meta.userId,
            {
              projectId: input.projectId ?? null,
              title,
              detail: input.detail?.trim() || undefined,
              done: false,
              dueAt,
              kind: input.kind,
              waitingOn: input.waitingOn?.trim() || undefined,
            },
          );
          setState((prev) =>
            pushHistory(
              { ...prev, todos: [created, ...(prev.todos ?? [])] },
              makeHistoryEvent({
                type: "task_added",
                title: "You added a To Do",
                detail: title,
                projectId: input.projectId ?? null,
                source: "user",
              }),
            ),
          );
          await persistHistoryEvent(client, meta.workspaceId!, meta.userId, {
            type: "task_added",
            title: "You added a To Do",
            detail: title,
            projectId: input.projectId ?? null,
            source: "user",
          });
          setSaveStatus("saved");
        } catch (err) {
          console.error("[addTodo] persist failed", err);
          setSaveStatus("error");
          setSaveError(
            err instanceof Error ? err.message : "Could not save To Do",
          );
        }
      })();
      return;
    }

    setState((prev) => {
      const dueAt = buildDueAt(prev);
      const todo: TodoItem = {
        id: id("todo"),
        projectId: input.projectId ?? null,
        title,
        detail: input.detail?.trim() || undefined,
        done: false,
        createdAt: new Date().toISOString(),
        dueAt,
        kind: input.kind,
        waitingOn: input.waitingOn?.trim() || undefined,
      };
      return pushHistory(
        { ...prev, todos: [todo, ...(prev.todos ?? [])] },
        makeHistoryEvent({
          type: "task_added",
          title: "You added a To Do",
          detail: title,
          projectId: input.projectId ?? null,
          source: "user",
        }),
      );
    });
  }, []);

  const updateTodo = useCallback((todoId: string, patch: UpdateTodoInput) => {
    setState((prev) => {
      const before = (prev.todos ?? []).find((t) => t.id === todoId);
      if (!before) return prev;
      const projectId =
        patch.projectId !== undefined ? patch.projectId : before.projectId;
      const project = projectId
        ? prev.projects.find((p) => p.id === projectId)
        : undefined;
      let dueAt = before.dueAt;
      if (patch.dueAt === null) dueAt = undefined;
      else if (typeof patch.dueAt === "string") {
        const iso = patch.dueAt.includes("T")
          ? patch.dueAt
          : new Date(`${patch.dueAt}T09:00:00`).toISOString();
        dueAt = clampDueToWindow(project, iso);
      }
      const next = {
        ...before,
        title:
          patch.title !== undefined
            ? patch.title.trim() || before.title
            : before.title,
        detail:
          patch.detail === null
            ? undefined
            : patch.detail !== undefined
              ? patch.detail.trim() || undefined
              : before.detail,
        done: patch.done ?? before.done,
        projectId,
        dueAt,
        kind:
          patch.kind === null
            ? undefined
            : patch.kind !== undefined
              ? patch.kind
              : before.kind,
        waitingOn:
          patch.waitingOn === null
            ? undefined
            : patch.waitingOn !== undefined
              ? patch.waitingOn.trim() || undefined
              : before.waitingOn,
      };

      const changes: string[] = [];
      if (before.title !== next.title) {
        changes.push(`Title:\n${before.title} → ${next.title}`);
      }
      if ((before.projectId ?? null) !== (next.projectId ?? null)) {
        const b =
          before.projectId
            ? prev.projects.find((p) => p.id === before.projectId)?.code ?? "—"
            : "Unassigned";
        const a =
          next.projectId
            ? prev.projects.find((p) => p.id === next.projectId)?.code ?? "—"
            : "Unassigned";
        changes.push(`Project:\n${b} → ${a}`);
      }
      if ((before.dueAt ?? "") !== (next.dueAt ?? "")) {
        const fmt = (iso?: string) =>
          iso
            ? new Date(iso).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "None";
        changes.push(`Due date:\n${fmt(before.dueAt)} → ${fmt(next.dueAt)}`);
      }
      if ((before.detail ?? "") !== (next.detail ?? "")) {
        changes.push("Notes updated");
      }

      const updated = {
        ...prev,
        todos: (prev.todos ?? []).map((t) => (t.id === todoId ? next : t)),
      };
      if (!changes.length) return updated;
      return pushHistory(
        updated,
        makeHistoryEvent({
          type: "task_updated",
          title: "You updated a To Do",
          detail: `${next.title}\n${changes.join("\n")}`,
          projectId: next.projectId,
          source: "user",
        }),
      );
    });
    const meta = persistMetaRef.current;
    if (meta.mode === "supabase" && meta.workspaceId) {
      void (async () => {
        try {
          const client = createBrowserSupabaseClient();
          await persistTodoUpdate(client, todoId, {
            title: patch.title,
            detail: patch.detail,
            dueAt: patch.dueAt,
            done: patch.done,
            projectId: patch.projectId,
            kind: patch.kind,
            waitingOn: patch.waitingOn,
          });
        } catch (err) {
          console.error("[updateTodo] persist failed", err);
          setSaveStatus("error");
          setSaveError(
            err instanceof Error ? err.message : "Could not save To Do",
          );
        }
      })();
    }
  }, []);

  const resolveNudge = useCallback(
    (input: {
      nudgeId: string;
      person: string;
      subject: string;
      projectId?: string | null;
      daysWaiting?: number;
      source?: "stakeholder" | "recommendation";
      recommendationId?: string;
    }) => {
      setState((prev) => {
        const marker = `#nudge:${input.nudgeId}`;
        const already = (prev.history ?? []).some(
          (h) =>
            h.type === "nudge_resolved" && (h.detail ?? "").includes(marker),
        );
        if (already) return prev;
        const projectCode = input.projectId
          ? prev.projects.find((p) => p.id === input.projectId)?.code
          : null;
        const waiting =
          typeof input.daysWaiting === "number" && input.daysWaiting > 0
            ? `Waiting ${input.daysWaiting}d`
            : null;
        const detail = [
          `${input.person} — ${input.subject}`,
          projectCode,
          waiting,
          marker,
        ]
          .filter(Boolean)
          .join("\n");
        return pushHistory(
          prev,
          makeHistoryEvent({
            type: "nudge_resolved",
            title: "You resolved a Nudge",
            detail,
            projectId: input.projectId,
            source: input.source === "recommendation" ? "ai" : "user",
          }),
        );
      });
    },
    [],
  );

  const updateMeeting = useCallback(
    (
      meetingId: string,
      patch: {
        title?: string;
        projectId?: string;
        startsAt?: string;
        objectives?: string[];
        openingScript?: string;
        talkingPoints?: string[];
        questionsToAsk?: string[];
        risksToDiscuss?: string[];
      },
    ) => {
      setState((prev) => {
        const before = prev.meetings.find((m) => m.id === meetingId);
        if (!before) return prev;
        const next = {
          ...before,
          title: patch.title?.trim() || before.title,
          projectId: patch.projectId ?? before.projectId,
          startsAt: patch.startsAt ?? before.startsAt,
          prep: {
            ...before.prep,
            objectives: patch.objectives ?? before.prep.objectives,
            openingScript:
              patch.openingScript !== undefined
                ? patch.openingScript
                : before.prep.openingScript,
            talkingPoints: patch.talkingPoints ?? before.prep.talkingPoints,
            questionsToAsk: patch.questionsToAsk ?? before.prep.questionsToAsk,
            risksToDiscuss: patch.risksToDiscuss ?? before.prep.risksToDiscuss,
          },
        };
        const changes: string[] = [];
        if (before.title !== next.title) {
          changes.push(`Title:\n${before.title} → ${next.title}`);
        }
        if (before.startsAt !== next.startsAt) {
          changes.push("Date/time updated");
        }
        if (before.prep.openingScript !== next.prep.openingScript) {
          changes.push("Opening updated");
        }
        if (
          JSON.stringify(before.prep.objectives) !==
          JSON.stringify(next.prep.objectives)
        ) {
          changes.push("Objectives updated");
        }
        const updated = {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? next : m,
          ),
        };
        if (!changes.length) return updated;
        return pushHistory(
          updated,
          makeHistoryEvent({
            type: "meeting_created",
            title: "You updated Meeting Prep",
            detail: `${next.title}\n${changes.join("\n")}`,
            projectId: next.projectId,
            source: "user",
          }),
        );
      });
    },
    [],
  );

  const updateTodoDueDate = useCallback(
    (todoId: string, dueAt: string | undefined) => {
      setState((prev) => ({
        ...prev,
        todos: (prev.todos ?? []).map((t) => {
          if (t.id !== todoId) return t;
          if (!dueAt) return { ...t, dueAt: undefined };
          const project = t.projectId
            ? prev.projects.find((p) => p.id === t.projectId)
            : undefined;
          const iso = dueAt.includes("T")
            ? dueAt
            : new Date(`${dueAt}T09:00:00`).toISOString();
          return { ...t, dueAt: clampDueToWindow(project, iso) };
        }),
      }));
    },
    [],
  );

  const addSuggestion = useCallback((input: AddSuggestionInput) => {
    const title = input.title.trim();
    if (!title || !input.projectId) return null;
    const recId = id("rec");
    setState((prev) => ({
      ...prev,
      recommendations: [
        {
          id: recId,
          kind: input.kind ?? "leadership",
          urgency: input.urgency ?? "today",
          title,
          action: input.action?.trim() || title,
          why:
            input.why?.trim() ||
            "Accepted from Assistant PM Coach into Suggestions.",
          leadershipImpact:
            "You convert coaching into owned follow-through instead of leaving advice unused.",
          projectId: input.projectId,
          createdAt: new Date().toISOString(),
          status: "active" as const,
        },
        ...prev.recommendations,
      ],
    }));
    return recId;
  }, []);

  const createProject = useCallback(async (input: CreateProjectInput) => {
    let meta = persistMetaRef.current;

    // Supabase mode: create via server cookies so we never depend on the
    // browser client session being ready (that race caused vanish-on-refresh).
    if (meta.mode === "supabase") {
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const res = await fetch("/api/workspace/projects", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        if (!res.ok) {
          const fail = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            fail?.error || "Could not save project to your account.",
          );
        }
        const payload = (await res.json()) as {
          workspaceId: string;
          userId: string;
          projectId: string;
          state: MissionState;
        };
        persistMetaRef.current = {
          mode: "supabase",
          workspaceId: payload.workspaceId,
          userId: payload.userId,
        };
        setState(normaliseState(payload.state));
        setSaveStatus("saved");
        setSaveError(null);
        return payload.projectId;
      } catch (err) {
        // Fall back to browser persist only if we already have a workspace.
        meta = persistMetaRef.current;
        if (!(meta.mode === "supabase" && meta.workspaceId)) {
          const message =
            err instanceof Error ? err.message : "Could not save project";
          setSaveStatus("error");
          setSaveError(message);
          throw err instanceof Error ? err : new Error(message);
        }
        console.error(
          "[MissionProvider] server create failed; trying browser persist",
          err,
        );
      }
    }

    // If we're in supabase mode but hydrate failed to attach a workspace,
    // bootstrap via the server cookie path before creating — never silently
    // create a local-only project that vanishes on refresh.
    if (meta.mode === "supabase" && !meta.workspaceId) {
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const boot = await fetch("/api/workspace/state", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!boot.ok) {
          const fail = (await boot.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            fail?.error || "Could not open your workspace. Please refresh.",
          );
        }
        const payload = (await boot.json()) as {
          workspaceId: string;
          userId: string;
          state: MissionState;
        };
        persistMetaRef.current = {
          mode: "supabase",
          workspaceId: payload.workspaceId,
          userId: payload.userId,
        };
        meta = persistMetaRef.current;
        // Adopt server state if we somehow had stale empty client state.
        if (stateRef.current.projects.length === 0 && payload.state.projects.length) {
          setState(normaliseState(payload.state));
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not open workspace";
        setSaveStatus("error");
        setSaveError(message);
        throw err;
      }
    }

    if (meta.mode === "supabase" && meta.workspaceId) {
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const client = createBrowserSupabaseClient();
        // Ensure browser session exists for RLS writes.
        await waitForBrowserUser(client);
        const persisted = await persistNewProject(
          client,
          meta.workspaceId,
          meta.userId,
          input,
        );
        const setupMemory = (
          persisted as typeof persisted & {
            setupMemory?: import("@/lib/types").MemoryEntry;
          }
        ).setupMemory;
        setState((prev) => ({
          ...prev,
          projects: [...prev.projects, persisted.project],
          knowledge: [...(prev.knowledge ?? []), persisted.knowledge],
          recommendations: [
            ...persisted.recommendations,
            ...prev.recommendations,
          ],
          todos: [...persisted.todos, ...(prev.todos ?? [])],
          timeline: [...(persisted.timeline ?? []), ...(prev.timeline ?? [])],
          memories: setupMemory
            ? [setupMemory, ...(prev.memories ?? [])]
            : prev.memories,
          history: [
            makeHistoryEvent({
              type: "project_created",
              title: `Created ${persisted.project.name}`,
              detail: persisted.project.code,
              projectId: persisted.project.id,
              source: "user",
            }),
            ...(prev.history ?? []),
          ],
          lastAnalyzedAt: new Date().toISOString(),
        }));
        setSaveStatus("saved");
        return persisted.project.id;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save project";
        setSaveStatus("error");
        setSaveError(message);
        throw err;
      }
    }

    if (process.env.NODE_ENV === "production") {
      const message =
        "Project was not saved to your account. Please refresh and try again.";
      setSaveStatus("error");
      setSaveError(message);
      throw new Error(message);
    }

    const bundle = buildNewProject(input);
    setState((prev) => {
      let next = {
        ...prev,
        projects: [...prev.projects, bundle.project],
        knowledge: [...(prev.knowledge ?? []), bundle.knowledge],
        recommendations: [
          ...bundle.recommendations,
          ...prev.recommendations,
        ],
        todos: [...bundle.todos, ...(prev.todos ?? [])],
        timeline: [...(bundle.timeline ?? []), ...(prev.timeline ?? [])],
        lastAnalyzedAt: new Date().toISOString(),
      };
      if (input.sourceNarrative?.trim()) {
        const memory = {
          id: `mem-setup-${bundle.project.id}`,
          type: "conversation" as const,
          projectId: bundle.project.id,
          title: `Project setup — ${bundle.project.code}`,
          content: input.sourceNarrative.trim(),
          tags: ["project-setup", input.sourceMode ?? "setup"],
          people: (input.stakeholders ?? []).map((s) => s.name).filter(Boolean),
          occurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          source: "capture" as const,
        };
        next = {
          ...next,
          memories: [memory, ...(next.memories ?? [])],
        };
      }
      return pushHistory(
        next,
        makeHistoryEvent({
          type: "project_created",
          title: `Created ${bundle.project.name}`,
          detail: bundle.project.code,
          projectId: bundle.project.id,
          source: "user",
        }),
      );
    });
    return bundle.project.id;
  }, []);

  const cloneRelOps = useCallback((input: CloneRelOpsInput) => {
    setState((prev) => cloneRelOpsProject(prev, input));
  }, []);

  const refreshSuggestions = useCallback((projectId: string) => {
    setState((prev) => ({
      ...prev,
      recommendations: refreshProjectSuggestions(prev, projectId),
      lastAnalyzedAt: new Date().toISOString(),
    }));
  }, []);

  const updateKnowledgeSection = useCallback(
    (
      projectId: string,
      sectionId: KnowledgeSectionId,
      bullets: string[],
    ) => {
      let nextKnowledge: ProjectKnowledge | null = null;
      setState((prev) => {
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const cleaned = bullets
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 8);
        const sections = { ...current.sections, [sectionId]: cleaned };
        const next: ProjectKnowledge = {
          ...current,
          updatedAt: new Date().toISOString(),
          sections,
          sectionItemIds: alignSectionItemIds(current, sections, [sectionId]),
          structured: remapStructuredForSections(current, sections, [
            sectionId,
          ]),
        };
        nextKnowledge = next;
        return pushHistory(
          {
            ...prev,
            knowledge: [
              ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
              next,
            ],
          },
          makeHistoryEvent({
            type: "knowledge_updated",
            title: "You updated Knowledge",
            detail: `${sectionId} updated`,
            projectId,
            source: "user",
          }),
        );
      });

      const meta = persistMetaRef.current;
      if (
        meta.mode === "supabase" &&
        meta.workspaceId &&
        nextKnowledge
      ) {
        const desired = nextKnowledge;
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            await persistKnowledgeReconcile(
              client,
              meta.workspaceId!,
              projectId,
              desired,
              meta.userId,
              [sectionId],
            );
          } catch (err) {
            console.error("[updateKnowledgeSection] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error
                ? err.message
                : "Could not save knowledge correction",
            );
          }
        })();
      }
    },
    [],
  );

  const addKnowledgeBullet = useCallback(
    (projectId: string, sectionId: KnowledgeSectionId, bullet: string) => {
      const trimmed = bullet.trim();
      if (!trimmed) return;
      const riskId = sectionId === "risks" ? newClientId() : null;
      setState((prev) => {
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const merged = mergeKnowledge(current, projectId, {
          [sectionId]: [trimmed],
        });
        const nextRisks =
          sectionId === "risks" && riskId
            ? [
                ...(prev.risks ?? []),
                {
                  id: riskId,
                  projectId,
                  title: trimmed,
                  status: "open" as const,
                  source: "manual" as const,
                  createdAt: new Date().toISOString(),
                },
              ]
            : prev.risks ?? [];
        return {
          ...prev,
          knowledge: [
            ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
            merged,
          ],
          risks: nextRisks,
        };
      });
      const meta = persistMetaRef.current;
      if (meta.mode === "supabase" && meta.workspaceId) {
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            await persistKnowledgeBullet(
              client,
              meta.workspaceId!,
              projectId,
              sectionId,
              trimmed,
              meta.userId,
              riskId ? { riskId } : undefined,
            );
          } catch (err) {
            console.error("[addKnowledgeBullet] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error ? err.message : "Could not save knowledge",
            );
          }
        })();
      }
    },
    [],
  );

  const setRiskStatus = useCallback(
    (riskId: string, status: RiskStatus, projectId: string) => {
      let syncedKnowledge: ProjectKnowledge | null = null;
      setState((prev) => {
        const existing = findProjectRisk(prev.risks, riskId, projectId);
        if (!existing) return prev;
        const updatedRisk = { ...existing, status, updatedAt: new Date().toISOString() };
        const risks = (prev.risks ?? []).map((r) =>
          r.id === riskId && r.projectId === projectId ? updatedRisk : r,
        );
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const nextKnowledge = syncKnowledgeRiskProjection(current, updatedRisk);
        syncedKnowledge = nextKnowledge;
        return {
          ...prev,
          risks,
          knowledge: [
            ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
            nextKnowledge,
          ],
        };
      });

      const meta = persistMetaRef.current;
      if (meta.mode === "supabase" && meta.workspaceId) {
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            await persistRiskStatus(
              client,
              meta.workspaceId!,
              projectId,
              riskId,
              status,
            );
            if (syncedKnowledge) {
              await persistKnowledgeReconcile(
                client,
                meta.workspaceId!,
                projectId,
                syncedKnowledge,
                meta.userId,
                ["risks"],
              );
            }
          } catch (err) {
            console.error("[setRiskStatus] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error
                ? err.message
                : "Could not save risk status",
            );
          }
        })();
      }
    },
    [],
  );

  const setKnowledgeOnlyRiskResolved = useCallback(
    (projectId: string, title: string, resolved: boolean) => {
      let nextKnowledge: ProjectKnowledge | null = null;
      setState((prev) => {
        const current =
          (prev.knowledge ?? []).find((k) => k.projectId === projectId) ??
          emptyKnowledge(projectId);
        const next = resolved
          ? resolveKnowledgeOnlyRiskBullet(current, title)
          : reopenKnowledgeOnlyRiskBullet(current, title);
        nextKnowledge = next;
        return {
          ...prev,
          knowledge: [
            ...(prev.knowledge ?? []).filter((k) => k.projectId !== projectId),
            next,
          ],
        };
      });

      const meta = persistMetaRef.current;
      if (meta.mode === "supabase" && meta.workspaceId && nextKnowledge) {
        const desired = nextKnowledge;
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            await persistKnowledgeReconcile(
              client,
              meta.workspaceId!,
              projectId,
              desired,
              meta.userId,
              ["risks"],
            );
          } catch (err) {
            console.error("[setKnowledgeOnlyRiskResolved] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error
                ? err.message
                : "Could not save knowledge risk",
            );
          }
        })();
      }
    },
    [],
  );

  const replaceKnowledge = useCallback((knowledge: ProjectKnowledge) => {
    let nextKnowledge: ProjectKnowledge | null = null;
    setState((prev) => {
      const previous =
        (prev.knowledge ?? []).find((k) => k.projectId === knowledge.projectId) ??
        emptyKnowledge(knowledge.projectId);
      const sections = knowledge.sections;
      const next: ProjectKnowledge = {
        ...knowledge,
        updatedAt: new Date().toISOString(),
        sectionItemIds:
          knowledge.sectionItemIds ??
          alignSectionItemIds(previous, sections),
        structured:
          knowledge.structured ??
          remapStructuredForSections(previous, sections),
      };
      nextKnowledge = next;
      return {
        ...prev,
        knowledge: [
          ...(prev.knowledge ?? []).filter(
            (k) => k.projectId !== knowledge.projectId,
          ),
          next,
        ],
      };
    });

    const meta = persistMetaRef.current;
    if (meta.mode === "supabase" && meta.workspaceId && nextKnowledge) {
      const desired = nextKnowledge;
      void (async () => {
        try {
          const client = createBrowserSupabaseClient();
          await persistKnowledgeReconcile(
            client,
            meta.workspaceId!,
            knowledge.projectId,
            desired,
            meta.userId,
          );
        } catch (err) {
          console.error("[replaceKnowledge] persist failed", err);
          setSaveStatus("error");
          setSaveError(
            err instanceof Error
              ? err.message
              : "Could not save knowledge correction",
          );
        }
      })();
    }
  }, []);

  const confirmResponsibilityOwner = useCallback(
    (input: {
      projectId: string;
      scope: string;
      personName: string;
      personId?: string | null;
      resolveTruthItemId?: string | null;
      replacePersonId?: string | null;
    }) => {
      const bag: {
        peopleBullet: string;
        itemId: string;
        kind: string;
        epistemic: string;
        lifecycle: string;
        supersedesId: string | null;
        meta: Record<string, unknown>;
        provenance: unknown[];
        personId: string;
        personName: string;
        personRole: string;
        supersededIds: string[];
        responsibilityCreated: boolean;
      } = {
        peopleBullet: "",
        itemId: "",
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        supersedesId: null,
        meta: {},
        provenance: [],
        personId: "",
        personName: "",
        personRole: "Stakeholder",
        supersededIds: [],
        responsibilityCreated: false,
      };

      setState((prev) => {
        const result = applyConfirmResponsibilityOwner({
          state: prev,
          ...input,
        });
        bag.peopleBullet = result.peopleBullet;
        bag.itemId = result.item.id;
        bag.kind = result.item.kind;
        bag.epistemic = result.item.epistemic ?? "confirmed";
        bag.lifecycle = result.item.lifecycle;
        bag.supersedesId = result.item.supersedesId ?? null;
        bag.meta = (result.item.meta as Record<string, unknown>) ?? {};
        bag.provenance = result.item.provenance ?? [];
        bag.personId = result.person.id;
        bag.personName = result.person.name;
        bag.personRole = result.person.role;
        bag.supersededIds = result.supersededIds;
        bag.responsibilityCreated = result.responsibilityCreated;
        return result.state;
      });

      const meta = persistMetaRef.current;
      if (meta.mode === "supabase" && meta.workspaceId && bag.peopleBullet) {
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            await persistEnsureStakeholder(
              client,
              meta.workspaceId!,
              input.projectId,
              {
                id: bag.personId,
                name: bag.personName,
                role: bag.personRole,
              },
            );
            if (bag.supersededIds.length) {
              await persistKnowledgeLifecycle(
                client,
                meta.workspaceId!,
                input.projectId,
                bag.supersededIds.filter((id) =>
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    id,
                  ),
                ),
                "superseded",
              );
            }
            if (bag.responsibilityCreated) {
              await persistKnowledgeBullet(
                client,
                meta.workspaceId!,
                input.projectId,
                "people",
                bag.peopleBullet,
                meta.userId,
                {
                  id: bag.itemId,
                  kind: bag.kind,
                  epistemic: bag.epistemic,
                  lifecycle: bag.lifecycle,
                  supersedesId: bag.supersedesId,
                  meta: bag.meta,
                  provenance: bag.provenance,
                },
              );
            }
          } catch (err) {
            console.error("[confirmResponsibilityOwner] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error
                ? err.message
                : "Could not save confirmed owner",
            );
          }
        })();
      }
    },
    [],
  );

  const addTimelineItem = useCallback(
    (
      projectId: string,
      item: TimelineItemInput & { source?: TimelineItem["source"] },
    ) => {
      const meta = persistMetaRef.current;
      if (meta.mode === "supabase" && meta.workspaceId) {
        void (async () => {
          try {
            const client = createBrowserSupabaseClient();
            const created = await persistTimelineItem(
              client,
              meta.workspaceId!,
              projectId,
              {
                label: item.label,
                type: item.type,
                startAt: item.startAt,
                endAt: item.endAt,
                notes: item.notes,
                source: item.source ?? "manual",
              },
            );
            setState((prev) => ({
              ...prev,
              timeline: [...(prev.timeline ?? []), created],
            }));
          } catch (err) {
            console.error("[addTimelineItem] persist failed", err);
            setSaveStatus("error");
            setSaveError(
              err instanceof Error ? err.message : "Could not save date",
            );
          }
        })();
        return;
      }
      setState((prev) => ({
        ...prev,
        timeline: mergeTimelineItems(
          prev.timeline ?? [],
          projectId,
          [item],
          item.source ?? "manual",
        ),
      }));
    },
    [],
  );

  const refreshCoaching = useCallback(() => {
    setState((prev) => withProactiveCoaching(prev));
  }, []);

  const resetDemo = useCallback((): SeedResetResult => {
    const previous = stateRef.current;
    try {
      const result = resetSeedData(previous);
      if (!result.ok) {
        if (process.env.NODE_ENV === "development") {
          console.error("[resetDemo] seed merge failed", result.error);
        }
        return result;
      }

      // Persist only after a complete successful merge (localStorage is atomic per key).
      persist(result.state);
      setState(result.state);

      try {
        pruneSeededSessions({
          seedProjectIds: result.manifest.projectIds,
          seedCaptureSessionIds:
            result.manifest.recordIdsByType.captureSessions ?? [],
          seedCoachingSessionIds:
            result.manifest.recordIdsByType.coachingSessions ?? [],
        });
        clearActiveCaptureIfSeeded(result.manifest.projectIds);
      } catch (sessionErr) {
        if (process.env.NODE_ENV === "development") {
          console.error("[resetDemo] session prune failed", sessionErr);
        }
        // Mission state already restored; surface soft failure for retry of prune only.
      }

      return result;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[resetDemo] failed", err);
      }
      // Do not persist partial state — previous in-memory state remains until next success.
      setState(previous);
      return { ok: false, error: "Could not restore demo data." };
    }
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      openaiConfigured,
      openaiDiagnostics,
      capture,
      captureWithAI,
      analyzeCaptureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
      acceptSuggestion,
      dismissSuggestion,
      toggleTodo,
      removeTodo,
      addTodo,
      updateTodo,
      updateTodoDueDate,
      resolveNudge,
      updateMeeting,
      addSuggestion,
      createProject,
      cloneRelOps,
      refreshSuggestions,
      updateKnowledgeSection,
      addKnowledgeBullet,
      replaceKnowledge,
      setRiskStatus,
      setKnowledgeOnlyRiskResolved,
      confirmResponsibilityOwner,
      addTimelineItem,
      refreshCoaching,
      resetDemo,
      persistenceMode,
      saveStatus,
      saveError,
    }),
    [
      state,
      hydrated,
      openaiConfigured,
      openaiDiagnostics,
      persistenceMode,
      saveStatus,
      saveError,
      capture,
      captureWithAI,
      analyzeCaptureWithAI,
      applyCaptureResult,
      setRecommendationStatus,
      acceptSuggestion,
      dismissSuggestion,
      toggleTodo,
      removeTodo,
      addTodo,
      updateTodo,
      updateTodoDueDate,
      resolveNudge,
      updateMeeting,
      addSuggestion,
      createProject,
      cloneRelOps,
      refreshSuggestions,
      updateKnowledgeSection,
      addKnowledgeBullet,
      replaceKnowledge,
      setRiskStatus,
      setKnowledgeOnlyRiskResolved,
      confirmResponsibilityOwner,
      addTimelineItem,
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
