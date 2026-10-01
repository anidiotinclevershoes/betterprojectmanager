/**
 * Canonical product domains. Colours live in domain-identity.css, keyed by
 * these values, because Page 09 uses different related colours for the icon
 * tint, section header, outer border, and badge.
 */
export const LUME_DOMAINS = ["issue", "people", "todo", "knowledge"] as const;

export type LumeDomain = (typeof LUME_DOMAINS)[number];

export const LUME_DOMAIN_ICON_SRC: Record<LumeDomain, string> = {
  issue: "/brand/domain-issue.svg",
  people: "/brand/domain-people.svg",
  todo: "/brand/domain-todo.svg",
  knowledge: "/brand/domain-knowledge.svg",
};

/** Knowledge Centre buckets and knowledge subtypes. Dates stay under Knowledge. */
export const KC_ITEM_DOMAIN = {
  issues: "issue",
  people: "people",
  todo: "todo",
  knowledge: "knowledge",
  dates: "knowledge",
  decisions: "knowledge",
  information: "knowledge",
} as const satisfies Record<string, LumeDomain>;

export function lumeDomainForKcBucket(
  bucket: "issues" | "people" | "todo" | "knowledge",
): LumeDomain {
  return KC_ITEM_DOMAIN[bucket];
}
