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

type AcceptedMap = Record<string, string>;

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
  const abortRef = useRef<AbortController | null>(null);

  const openDrawer = useCallback(() => {
    setScope(projectId ? "project" : "overview");
    setDrawerOpen(true);
  }, [projectId]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const dismissResults = useCallback(() => {
    setShowResults(false);
  }, []);

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

    const effectiveScope =
      scope === "project" && projectId
        ? { mode: "project" as const, projectId }
        : { mode: "overview" as const };

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
              setTitle(event.title || "Coaching");
              setProvider(event.provider ?? null);
            } else if (event.type === "delta" && event.text) {
              setMarkdown((prev) => prev + event.text);
            } else if (event.type === "done" && event.markdown) {
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
      setLastRunAt(new Date().toISOString());
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
      if (mode === "todo") {
        addTodo({
          title: action.title,
          detail: action.text !== action.title ? action.text : undefined,
          projectId: resolvedProjectId,
        });
        setAccepted((prev) => ({ ...prev, [action.id]: "Added to To Do" }));
        return;
      }
      if (mode === "suggestion") {
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
        setAccepted((prev) => ({
          ...prev,
          [action.id]: "Added to Suggestions",
        }));
        return;
      }
      if (!resolvedProjectId) {
        setError("Pick a project scope to add into Knowledge.");
        return;
      }
      addKnowledgeBullet(
        resolvedProjectId,
        action.section === "risk" ? "risks" : "openLoops",
        action.title,
      );
      setAccepted((prev) => ({ ...prev, [action.id]: "Added to Knowledge" }));
    },
    [addKnowledgeBullet, addSuggestion, addTodo, projectId, scope, state.projects],
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
