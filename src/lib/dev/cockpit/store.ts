/**
 * Development-only persistence for AI Cockpit metrics.
 * Writes to .lume-dev/ (gitignored). No-op outside development.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureRunMetrics, CockpitStore } from "./types";

const DIR = join(process.cwd(), ".lume-dev");
const FILE = join(DIR, "ai-cockpit-metrics.json");
const MAX_RUNS = 80;

function emptyStore(): CockpitStore {
  return { version: 1, runs: [], updatedAt: new Date().toISOString() };
}

export function isCockpitEnabled() {
  return process.env.NODE_ENV === "development";
}

export function readCockpitStore(): CockpitStore {
  if (!isCockpitEnabled()) return emptyStore();
  try {
    if (!existsSync(FILE)) return emptyStore();
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as CockpitStore;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.runs)) {
      return emptyStore();
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function writeCockpitStore(store: CockpitStore) {
  if (!isCockpitEnabled()) return;
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai-cockpit] failed to persist metrics", error);
    }
  }
}

export function recordCaptureRun(run: CaptureRunMetrics) {
  if (!isCockpitEnabled()) return;
  const store = readCockpitStore();
  store.runs = [run, ...store.runs].slice(0, MAX_RUNS);
  store.updatedAt = new Date().toISOString();
  writeCockpitStore(store);
}

export function clearCockpitStore() {
  writeCockpitStore(emptyStore());
}
