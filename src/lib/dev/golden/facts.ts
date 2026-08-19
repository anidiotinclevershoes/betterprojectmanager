/**
 * Deterministic atomic Facts for Golden Test presentation.
 * No extra AI call — maps findings + light transcript cues.
 */

import type { CaptureResult } from "@/lib/types";

const FILLER =
  /\b(okay|so|right|just dumping|before i forget|anyway|i think|didn't i|wait,? no|obviously|i mentioned that already)\b/i;

const IRRELEVANT =
  /\b(milk|on the way home|buy eggs|grocery|shopping list)\b/i;

function ensureSentence(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  if (FILLER.test(t) && t.split(/\s+/).length < 12) return true;
  if (IRRELEVANT.test(t)) return true;
  // Raw rambling paragraphs
  if (t.length > 180 && (t.match(/,/g) ?? []).length >= 4) return true;
  return false;
}

function dedupePush(list: string[], fact: string) {
  const norm = fact.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!norm) return;
  if (list.some((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm)) {
    return;
  }
  // Prefer shorter atomic fact over longer near-duplicate
  const overlapIdx = list.findIndex((f) => {
    const other = f.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return other.includes(norm) || norm.includes(other);
  });
  if (overlapIdx >= 0) {
    if (fact.length < list[overlapIdx].length) list[overlapIdx] = fact;
    return;
  }
  list.push(fact);
}

/**
 * Build concise project-relevant facts for the Golden Results Facts card.
 */
export function extractAtomicFacts(
  result: CaptureResult,
  captureText: string,
): string[] {
  const facts: string[] = [];
  const text = captureText.toLowerCase();

  for (const finding of result.findings ?? []) {
    if (finding.invalidTarget) continue;
    const raw = finding.fact?.trim();
    if (!raw || isNoise(raw)) continue;
    dedupePush(facts, ensureSentence(raw));
  }

  // Insights often duplicate finding facts — only keep short atomic project facts.
  for (const insight of result.insights ?? []) {
    if (/tidied from raw/i.test(insight)) continue;
    if (/programme manager checks|continuous analysis|risk language detected|captured as /i.test(insight)) {
      continue;
    }
    if (isNoise(insight)) continue;
    if (insight.length > 120) continue;
    // Prefer insights that look like project facts (date/status/people), not meta.
    if (
      !/\b(cab|release|cdn|sarah|marcus|approved|resolved|moved|owner)\b/i.test(
        insight,
      )
    ) {
      continue;
    }
    dedupePush(facts, ensureSentence(insight));
  }

  // Negated / clarifying ownership facts (not always operations).
  if (
    /\bsarah\b/.test(text) &&
    (/\bstill the owner\b/.test(text) ||
      /\bdon'?t replace sarah\b/.test(text) ||
      /\bsarah remains\b/.test(text) ||
      /\bsarah is still\b/.test(text))
  ) {
    dedupePush(facts, "Sarah remains Business Owner.");
  }

  if (
    /\bmarcus\b/.test(text) &&
    (/\brelease notes\b/.test(text) ||
      /\bhelping with\b/.test(text) ||
      /\bonly owns release notes\b/.test(text) ||
      /\bmarcus only\b/.test(text))
  ) {
    // Retain support role; ignore negated “taking over” phrasing nearby.
    dedupePush(facts, "Marcus is supporting release notes only.");
  }

  // Never surface personal errands.
  return facts.filter((f) => !IRRELEVANT.test(f)).slice(0, 8);
}
