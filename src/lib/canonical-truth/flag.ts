/**
 * Feature flag for Slice 1 canonical truth read path.
 *
 * LUME_CANONICAL_TRUTH=1 → force on
 * LUME_CANONICAL_TRUTH=0 → force off (rollback)
 * unset → on when `forEval` / explicit enable, else off (live SaaS safe default)
 */
export function isCanonicalTruthEnabled(opts?: {
  forEval?: boolean;
  explicit?: boolean | null;
}): boolean {
  const env = process.env.LUME_CANONICAL_TRUTH?.trim();
  if (env === "0" || env === "false" || env === "off") return false;
  if (env === "1" || env === "true" || env === "on") return true;
  if (opts?.explicit === true) return true;
  if (opts?.explicit === false) return false;
  if (opts?.forEval) return true;
  return false;
}
