/**
 * Split a free-text person line into name + responsibilities.
 * Used by New Project compose/review. Not a second extractor —
 * Capture observations still win when they already have structured fields.
 */

export type ParsedPersonLine = {
  name: string;
  responsibilities: string[];
};

const RESPONSIBLE_FOR =
  /^(.+?)\s+(?:is\s+)?responsible\s+for\s+(.+)$/i;
const OWNS_LEADS_HANDLES =
  /^(.+?)\s+(?:owns|leads|handles)\s+(.+)$/i;
const NAME_DASH_SCOPE = /^([^,]+?)\s+[—–]\s+(.+)$/;
const NAME_SPACED_HYPHEN = /^([^,]+?)\s+-\s+(.+)$/;

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanScope(value: string) {
  return value.replace(/[.,;]+$/g, "").replace(/\s+/g, " ").trim();
}

export function parsePersonLine(raw: string): ParsedPersonLine {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { name: "", responsibilities: [] };

  for (const re of [RESPONSIBLE_FOR, OWNS_LEADS_HANDLES, NAME_DASH_SCOPE, NAME_SPACED_HYPHEN]) {
    const match = text.match(re);
    const name = cleanName(match?.[1] ?? "");
    const scope = cleanScope(match?.[2] ?? "");
    if (name && scope && name.length <= 80 && scope.length <= 80) {
      return { name, responsibilities: [scope] };
    }
  }

  return { name: text, responsibilities: [] };
}

export function scopesOf(draft: {
  role?: string;
  responsibilities?: string[];
}): string[] {
  const listed = (draft.responsibilities ?? [])
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (listed.length) return listed;
  const role = draft.role?.trim();
  if (role && role.toLowerCase() !== "stakeholder") return [role];
  return [];
}
