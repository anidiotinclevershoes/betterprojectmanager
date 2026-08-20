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

/**
 * V1 is dark-only (Ocean). Light mode is not offered in product chrome.
 * Appearance type retained for compatibility; setters force dark.
 */
export type Appearance = "light" | "dark";

type AppearanceContextValue = {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  toggleAppearance: () => void;
  hydrated: boolean;
};

const STORAGE_KEY = "mc-appearance-v1";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function forceDarkDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = "dark";
  try {
    window.localStorage.setItem(STORAGE_KEY, "dark");
  } catch {
    /* ignore */
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance] = useState<Appearance>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    forceDarkDocument();
    setHydrated(true);
  }, []);

  const setAppearance = useCallback((_value: Appearance) => {
    // V1 dark-only — ignore light requests from leftover callers.
    forceDarkDocument();
  }, []);

  const toggleAppearance = useCallback(() => {
    forceDarkDocument();
  }, []);

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
