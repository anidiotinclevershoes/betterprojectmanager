/**
 * Validate Catch Me Up model JSON.
 * Drops ungrounded inference and unknown fact ids.
 * Does not invent project facts.
 */
import type { NeedsConfirmationItem } from "@/lib/canonical-truth/types";
import type { CatchMeUpItem } from "./types";

const MAX_ATTENTION = 5;
const MAX_MISSED = 5;
const MAX_CONNECTIONS = 4;
const MAX_PROSE = 320;
const MAX_WHERE = 520;

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function filterFactIds(ids: string[], allowed: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed) || !allowed.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseItem(
  raw: unknown,
  allowed: Set<string>,
  fallbackEpistemic: CatchMeUpItem["epistemic"],
  forceEpistemic?: CatchMeUpItem["epistemic"],
): CatchMeUpItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const prose = clip(asString(row.prose), MAX_PROSE);
  if (!prose) return null;
  const epistemic =
    forceEpistemic ??
    (row.epistemic === "known" || row.epistemic === "inferred"
      ? row.epistemic
      : fallbackEpistemic);
  const factIds = filterFactIds(asStringArray(row.factIds), allowed);
  if (epistemic === "inferred" && factIds.length === 0) return null;
  return { epistemic, prose, factIds };
}

function parseList(
  raw: unknown,
  allowed: Set<string>,
  fallbackEpistemic: CatchMeUpItem["epistemic"],
  max: number,
  forceEpistemic?: CatchMeUpItem["epistemic"],
): CatchMeUpItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CatchMeUpItem[] = [];
  for (const row of raw) {
    const item = parseItem(row, allowed, fallbackEpistemic, forceEpistemic);
    if (!item) continue;
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function similar(a: string, b: string): boolean {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  return na === nb || (na.length > 24 && nb.includes(na)) || (nb.length > 24 && na.includes(nb));
}

export function mergeStoredNeedsYou(
  attention: CatchMeUpItem[],
  hints: NeedsConfirmationItem[],
  allowed: Set<string>,
): CatchMeUpItem[] {
  const prepend: CatchMeUpItem[] = [];
  for (const hint of hints) {
    const prose = clip(hint.summary, MAX_PROSE);
    if (!prose) continue;
    if (attention.some((item) => similar(item.prose, prose))) continue;
    if (prepend.some((item) => similar(item.prose, prose))) continue;
    const id = hint.truthItemId || hint.id;
    prepend.push({
      epistemic: "known",
      prose,
      factIds: allowed.has(id) ? [id] : [],
    });
  }
  return [...prepend, ...attention].slice(0, MAX_ATTENTION);
}

export function parseCatchMeUpModelJson(args: {
  raw: unknown;
  factIds: Set<string>;
  needsConfirmationHints: NeedsConfirmationItem[];
  fallbackWhereWeAre: string;
}): {
  whereWeAre: CatchMeUpItem | null;
  needsAttention: CatchMeUpItem[];
  mightHaveMissed: CatchMeUpItem[];
  connections: CatchMeUpItem[];
} {
  const obj =
    args.raw && typeof args.raw === "object"
      ? (args.raw as Record<string, unknown>)
      : {};

  let whereWeAre: CatchMeUpItem | null = null;
  const whereRaw = obj.whereWeAre;
  if (typeof whereRaw === "string") {
    const prose = clip(whereRaw, MAX_WHERE);
    if (prose) whereWeAre = { epistemic: "known", prose, factIds: [] };
  } else if (whereRaw && typeof whereRaw === "object") {
    const prose = clip(asString((whereRaw as { prose?: unknown }).prose), MAX_WHERE);
    if (prose) {
      whereWeAre = {
        epistemic: "known",
        prose,
        factIds: filterFactIds(
          asStringArray((whereRaw as { factIds?: unknown }).factIds),
          args.factIds,
        ),
      };
    }
  }
  if (!whereWeAre) {
    const fallback = clip(args.fallbackWhereWeAre, MAX_WHERE);
    if (fallback) {
      whereWeAre = { epistemic: "known", prose: fallback, factIds: [] };
    }
  }

  const needsAttention = mergeStoredNeedsYou(
    parseList(obj.needsAttention, args.factIds, "known", MAX_ATTENTION),
    args.needsConfirmationHints,
    args.factIds,
  );
  const mightHaveMissed = parseList(
    obj.mightHaveMissed,
    args.factIds,
    "inferred",
    MAX_MISSED,
  );
  const connections = parseList(
    obj.connections,
    args.factIds,
    "inferred",
    MAX_CONNECTIONS,
    "inferred",
  );

  return { whereWeAre, needsAttention, mightHaveMissed, connections };
}
