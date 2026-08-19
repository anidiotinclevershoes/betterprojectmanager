/**
 * Project vocabulary — manual terms for AI prompts.
 * Stored in localStorage when available; defaults cover common RELOPS language.
 * Automatic extraction is intentionally out of scope for Phase 1.5.
 */

import type { ProjectDictionaryEntry } from "./types";

const DICTIONARY_KEY = "lume-project-dictionary-v1";

export const DEFAULT_DICTIONARY: ProjectDictionaryEntry[] = [
  { term: "CAB", definition: "Change Advisory Board" },
  { term: "SI", definition: "Service Introduction" },
  { term: "SIT", definition: "System Integration Testing" },
  { term: "Hypercare", definition: "Enhanced monitoring period after go-live" },
  { term: "RELOPS", definition: "Release operations / monthly release train" },
  { term: "Merge window", definition: "Period when code is accepted before freeze" },
];

/** Alias used by barrel exports / docs. */
export const DEFAULT_PROJECT_DICTIONARY = DEFAULT_DICTIONARY;

export type DictionaryEntry = ProjectDictionaryEntry;
export type ProjectDictionary = {
  projectId?: string | null;
  entries: ProjectDictionaryEntry[];
};

export function readProjectDictionary(
  projectId?: string | null,
): ProjectDictionaryEntry[] {
  const global = readStore()["*"] ?? [];
  if (!projectId) return dedupe([...DEFAULT_DICTIONARY, ...global]);
  const project = readStore()[projectId] ?? [];
  return dedupe([...DEFAULT_DICTIONARY, ...global, ...project]);
}

export function writeProjectDictionary(
  projectId: string | null | undefined,
  entries: ProjectDictionaryEntry[],
) {
  if (typeof window === "undefined") return;
  const key = projectId || "*";
  const store = readStore();
  store[key] = entries.map((e) => ({
    term: e.term.trim(),
    definition: e.definition.trim(),
  }));
  try {
    window.localStorage.setItem(DICTIONARY_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

/** Merge manual entries over defaults (manual wins on duplicate terms). */
export function mergeDictionary(
  base: ProjectDictionaryEntry[],
  overrides: ProjectDictionaryEntry[],
): ProjectDictionaryEntry[] {
  const map = new Map<string, ProjectDictionaryEntry>();
  for (const e of base) {
    if (!e.term.trim()) continue;
    map.set(e.term.toLowerCase(), e);
  }
  for (const e of overrides) {
    if (!e.term.trim()) continue;
    map.set(e.term.toLowerCase(), e);
  }
  return [...map.values()];
}

export function formatDictionaryForPrompt(
  entries: ProjectDictionaryEntry[],
): string {
  if (!entries.length) return "(No project dictionary entries.)";
  return entries.map((e) => `- ${e.term}: ${e.definition}`).join("\n");
}

function readStore(): Record<string, ProjectDictionaryEntry[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DICTIONARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ProjectDictionaryEntry[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function dedupe(entries: ProjectDictionaryEntry[]) {
  const seen = new Set<string>();
  const out: ProjectDictionaryEntry[] = [];
  for (const e of entries) {
    const key = e.term.toLowerCase();
    if (!e.term.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
