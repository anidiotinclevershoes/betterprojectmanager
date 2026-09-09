const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Direct `process.env.NEXT_PUBLIC_*` member access is required.
 * Next.js only inlines those into the browser bundle when the name is
 * a static property. `env.NEXT_PUBLIC_…` after `env = process.env` stays
 * empty in production and PostHog never receives events.
 */
function inlinedProjectToken(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    ""
  );
}

function inlinedHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(
    /\/$/,
    "",
  );
}

/** Project API key is public (phc_…). Never a personal/private PostHog key. */
export function getPosthogProjectKey(
  env?: NodeJS.ProcessEnv,
): string {
  if (env && env !== process.env) {
    return (
      env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
      env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
      ""
    );
  }
  return inlinedProjectToken();
}

export function getPosthogHost(env?: NodeJS.ProcessEnv): string {
  if (env && env !== process.env) {
    const raw = env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
    return raw.replace(/\/$/, "");
  }
  return inlinedHost();
}

export function isProductAnalyticsConfigured(
  env?: NodeJS.ProcessEnv,
): boolean {
  return Boolean(getPosthogProjectKey(env));
}
