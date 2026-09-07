import {
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics/events";
import {
  getPosthogHost,
  getPosthogProjectKey,
  isProductAnalyticsConfigured,
} from "@/lib/analytics/config";
import { sanitizeAnalyticsEvent } from "@/lib/analytics/sanitize";

export type AnalyticsSinkEvent = {
  event: AnalyticsEventName;
  properties: AnalyticsProps;
  distinctId: string;
};

export type AnalyticsSink = {
  capture: (event: AnalyticsSinkEvent) => void;
  identify: (distinctId: string) => void;
  reset: () => void;
};

const DISTINCT_STORAGE_KEY = "lume-analytics-distinct-v1";

let testSink: AnalyticsSink | null = null;
let cachedDistinctId: string | null = null;
let identifiedUserId: string | null = null;

export function setAnalyticsSinkForTests(sink: AnalyticsSink | null): void {
  testSink = sink;
}

export function resetAnalyticsClientForTests(): void {
  testSink = null;
  cachedDistinctId = null;
  identifiedUserId = null;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getAnalyticsDistinctId(): string {
  if (identifiedUserId) return `user:${identifiedUserId}`;
  if (cachedDistinctId) return cachedDistinctId;

  if (typeof window !== "undefined") {
    try {
      const existing = window.localStorage.getItem(DISTINCT_STORAGE_KEY);
      if (existing) {
        cachedDistinctId = existing;
        return existing;
      }
      const next = randomId();
      window.localStorage.setItem(DISTINCT_STORAGE_KEY, next);
      cachedDistinctId = next;
      return next;
    } catch {
      /* private mode */
    }
  }

  cachedDistinctId = randomId();
  return cachedDistinctId;
}

function posthogCapture(event: AnalyticsSinkEvent): void {
  if (typeof window === "undefined") return;
  if (!isProductAnalyticsConfigured()) return;

  const key = getPosthogProjectKey();
  const host = getPosthogHost();
  const payload = {
    api_key: key,
    event: event.event,
    distinct_id: event.distinctId,
    properties: {
      ...event.properties,
      $lib: "lume-analytics",
      distinct_id: event.distinctId,
    },
  };

  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
    mode: "cors",
    credentials: "omit",
  }).catch(() => {
    /* analytics must never break product */
  });
}

/**
 * Record a catalogued product event. Unknown events and sensitive props are dropped.
 */
export function trackAnalyticsEvent(
  event: string,
  props?: Record<string, unknown> | AnalyticsProps | null,
): boolean {
  const clean = sanitizeAnalyticsEvent(event, props);
  if (!clean) return false;

  const payload: AnalyticsSinkEvent = {
    event: clean.event,
    properties: clean.properties,
    distinctId: getAnalyticsDistinctId(),
  };

  testSink?.capture(payload);
  posthogCapture(payload);
  return true;
}

/** Bind later events to the signed-in user id only — never email. */
export function identifyAnalyticsUser(userId: string | null | undefined): void {
  const id = userId?.trim() ?? "";
  if (!id || id.includes("@")) return;
  identifiedUserId = id;
  const distinctId = `user:${id}`;
  testSink?.identify(distinctId);
}

export function resetAnalyticsIdentity(): void {
  identifiedUserId = null;
  cachedDistinctId = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DISTINCT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  testSink?.reset();
}
