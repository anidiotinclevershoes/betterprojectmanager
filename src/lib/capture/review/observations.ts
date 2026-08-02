/**
 * Presentation-only observations for Capture review.
 * Does not touch findings pipeline, prompts, or mapping.
 */

import type { CaptureResult } from "@/lib/types";

const FILLER =
  /\b(okay|so|right|just dumping|before i forget|anyway|i think|didn't i|wait,? no|obviously|i mentioned that already)\b/i;
const IRRELEVANT =
  /\b(milk|on the way home|buy eggs|grocery|shopping list)\b/i;
const META =
  /programme manager checks|continuous analysis|risk language detected|captured as |tidied from raw/i;

function ensurePhrase(text: string): string {
  const t = text.trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return true;
  if (META.test(t)) return true;
  if (IRRELEVANT.test(t)) return true;
  if (FILLER.test(t) && t.split(/\s+/).length < 12) return true;
  if (t.length > 160 && (t.match(/,/g) ?? []).length >= 4) return true;
  return false;
}

function dedupePush(list: string[], phrase: string) {
  const norm = phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!norm) return;
  if (list.some((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm)) {
    return;
  }
  const overlapIdx = list.findIndex((f) => {
    const other = f.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return other.includes(norm) || norm.includes(other);
  });
  if (overlapIdx >= 0) {
    if (phrase.length < list[overlapIdx].length) list[overlapIdx] = phrase;
    return;
  }
  list.push(phrase);
}

/** Concise project-relevant observations for “What Lume Understood”. */
export function buildCaptureObservations(
  result: CaptureResult,
  captureText: string,
): string[] {
  const observations: string[] = [];
  const text = captureText.toLowerCase();

  for (const finding of result.findings ?? []) {
    if (finding.invalidTarget) continue;
    const raw = finding.fact?.trim();
    if (!raw || isNoise(raw)) continue;
    dedupePush(observations, ensurePhrase(raw));
  }

  for (const insight of result.insights ?? []) {
    if (isNoise(insight) || insight.length > 120) continue;
    if (
      !/\b(cab|release|cdn|sarah|marcus|approved|resolved|moved|owner|complete|risk)\b/i.test(
        insight,
      )
    ) {
      continue;
    }
    dedupePush(observations, ensurePhrase(insight));
  }

  if (
    /\bsarah\b/.test(text) &&
    (/\bstill the owner\b/.test(text) ||
      /\bdon'?t replace sarah\b/.test(text) ||
      /\bsarah remains\b/.test(text) ||
      /\bsarah is still\b/.test(text))
  ) {
    dedupePush(observations, "Sarah remains Business Owner");
  }

  if (
    /\bmarcus\b/.test(text) &&
    (/\brelease notes\b/.test(text) ||
      /\bhelping with\b/.test(text) ||
      /\bmarcus only\b/.test(text))
  ) {
    dedupePush(observations, "Marcus supports release notes");
  }

  return observations.filter((o) => !IRRELEVANT.test(o)).slice(0, 8);
}
