/**
 * Minimal in-memory rate limit for expensive AI routes.
 * Per-process only — fine for single-instance / foundation.
 * Swap store later for Redis without changing call sites.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export type RateLimitOptions = {
  /** Unique key, e.g. `capture:userId` */
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = opts.now ?? Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(opts.key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, opts.limit - 1),
      resetAt,
      limit: opts.limit,
    };
  }
  if (existing.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      limit: opts.limit,
    };
  }
  existing.count += 1;
  buckets.set(opts.key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, opts.limit - existing.count),
    resetAt: existing.resetAt,
    limit: opts.limit,
  };
}

export function resetRateLimitStoreForTests() {
  buckets.clear();
}

/** Default AI limits (per user, per hour). Override via env. */
export function getAiRateLimits(env: NodeJS.ProcessEnv = process.env) {
  const n = (key: string, fallback: number) => {
    const raw = env[key]?.trim();
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  };
  return {
    capturePerHour: n("LUME_RATE_LIMIT_CAPTURE_PER_HOUR", 60),
    coachPerHour: n("LUME_RATE_LIMIT_COACH_PER_HOUR", 60),
    transcribePerHour: n("LUME_RATE_LIMIT_TRANSCRIBE_PER_HOUR", 40),
    newProjectPerHour: n("LUME_RATE_LIMIT_NEW_PROJECT_PER_HOUR", 30),
    tellMePerHour: n("LUME_RATE_LIMIT_TELL_ME_PER_HOUR", 60),
    windowMs: 60 * 60 * 1000,
  };
}
