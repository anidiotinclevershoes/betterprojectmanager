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

export type Appearance = "light" | "dark";

type AppearanceContextValue = {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  toggleAppearance: () => void;
  hydrated: boolean;
};

const STORAGE_KEY = "mc-appearance-v1";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function resolveInitial(): Appearance {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = resolveInitial();
    setAppearanceState(next);
    document.documentElement.dataset.theme = next;
    setHydrated(true);
  }, []);

  const setAppearance = useCallback((value: Appearance) => {
    setAppearanceState(value);
    document.documentElement.dataset.theme = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearance(appearance === "dark" ? "light" : "dark");
  }, [appearance, setAppearance]);

  const value = useMemo(
    () => ({ appearance, setAppearance, toggleAppearance, hydrated }),
    [appearance, setAppearance, toggleAppearance, hydrated],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
