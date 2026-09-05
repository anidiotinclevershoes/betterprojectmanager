/**
 * Case/whitespace folding for retrieval tags.
 * Display name keeps the first-seen spelling; slug is the identity.
 */
export function tagSlug(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function tagDisplayName(name: string): string {
  const collapsed = name.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function tagsAreSame(a: string, b: string): boolean {
  return tagSlug(a) === tagSlug(b);
}

export function dedupeTagNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const display = tagDisplayName(raw);
    const slug = tagSlug(display);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(display);
  }
  return out;
}
