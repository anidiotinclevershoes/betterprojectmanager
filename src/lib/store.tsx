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
import type { CaptureContextManifest } from "./capture/context";
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

const STORAGE_KEY = "mission-control-state-v5";

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
};

type UpdateTodoInput = {
  title?: string;
  detail?: string | null;
  dueAt?: string | null;
  done?: boolean;
  projectId?: string | null;
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
  analyzeCaptureWithAI: (input: CaptureInput) => Promise<{
    result: CaptureResult;
    contextManifest: CaptureContextManifest | null;
    requestId: string | null;
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
  createProject: (input: CreateProjectInput) => string;
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
  addTimelineItem: (
    projectId: string,
    item: TimelineItemInput & { source?: TimelineItem["source"] },
  ) => void;
  refreshCoaching: () => void;
  resetDemo: () => void;
};

const MissionContext = createContext<MissionContextValue | null>(null);

function normaliseState(raw: MissionState): MissionState {
  return {
    ...raw,
    todos: raw.todos ?? [],
    knowledge: raw.knowledge ?? [],
    timeline: raw.timeline ?? [],
    history: raw.history ?? [],
    analysesThisMonth: raw.analysesThisMonth ?? 0,
    analysesMonthKey: raw.analysesMonthKey,
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
  const next: MissionState = {
    ...prev,
    todos: prev.todos ?? [],
    knowledge: applyKnowledgePatch(
      prev.knowledge ?? [],
      projectId ?? "",
      result.knowledgePatch,
    ),
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
        timelinePatch: projectId
          ? extractTimelinePatchFromText(input.content)
          : undefined,
      };
      return mergeCapture(prev, result);
    });
    return result;
  }, []);

  const requestCaptureAnalysis = useCallback(async (input: CaptureInput) => {
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
    };
  }, []);

  const analyzeCaptureWithAI = useCallback(
    async (input: CaptureInput) => {
      const { result, contextManifest, requestId } =
        await requestCaptureAnalysis(input);
      setState((prev) =>
        pushHistory(bumpAnalysisUsage(prev), makeHistoryEvent({
          type: "capture_analysed",
          title: "Capture analysed",
          detail: result.memory.title,
          projectId: result.memory.projectId ?? input.projectId,
          source: "ai",
        })),
      );
      return { result, contextManifest, requestId };
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
    setState((prev) => {
      const todo = (prev.todos ?? []).find((t) => t.id === todoId);
      if (!todo) return prev;
      const nextDone = !todo.done;
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
  }, []);

  const removeTodo = useCallback((todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: (prev.todos ?? []).filter((t) => t.id !== todoId),
    }));
  }, []);

  const addTodo = useCallback((input: AddTodoInput) => {
    const title = input.title.trim();
    if (!title) return;
    setState((prev) => {
      const project = input.projectId
        ? prev.projects.find((p) => p.id === input.projectId)
        : undefined;
      const dueAt = input.dueAt
        ? clampDueToWindow(
            project,
            input.dueAt.includes("T")
              ? input.dueAt
              : new Date(`${input.dueAt}T09:00:00`).toISOString(),
          )
        : undefined;
      const todo: TodoItem = {
        id: id("todo"),
        projectId: input.projectId ?? null,
        title,
        detail: input.detail?.trim() || undefined,
        done: false,
        createdAt: new Date().toISOString(),
        dueAt,
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

  const createProject = useCallback((input: CreateProjectInput) => {
    const bundle = buildNewProject(input);
    setState((prev) => ({
      ...prev,
      projects: [...prev.projects, bundle.project],
      knowledge: [...(prev.knowledge ?? []), bundle.knowledge],
      recommendations: [
        ...bundle.recommendations,
        ...prev.recommendations,
      ],
      todos: [...bundle.todos, ...(prev.todos ?? [])],
      lastAnalyzedAt: new Date().toISOString(),
    }));
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

  const addTimelineItem = useCallback(
    (
      projectId: string,
      item: TimelineItemInput & { source?: TimelineItem["source"] },
    ) => {
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
      addTimelineItem,
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
