/** Deterministic mulberry32. Same seed always yields the same sequence. */

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededInt(rand: () => number, maxExclusive: number) {
  return Math.floor(rand() * maxExclusive);
}

export function seededPick<T>(rand: () => number, items: T[]): T {
  if (!items.length) throw new Error("seededPick: empty");
  return items[seededInt(rand, items.length)]!;
}

export function seededShuffle<T>(rand: () => number, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = seededInt(rand, i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Exhaustive permutations for n <= 4; otherwise `sampleCount` seeded shuffles. */
export function permuteOrSample<T>(
  items: T[],
  seed: number,
  sampleCount = 8,
): T[][] {
  if (items.length <= 1) return [items];
  if (items.length <= 4) return permuteAll(items);
  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const out: T[][] = [];
  let guard = 0;
  while (out.length < sampleCount && guard < sampleCount * 12) {
    guard += 1;
    const next = seededShuffle(rand, items);
    const key = next.map((_, i) => i).join(",") + ":" + next.map(stableKey).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out.length ? out : [items];
}

function permuteAll<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  const used = items.map(() => false);
  const acc: T[] = [];
  function walk() {
    if (acc.length === items.length) {
      out.push([...acc]);
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      if (used[i]) continue;
      used[i] = true;
      acc.push(items[i]!);
      walk();
      acc.pop();
      used[i] = false;
    }
  }
  walk();
  return out;
}

function stableKey(value: unknown): string {
  if (value && typeof value === "object" && "id" in (value as object)) {
    return String((value as { id?: unknown }).id);
  }
  return JSON.stringify(value);
}
