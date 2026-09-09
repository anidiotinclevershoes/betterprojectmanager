import {
  ALLOWED_ANALYTICS_PROPERTIES,
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics/events";

const FORBIDDEN_KEY_PARTS = [
  "email",
  "password",
  "token",
  "secret",
  "key",
  "authorization",
  "cookie",
  "session",
  "capture",
  "transcript",
  "content",
  "text",
  "notes",
  "knowledge",
  "meeting",
  "advice",
  "risk",
  "title",
  "detail",
  "summary",
  "name",
  "body",
  "prompt",
  "message",
];

const MAX_STRING_LENGTH = 64;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const EVENT_NAMES = new Set<string>(Object.values(ANALYTICS_EVENTS));
const ALLOWED_KEYS = new Set<string>(ALLOWED_ANALYTICS_PROPERTIES);

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return EVENT_NAMES.has(value);
}

export function looksLikeSensitiveAnalyticsValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (EMAIL_LIKE.test(value)) return true;
  if (value.includes("sk-") || value.includes("phx_")) return true;
  if (value.includes("Bearer ")) return true;
  return false;
}

function forbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_PARTS.some((part) => lower.includes(part));
}

/**
 * Drop unknown events, unknown keys, over-long strings, and anything that
 * looks like project contents, PII, or secrets.
 */
export function sanitizeAnalyticsEvent(
  event: string,
  props?: Record<string, unknown> | AnalyticsProps | null,
): { event: AnalyticsEventName; properties: AnalyticsProps } | null {
  if (!isAnalyticsEventName(event)) return null;

  const properties: AnalyticsProps = {};
  if (!props) return { event, properties };

  for (const [key, raw] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (forbiddenKey(key)) continue;
    if (raw === undefined || raw === null) continue;

    if (typeof raw === "boolean" || typeof raw === "number") {
      if (typeof raw === "number" && !Number.isFinite(raw)) continue;
      properties[key as keyof AnalyticsProps] = raw;
      continue;
    }

    if (typeof raw !== "string") continue;
    if (raw.length === 0 || raw.length > MAX_STRING_LENGTH) continue;
    if (looksLikeSensitiveAnalyticsValue(raw)) continue;
    if (raw.includes("\n") || raw.includes("\r")) continue;
    properties[key as keyof AnalyticsProps] = raw;
  }

  return { event, properties };
}

/** Pathname only — never query strings (auth codes live there). */
export function analyticsPathname(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.trim();
  const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? "/";
  if (!noQuery.startsWith("/")) return "/";
  return noQuery.slice(0, MAX_STRING_LENGTH);
}
