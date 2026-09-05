import { PREDEFINED_LUME_TAGS } from "./predefined";
import { tagDisplayName, tagSlug } from "./normalize";
import type { ProjectTag } from "./types";

export type TagSuggestion = {
  kind: "project" | "predefined" | "create";
  name: string;
  slug: string;
};

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  // Very small fuzzy: consecutive characters with gaps of at most 1.
  let hi = 0;
  for (let ni = 0; ni < needle.length; ni += 1) {
    const ch = needle[ni]!;
    const found = haystack.indexOf(ch, hi);
    if (found < 0) return false;
    if (found - hi > 2 && ni > 0) return false;
    hi = found + 1;
  }
  return true;
}

/**
 * Suggest: (1) tags already used on this project, (2) predefined Lume tags,
 * (3) a create-new option. Never invents truth — names only.
 */
export function suggestTags(args: {
  query: string;
  projectTags: ProjectTag[];
  alreadyAttached?: string[];
  limit?: number;
}): TagSuggestion[] {
  const limit = args.limit ?? 8;
  const q = tagSlug(args.query);
  const attached = new Set((args.alreadyAttached ?? []).map(tagSlug));
  const out: TagSuggestion[] = [];
  const seen = new Set<string>();

  const push = (kind: TagSuggestion["kind"], name: string) => {
    const slug = tagSlug(name);
    if (!slug || attached.has(slug) || seen.has(slug)) return;
    seen.add(slug);
    out.push({ kind, name: tagDisplayName(name), slug });
  };

  const projectSorted = [...args.projectTags].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const tag of projectSorted) {
    if (q && !fuzzyIncludes(tag.slug, q) && !tag.slug.startsWith(q)) continue;
    push("project", tag.name);
    if (out.length >= limit) return out;
  }

  for (const name of PREDEFINED_LUME_TAGS) {
    const slug = tagSlug(name);
    if (q && !fuzzyIncludes(slug, q) && !slug.startsWith(q)) continue;
    push("predefined", name);
    if (out.length >= limit) return out;
  }

  if (q) {
    const createName = tagDisplayName(args.query);
    if (createName && !seen.has(tagSlug(createName)) && !attached.has(tagSlug(createName))) {
      out.push({
        kind: "create",
        name: createName,
        slug: tagSlug(createName),
      });
    }
  }

  return out.slice(0, limit + 1);
}
