/**
 * Lazy Stripe server client — does not throw at module load when unset.
 */
import type Stripe from "stripe";

let stripeSingleton: Stripe | null | undefined;

export function getStripeSecretKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.STRIPE_SECRET_KEY?.trim() || undefined;
}

export function getStripePriceId(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.STRIPE_PRICE_ID?.trim() || undefined;
}

export function getStripeWebhookSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

export async function getStripeClient(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Stripe | null> {
  const key = getStripeSecretKey(env);
  if (!key) return null;
  if (stripeSingleton !== undefined) return stripeSingleton;
  const { default: StripeCtor } = await import("stripe");
  stripeSingleton = new StripeCtor(key, {
    apiVersion: "2025-08-27.basil",
  });
  return stripeSingleton;
}

export function resetStripeClientForTests() {
  stripeSingleton = undefined;
}
