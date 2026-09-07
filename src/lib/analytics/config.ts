const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** Project API key is public (phc_…). Never a personal/private PostHog key. */
export function getPosthogProjectKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    ""
  );
}

export function getPosthogHost(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  return raw.replace(/\/$/, "");
}

export function isProductAnalyticsConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(getPosthogProjectKey(env));
}
