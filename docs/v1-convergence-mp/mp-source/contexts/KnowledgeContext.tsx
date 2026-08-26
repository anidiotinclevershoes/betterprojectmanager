import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { entities as baseEntities } from "../data/project";
import type { Entity, Trust } from "../types/knowledge";

interface KnowledgeValue {
  get: (id: string) => Entity | undefined;

  /** The object in the inspector, or null when it is closed. */
  currentId: string | null;
  /** The path taken to get here. Last element is the current object. */
  trail: string[];
  /** Open from the Knowledge Centre — starts a fresh path. */
  open: (id: string) => void;
  /** Follow a connection — pushes onto the path. */
  navigate: (id: string) => void;
  back: () => void;
  goTo: (index: number) => void;
  close: () => void;

  /** More details. Always collapses again when the object changes. */
  expanded: boolean;
  setExpanded: (v: boolean) => void;

  trustOf: (id: string) => Trust;
  /** "Lume noticed" reviewed and accepted — becomes ordinary knowledge. */
  accept: (id: string) => void;
  /** A "Needs you" item the user has settled. */
  markResolved: (id: string) => void;
  isResolved: (id: string) => boolean;

  dateOf: (id: string) => string | undefined;
  setDate: (id: string, iso: string) => void;

  isDone: (id: string) => boolean;
  toggleDone: (id: string) => void;
}

const Ctx = createContext<KnowledgeValue | null>(null);

export function KnowledgeProvider({
  children,
  initialTrail = [],
  initialExpanded = false,
}: {
  children: React.ReactNode;
  initialTrail?: string[];
  initialExpanded?: boolean;
}) {
  const [trail, setTrail] = useState<string[]>(initialTrail);
  const [expanded, setExpandedState] = useState(initialExpanded);
  const [trustOverrides, setTrustOverrides] = useState<Record<string, Trust>>({});
  const [resolved, setResolved] = useState<string[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const currentId = trail.length ? trail[trail.length - 1] : null;

  const get = useCallback((id: string) => baseEntities[id], []);

  const open = useCallback((id: string) => {
    setExpandedState(false);
    setTrail((t) => (t.length === 1 && t[0] === id ? [] : [id]));
  }, []);

  const navigate = useCallback((id: string) => {
    setExpandedState(false);
    setTrail((t) => (t[t.length - 1] === id ? t : [...t, id]));
  }, []);

  const back = useCallback(() => {
    setExpandedState(false);
    setTrail((t) => t.slice(0, -1));
  }, []);

  const goTo = useCallback((index: number) => {
    setExpandedState(false);
    setTrail((t) => t.slice(0, index + 1));
  }, []);

  const close = useCallback(() => {
    setExpandedState(false);
    setTrail([]);
  }, []);

  const trustOf = useCallback(
    (id: string): Trust => trustOverrides[id] ?? baseEntities[id]?.trust ?? "known",
    [trustOverrides],
  );

  const accept = useCallback((id: string) => {
    setTrustOverrides((t) => ({ ...t, [id]: "known" }));
  }, []);

  const markResolved = useCallback((id: string) => {
    setTrustOverrides((t) => ({ ...t, [id]: "known" }));
    setResolved((r) => (r.includes(id) ? r : [...r, id]));
  }, []);

  const value = useMemo<KnowledgeValue>(
    () => ({
      get,
      currentId,
      trail,
      open,
      navigate,
      back,
      goTo,
      close,
      expanded,
      setExpanded: setExpandedState,
      trustOf,
      accept,
      markResolved,
      isResolved: (id) => resolved.includes(id),
      dateOf: (id) => dates[id] ?? baseEntities[id]?.dateISO,
      setDate: (id, iso) => setDates((d) => ({ ...d, [id]: iso })),
      isDone: (id) => done[id] ?? false,
      toggleDone: (id) => setDone((d) => ({ ...d, [id]: !d[id] })),
    }),
    [
      get,
      currentId,
      trail,
      open,
      navigate,
      back,
      goTo,
      close,
      expanded,
      trustOf,
      accept,
      markResolved,
      resolved,
      dates,
      done,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowledge(): KnowledgeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useKnowledge must be used inside KnowledgeProvider");
  return v;
}
