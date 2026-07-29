"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  parseCoachActions,
  resolveProjectId,
  type CoachAction,
} from "@/lib/coach-actions";
import { useMission } from "@/lib/store";
import {
  createCoachingSessionId,
  upsertCoachingSession,
  type CoachingSessionRecord,
} from "@/lib/sessions/history";

type AcceptedMap = Record<string, string>;
type RecState = "pending" | "accepted" | "dismissed";

type CoachSessionValue = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  scope: "overview" | "project";
  setScope: (value: "overview" | "project") => void;
  projectId: string | null;
  busy: boolean;
  error: string | null;
  title: string;
  markdown: string;
  provider: "openai" | "local" | null;
  lastRunAt: string | null;
  accepted: AcceptedMap;
  actions: CoachAction[];
  showResults: boolean;
  runCoach: () => Promise<void>;
  acceptAction: (
    action: CoachAction,
    mode: "todo" | "suggestion" | "knowledge",
  ) => void;
  dismissResults: () => void;
};

const CoachSessionContext = createContext<CoachSessionValue | null>(null);

function buildRecommendationStates(
  actions: CoachAction[],
  accepted: AcceptedMap,
): Record<string, RecState> {
  const states: Record<string, RecState> = {};
  for (const action of actions) {
    states[action.id] = accepted[action.id] ? "accepted" : "pending";
  }
  return states;
}

