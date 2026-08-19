/**
 * Resolve which project(s) a Capture fact refers to.
 * Deterministic — no AI calls.
 */

import type { Project } from "@/lib/types";

export type ProjectRef = {
  id: string;
  name: string;
  code: string;
};

export type ProjectResolution =
  | { status: "resolved"; project: ProjectRef }
  | { status: "ambiguous"; candidates: ProjectRef[] }
  | { status: "unresolved" };

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function toProjectRef(p: Project): ProjectRef {
  return { id: p.id, name: p.name, code: p.code };
}

/** Lightweight index for prompts — all projects, no deep records. */
export function buildProjectIndex(projects: Project[]): ProjectRef[] {
  return projects.map(toProjectRef);
}

/**
 * Detect explicit project references in Capture text:
 * "ATLAS:", "HORIZON —", project codes, distinctive names.
 */
export function detectMentionedProjects(
  text: string,
  projects: Project[],
): ProjectRef[] {
  if (!text.trim() || !projects.length) return [];
  const found = new Map<string, ProjectRef>();
  const lower = text.toLowerCase();

  for (const p of projects) {
    const code = p.code.trim();
    const name = p.name.trim();
    if (!code && !name) continue;

    const codeRe = new RegExp(
      `(?:^|[\\s\\n])${escapeRegExp(code)}\\s*[:\\-]`,
      "i",
    );
    const codeWord = new RegExp(`\\b${escapeRegExp(code)}\\b`, "i");
    const nameNorm = normalize(name);
    const hit =
      (code.length >= 2 && (codeRe.test(text) || codeWord.test(text))) ||
      (nameNorm.length >= 6 && lower.includes(nameNorm));

    if (hit) found.set(p.id, toProjectRef(p));
  }

  return [...found.values()];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve project for a finding/fact.
 * Soft hint (selected sidebar project) only wins when unique & strong.
 */
export function resolveProjectForFact(args: {
  fact: string;
  evidence?: string;
  projects: Project[];
  softHintProjectId?: string | null;
  /** Record ids already known to belong to a project. */
  recordProjectId?: string | null;
}): ProjectResolution {
  if (args.recordProjectId) {
    const p = args.projects.find((x) => x.id === args.recordProjectId);
    if (p) return { status: "resolved", project: toProjectRef(p) };
  }

  const blob = `${args.fact}\n${args.evidence ?? ""}`;
  const mentioned = detectMentionedProjects(blob, args.projects);
  if (mentioned.length === 1) {
    return { status: "resolved", project: mentioned[0] };
  }
  if (mentioned.length > 1) {
    return { status: "ambiguous", candidates: mentioned };
  }

  // Soft hint alone must not resolve genuine multi-project ambiguity.
  // Only use it when no other projects are plausible for this fact.
  return { status: "unresolved" };
}

/** Split capture text into per-project segments when prefixed. */
export function splitCaptureByProjectPrefix(
  text: string,
  projects: Project[],
): Array<{ project: ProjectRef | null; text: string }> {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [{ project: null, text }];

  const byCode = new Map(
    projects.map((p) => [p.code.toLowerCase(), toProjectRef(p)]),
  );
  const segments: Array<{ project: ProjectRef | null; text: string }> = [];
  let current: ProjectRef | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!buf.length) return;
    segments.push({ project: current, text: buf.join("\n") });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]{1,12})\s*[:\-]\s*(.+)$/);
    if (m) {
      const ref = byCode.get(m[1].toLowerCase());
      if (ref) {
        flush();
        current = ref;
        buf.push(m[2]);
        continue;
      }
    }
    buf.push(line);
  }
  flush();
  return segments.length ? segments : [{ project: null, text }];
}
