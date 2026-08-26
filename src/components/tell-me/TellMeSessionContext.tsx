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
import { usePathname } from "next/navigation";
import { useMission } from "@/lib/store";
import {
  buildDeterministicSnapshot,
} from "@/lib/tell-me/snapshot-deterministic";
import {
  buildPersonalisedHint,
  buildSuggestedQuestions,
} from "@/lib/tell-me/suggestions";
import { buildCanonicalSuggestions } from "@/lib/canonical-truth/suggestions";
import type {
  ProjectIntelligenceSnapshot,
  TellMeAnswer,
  TellMeConversationTurn,
  TellMeSuggestedQuestion,
} from "@/lib/tell-me/types";

const SNAPSHOT_KEY = "lume-tell-me-snapshots-v1";

type SnapshotMap = Record<string, ProjectIntelligenceSnapshot>;

function loadLocalSnapshots(): SnapshotMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SnapshotMap;
  } catch {
    return {};
  }
}

function saveLocalSnapshots(map: SnapshotMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

type TellMeSessionValue = {
  open: boolean;
  openTellMe: (opts?: { prefill?: string; projectId?: string | null }) => void;
  closeTellMe: () => void;
  projectId: string | null;
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  refreshing: boolean;
  error: string | null;
  answer: TellMeAnswer | null;
  conversation: TellMeConversationTurn[];
  suggestions: TellMeSuggestedQuestion[];
  personalHint: string | null;
  snapshot: ProjectIntelligenceSnapshot | null;
  ask: (question?: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearThread: () => void;
  userDisplayName: string | null;
};

const TellMeSessionContext = createContext<TellMeSessionValue | null>(null);

export function TellMeSessionProvider({
  children,
  userDisplayName = null,
}: {
  children: ReactNode;
  userDisplayName?: string | null;
}) {
  const pathname = usePathname();
  const { state } = useMission();
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1] ?? null;
  const routeProjectId = routeId && routeId !== "new" ? routeId : null;

  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(routeProjectId);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<TellMeAnswer | null>(null);
  const [conversation, setConversation] = useState<TellMeConversationTurn[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMap>({});
  const conversationProjectRef = useRef<string | null>(routeProjectId);

  useEffect(() => {
    setSnapshots(loadLocalSnapshots());
  }, []);

  // Project isolation: never carry conversation turns across projects.
  useEffect(() => {
    if (conversationProjectRef.current !== routeProjectId) {
      conversationProjectRef.current = routeProjectId;
      setConversation([]);
      setAnswer(null);
      setError(null);
      setQuestion("");
    }
    setProjectId(routeProjectId);
  }, [routeProjectId]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ prefill?: string; projectId?: string }>)
        .detail;
      const nextId = detail?.projectId ?? routeProjectId ?? null;
      if (conversationProjectRef.current !== nextId) {
        conversationProjectRef.current = nextId;
        setConversation([]);
        setAnswer(null);
        setError(null);
        if (!detail?.prefill) setQuestion("");
      }
      setProjectId(nextId);
      if (detail?.prefill) setQuestion(detail.prefill);
      setOpen(true);
      setError(null);
    };
    window.addEventListener("lume:open-tell-me", onOpen as EventListener);
    return () =>
      window.removeEventListener("lume:open-tell-me", onOpen as EventListener);
  }, [routeProjectId]);

  useEffect(() => {
    const onDeleted = (event: Event) => {
      const deletedId = (event as CustomEvent<{ projectId?: string }>).detail
        ?.projectId;
      if (!deletedId) return;
      setSnapshots((prev) => {
        if (!(deletedId in prev)) return prev;
        const next = { ...prev };
        delete next[deletedId];
        saveLocalSnapshots(next);
        return next;
      });
    };
    window.addEventListener("lume:project-deleted", onDeleted);
    return () => window.removeEventListener("lume:project-deleted", onDeleted);
  }, []);

  const snapshot = projectId ? snapshots[projectId] ?? null : null;

  const suggestions = useMemo(() => {
    const legacy = buildSuggestedQuestions({
      state,
      projectId,
      userDisplayName,
      limit: 6,
    });
    const canonical = buildCanonicalSuggestions({
      state,
      projectId,
      limit: 6,
    });
    // Prefer canonical Knowledge-driven suggestions first; fill with legacy.
    const merged: TellMeSuggestedQuestion[] = [];
    for (const s of [...canonical, ...legacy]) {
      if (merged.length >= 6) break;
      if (
        merged.some(
          (m) => m.question.toLowerCase() === s.question.toLowerCase(),
        )
      ) {
        continue;
      }
      merged.push(s);
    }
    return merged;
  }, [state, projectId, userDisplayName]);

  const personalHint = useMemo(
    () =>
      buildPersonalisedHint({
        state,
        projectId,
        userDisplayName,
      }),
    [state, projectId, userDisplayName],
  );

  const openTellMe = useCallback(
    (opts?: { prefill?: string; projectId?: string | null }) => {
      const nextId = opts?.projectId ?? routeProjectId ?? null;
      if (conversationProjectRef.current !== nextId) {
        conversationProjectRef.current = nextId;
        setConversation([]);
        setAnswer(null);
        setError(null);
        if (!opts?.prefill) setQuestion("");
      }
      setProjectId(nextId);
      if (opts?.prefill) setQuestion(opts.prefill);
      setOpen(true);
      setError(null);
    },
    [routeProjectId],
  );

  const closeTellMe = useCallback(() => setOpen(false), []);

  const clearThread = useCallback(() => {
    setConversation([]);
    setAnswer(null);
    setError(null);
    setQuestion("");
  }, []);

  const ask = useCallback(
    async (override?: string) => {
      const q = (override ?? question).trim();
      if (!q || busy) return;
      setBusy(true);
      setError(null);
      setQuestion(q);
      try {
        // Local snapshot is UX freshness only — never sent as AI current truth.
        let activeSnapshot = projectId ? snapshots[projectId] ?? null : null;
        if (projectId && !activeSnapshot) {
          activeSnapshot = buildDeterministicSnapshot({
            state,
            projectId,
            userDisplayName,
          });
          const next = { ...snapshots, [projectId]: activeSnapshot };
          setSnapshots(next);
          saveLocalSnapshots(next);
        }

        const res = await fetch("/api/tell-me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            projectId,
            conversation,
            userDisplayName,
          }),
        });
        const data = (await res.json()) as {
          result?: TellMeAnswer;
          error?: string;
        };
        if (!res.ok || !data.result) {
          throw new Error(data.error || "Tell Me could not answer that.");
        }
        setAnswer(data.result);
        setConversation((prev) =>
          [
            ...prev,
            { role: "user" as const, content: q },
            { role: "assistant" as const, content: data.result!.answer },
          ].slice(-8),
        );
        if (data.result.coachHandoff) {
          /* leave answer as-is; UI offers Ask Coach */
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tell Me failed");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      question,
      projectId,
      snapshots,
      conversation,
      state,
      userDisplayName,
    ],
  );

  const refresh = useCallback(async () => {
    if (!projectId || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/tell-me/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          userDisplayName,
        }),
      });
      const data = (await res.json()) as {
        snapshot?: ProjectIntelligenceSnapshot;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.snapshot) {
        throw new Error(data.error || "Could not refresh Lume.");
      }
      const next = { ...snapshots, [projectId]: data.snapshot };
      setSnapshots(next);
      saveLocalSnapshots(next);
      if (answer) {
        setAnswer({
          ...answer,
          freshness: {
            ...answer.freshness,
            isStale: false,
            snapshotRevision: data.snapshot.sourceRevision,
            snapshotCreatedAt: data.snapshot.createdAt,
            changeCountHint: 0,
            message: "Lume is up to date.",
          },
          refreshRecommended: false,
          refreshReason: null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [projectId, refreshing, userDisplayName, snapshots, answer]);

  const value = useMemo<TellMeSessionValue>(
    () => ({
      open,
      openTellMe,
      closeTellMe,
      projectId,
      question,
      setQuestion,
      busy,
      refreshing,
      error,
      answer,
      conversation,
      suggestions,
      personalHint,
      snapshot,
      ask,
      refresh,
      clearThread,
      userDisplayName,
    }),
    [
      open,
      openTellMe,
      closeTellMe,
      projectId,
      question,
      busy,
      refreshing,
      error,
      answer,
      conversation,
      suggestions,
      personalHint,
      snapshot,
      ask,
      refresh,
      clearThread,
      userDisplayName,
    ],
  );

  return (
    <TellMeSessionContext.Provider value={value}>
      {children}
    </TellMeSessionContext.Provider>
  );
}

export function useTellMeSession() {
  const ctx = useContext(TellMeSessionContext);
  if (!ctx) {
    throw new Error("useTellMeSession must be used within TellMeSessionProvider");
  }
  return ctx;
}

export function openTellMePanel(opts?: {
  prefill?: string;
  projectId?: string | null;
}) {
  window.dispatchEvent(
    new CustomEvent("lume:open-tell-me", { detail: opts ?? {} }),
  );
}

export function handoffToCoach() {
  window.dispatchEvent(new Event("lume:open-coach"));
}
