/**
 * Truncate text for model context without cutting away meaning-changing
 * qualifications (only / not / require / informal / unconfirmed / etc.).
 */

const QUALIFIER_CUES =
  /\b(only|not|never|unless|except|require|requires|required|cannot|can't|must|informal|unofficial|unconfirmed|speculation|but|however|without|provided that)\b/i;

/**
 * Soft-truncate `text` to roughly `maxLen`, preferring sentence/clause boundaries
 * so restrictions and negations are not severed mid-thought.
 */
export function truncatePreservingMeaning(
  text: string,
  maxLen = 220,
): string {
  const raw = text.replace(/\s+/g, " ").trim();
  if (raw.length <= maxLen) return raw;

  const softCap = Math.min(raw.length, Math.floor(maxLen * 1.4));
  const window = raw.slice(0, maxLen);
  const minKeep = Math.floor(maxLen * 0.45);

  const boundaryAt = (hay: string, from = 0): number => {
    const slice = hay.slice(from);
    const marks = [
      slice.lastIndexOf(". "),
      slice.lastIndexOf("; "),
      slice.lastIndexOf(" — "),
      slice.lastIndexOf(" – "),
    ];
    let best = -1;
    for (const rel of marks) {
      if (rel < 0) continue;
      const abs = from + rel;
      if (abs >= minKeep && abs > best) best = abs;
    }
    // terminal period
    if (hay.endsWith(".") && hay.length - 1 >= minKeep) {
      best = Math.max(best, hay.length - 1);
    }
    return best;
  };

  let best = boundaryAt(window);
  if (best < 0) {
    best = boundaryAt(raw.slice(0, softCap));
  }

  if (best >= 0) {
    let end = best + 1; // include . or ;
    // If we stopped on a semicolon, pull in the next short qualifier clause
    // ("…unit tests only; integration tests require real staging.")
    if (raw[best] === ";") {
      const rest = raw.slice(best + 1).replace(/^\s+/, "");
      const stop = rest.search(/[.!?]/);
      const clause = stop >= 0 ? rest.slice(0, stop + 1) : rest;
      if (
        clause.length > 0 &&
        clause.length <= Math.floor(maxLen * 0.55) &&
        best + 2 + clause.length <= softCap &&
        QUALIFIER_CUES.test(clause)
      ) {
        end = best + 1 + (raw.slice(best + 1).length - rest.length) + clause.length;
      }
    }
    return raw.slice(0, end).trim();
  }

  // Qualifier present but no punctuation boundary — extend to softCap word break
  if (QUALIFIER_CUES.test(window) || QUALIFIER_CUES.test(raw.slice(0, softCap))) {
    const extended = raw.slice(0, softCap);
    const sp = extended.lastIndexOf(" ");
    return (sp > minKeep ? extended.slice(0, sp) : extended).trim();
  }

  const sp = window.lastIndexOf(" ");
  return (sp > minKeep ? window.slice(0, sp) : window).trim();
}

/**
 * True when a hard character cut would drop a trailing qualifier that changes meaning.
 * Used by tests and diagnostics.
 */
export function truncationWouldDropQualifier(
  text: string,
  hardMax: number,
): boolean {
  if (text.length <= hardMax) return false;
  const kept = text.slice(0, hardMax);
  const lost = text.slice(hardMax);
  return (
    QUALIFIER_CUES.test(lost) ||
    (/\bfine\s*$/i.test(kept.trim()) && /\bonly\b|\brequire/i.test(lost))
  );
}