function persistCoach(
  partial: Omit<CoachingSessionRecord, "updatedAt"> & { updatedAt?: string },
) {
  upsertCoachingSession(partial);
}

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, addTodo, addSuggestion, addKnowledgeBullet } = useMission();
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1] ?? null;
  const projectId = routeId && routeId !== "new" ? routeId : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scope, setScope] = useState<"overview" | "project">(
    projectId ? "project" : "overview",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);
  const [accepted, setAccepted] = useState<AcceptedMap>({});
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const historyIdRef = useRef<string | null>(null);
  const createdAtRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const openDrawer = useCallback(() => {
    setScope(projectId ? "project" : "overview");
    setDrawerOpen(true);
  }, [projectId]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const dismissResults = useCallback(() => {
    const id = historyIdRef.current;
    const createdAt = createdAtRef.current;
    if (id && createdAt && markdown) {
      const actions = parseCoachActions(markdown);
      const recommendationStates = buildRecommendationStates(actions, accepted);
      for (const action of actions) {
        if (recommendationStates[action.id] === "pending") {
          recommendationStates[action.id] = "dismissed";
        }
      }
      persistCoach({
        id,
        createdAt,
        scope:
          scope === "project" && projectId ? "project" : "all_projects",
        projectId: scope === "project" ? projectId : null,
        title: title || "Coaching",
        markdown,
        provider,
        recommendationStates,
        status: "dismissed",
      });
    }
    setShowResults(false);
  }, [accepted, markdown, projectId, provider, scope, title]);

  const runCoach = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDrawerOpen(false);
    setShowResults(true);
    setBusy(true);
    setError(null);
    setMarkdown("");
    setTitle("");
    setProvider(null);
    setAccepted({});
    historyIdRef.current = createCoachingSessionId();
    createdAtRef.current = new Date().toISOString();

    const effectiveScope =
      scope === "project" && projectId
        ? { mode: "project" as const, projectId }
        : { mode: "overview" as const };

    let finalMarkdown = "";
    let finalTitle = "Coaching";
    let finalProvider: "openai" | "local" | null = null;

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scope: effectiveScope,
          state: {
            projects: state.projects,
            memories: state.memories.slice(0, 60),
            recommendations: state.recommendations
              .filter((r) => r.status === "active")
              .slice(0, 40),
            meetings: state.meetings,
            releases: state.releases,
            todos: state.todos ?? [],
            knowledge: state.knowledge ?? [],
            timeline: state.timeline ?? [],
          },
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Coach request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as {
              type: string;
              title?: string;
              provider?: "openai" | "local";
              text?: string;
              markdown?: string;
              error?: string;
            };
            if (event.type === "meta") {
              finalTitle = event.title || "Coaching";
              finalProvider = event.provider ?? null;
              setTitle(finalTitle);
              setProvider(finalProvider);
            } else if (event.type === "delta" && event.text) {
              finalMarkdown += event.text;
              setMarkdown((prev) => prev + event.text);
            } else if (event.type === "done" && event.markdown) {
              finalMarkdown = event.markdown;
              setMarkdown(event.markdown);
            } else if (event.type === "error") {
              throw new Error(event.error || "Coach failed");
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }
      const runAt = new Date().toISOString();
      setLastRunAt(runAt);
      const id = historyIdRef.current;
      const createdAt = createdAtRef.current ?? runAt;
      if (id && finalMarkdown.trim()) {
        const actions = parseCoachActions(finalMarkdown);
        persistCoach({
          id,
          createdAt,
          scope:
            scope === "project" && projectId ? "project" : "all_projects",
          projectId: scope === "project" ? projectId : null,
          title: finalTitle,
          markdown: finalMarkdown,
          provider: finalProvider,
          recommendationStates: buildRecommendationStates(actions, {}),
          status: "active",
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, scope, state]);

  const acceptAction = useCallback(
    (action: CoachAction, mode: "todo" | "suggestion" | "knowledge") => {
      const resolvedProjectId = resolveProjectId(
        state.projects,
        scope === "project" ? projectId : null,
        action.projectCode,
      );
      let label = "";
      if (mode === "todo") {
        addTodo({
          title: action.title,
          detail: action.text !== action.title ? action.text : undefined,
          projectId: resolvedProjectId,
        });
        label = "Added to To Do";
      } else if (mode === "suggestion") {
        if (!resolvedProjectId) {
          setError("Pick a project scope, or include a project code.");
          return;
        }
        addSuggestion({
          projectId: resolvedProjectId,
          title: action.title,
          action: action.text,
          why: "Accepted from Coach.",
          kind: action.section === "risk" ? "risk" : "leadership",
        });
        label = "Added to Suggestions";
      } else {
        if (!resolvedProjectId) {
          setError("Pick a project scope to add into Knowledge.");
          return;
        }
        addKnowledgeBullet(
          resolvedProjectId,
          action.section === "risk" ? "risks" : "openLoops",
          action.title,
        );
        label = "Added to Knowledge";
      }

      setAccepted((prev) => {
        const next = { ...prev, [action.id]: label };
        const id = historyIdRef.current;
        const createdAt = createdAtRef.current;
        if (id && createdAt && markdown) {
          const allActions = parseCoachActions(markdown);
          persistCoach({
            id,
            createdAt,
            scope:
              scope === "project" && projectId ? "project" : "all_projects",
            projectId: scope === "project" ? projectId : null,
            title: title || "Coaching",
            markdown,
            provider,
            recommendationStates: buildRecommendationStates(allActions, next),
            status: "active",
          });
        }
        return next;
      });
    },
    [
      addKnowledgeBullet,
      addSuggestion,
      addTodo,
      markdown,
      projectId,
      provider,
      scope,
      state.projects,
      title,
    ],
  );

  const actions = useMemo(() => parseCoachActions(markdown), [markdown]);

  const value = useMemo(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      scope,
      setScope,
      projectId,
      busy,
      error,
      title,
      markdown,
      provider,
      lastRunAt,
      accepted,
      actions,
      showResults,
      runCoach,
      acceptAction,
      dismissResults,
    }),
    [
      acceptAction,
      accepted,
      actions,
      busy,
      closeDrawer,
      dismissResults,
      drawerOpen,
      error,
      lastRunAt,
      markdown,
      openDrawer,
      projectId,
      provider,
      runCoach,
      scope,
      showResults,
      title,
    ],
  );

  return (
    <CoachSessionContext.Provider value={value}>
      {children}
    </CoachSessionContext.Provider>
  );
}

export function useCoachSession() {
  const ctx = useContext(CoachSessionContext);
  if (!ctx) {
    throw new Error("useCoachSession must be used within CoachSessionProvider");
  }
  return ctx;
}

export function openCoachDrawer() {
  window.dispatchEvent(new Event("lume:open-coach"));
}
