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
 * Ocean is the original dark appearance (`data-theme="dark"`).
 * Desert is an additional token theme (`data-theme="desert"`).
 * Light remains in the type for leftover callers but is not offered in product chrome.
 */
export type Appearance = "light" | "dark" | "desert";
export type LumeTheme = "ocean" | "desert";

type AppearanceContextValue = {
  appearance: Appearance;
  theme: LumeTheme;
  setAppearance: (value: Appearance) => void;
  setTheme: (value: LumeTheme) => void;
  toggleAppearance: () => void;
  hydrated: boolean;
};

export const APPEARANCE_STORAGE_KEY = "mc-appearance-v1";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function appearanceToTheme(value: string | null | undefined): LumeTheme {
  return value === "desert" ? "desert" : "ocean";
}

export function themeToDataset(theme: LumeTheme): "dark" | "desert" {
  return theme === "desert" ? "desert" : "dark";
}

export function themeToStorage(theme: LumeTheme): "ocean" | "desert" {
  return theme;
}

function readStoredTheme(): LumeTheme {
  try {
    return appearanceToTheme(window.localStorage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return "ocean";
  }
}

export function applyLumeTheme(theme: LumeTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeToDataset(theme);
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, themeToStorage(theme));
  } catch {
    /* ignore */
  }
}

function appearanceFromTheme(theme: LumeTheme): Appearance {
  return theme === "desert" ? "desert" : "dark";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<LumeTheme>("ocean");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStoredTheme();
    setThemeState(next);
    applyLumeTheme(next);
    setHydrated(true);
  }, []);

  const setTheme = useCallback((value: LumeTheme) => {
    setThemeState(value);
    applyLumeTheme(value);
  }, []);

  const setAppearance = useCallback((value: Appearance) => {
    if (value === "light") return;
    setTheme(appearanceToTheme(value));
  }, [setTheme]);

  const toggleAppearance = useCallback(() => {
    setTheme(theme === "desert" ? "ocean" : "desert");
  }, [setTheme, theme]);

  const appearance = appearanceFromTheme(theme);

  const value = useMemo(
    () => ({
      appearance,
      theme,
      setAppearance,
      setTheme,
      toggleAppearance,
      hydrated,
    }),
    [appearance, theme, setAppearance, setTheme, toggleAppearance, hydrated],
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
