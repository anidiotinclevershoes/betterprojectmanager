import type { KnowledgeSectionId } from "./types";

export type CoachActionTarget =
  | "todo"
  | "suggestion"
  | "knowledge_risk"
  | "knowledge_openLoop"
  | "script";

export type CoachAction = {
  id: string;
  section: "do_now" | "risk" | "script" | "checklist";
  text: string;
  /** Clean title without numbering / project prefix */
  title: string;
  projectCode?: string;
  target: CoachActionTarget;
  knowledgeSection?: KnowledgeSectionId;
};

/**
 * Parse streaming coach markdown into actionable items the UI can Accept.
 * Safe to call repeatedly as text grows — ids stay stable for the same line text.
 */
export function parseCoachActions(markdown: string): CoachAction[] {
  const sections = splitSections(markdown);
  const actions: CoachAction[] = [];

  for (const item of listItems(sections["2"] ?? sections["What Tom Should Do Now"] ?? "")) {
    actions.push(makeAction(item, "do_now", "todo"));
  }

  for (const item of listItems(sections["3"] ?? sections["Risks / Gaps to Address"] ?? "")) {
    actions.push(makeAction(item, "risk", "knowledge_risk"));
  }

  for (const item of scriptItems(sections["4"] ?? sections["Communication Guidance"] ?? "")) {
    actions.push(makeAction(item, "script", "script"));
  }

  for (const item of checklistItems(sections["5"] ?? sections["Optional: Checklist"] ?? "")) {
    actions.push(makeAction(item, "checklist", "todo"));
  }

  return actions;
}

function splitSections(markdown: string): Record<string, string> {
  const map: Record<string, string> = {};
  const parts = markdown.split(/\n(?=##\s+)/);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const heading = lines[0]?.replace(/^##\s+/, "").trim() ?? "";
    if (!heading) continue;
    const body = lines.slice(1).join("\n").trim();
    map[heading] = body;
    const num = heading.match(/^(\d+)/)?.[1];
    if (num) map[num] = body;
  }
  return map;
}

function listItems(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(\d+\.|[-*])\s+/.test(l))
    .map((l) => l.replace(/^(\d+\.|[-*])\s+/, "").trim())
    .filter((l) => l.length > 3 && !/^none needed/i.test(l));
}

function checklistItems(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+\[[ xX]?\]\s+/.test(l) || /^[-*]\s+/.test(l))
    .map((l) =>
      l
        .replace(/^[-*]\s+\[[ xX]?\]\s+/, "")
        .replace(/^[-*]\s+/, "")
        .trim(),
    )
    .filter((l) => l.length > 3 && !/^none needed/i.test(l) && !/^_/.test(l));
}

function scriptItems(body: string): string[] {
  const scripts: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("> ")) {
      scripts.push(trimmed.replace(/^>\s?/, "").trim());
    }
  }
  return scripts.filter((s) => s.length > 8);
}

function makeAction(
  text: string,
  section: CoachAction["section"],
  target: CoachActionTarget,
): CoachAction {
  const codeMatch = text.match(/^\(([A-Z][A-Z0-9-]{1,12})\)\s*/);
  const projectCode = codeMatch?.[1];
  const title = (codeMatch ? text.slice(codeMatch[0].length) : text).trim();
  const id = `coach-${section}-${hash(text)}`;
  return {
    id,
    section,
    text,
    title: title.slice(0, 160),
    projectCode,
    target,
    knowledgeSection:
      target === "knowledge_risk"
        ? "risks"
        : target === "knowledge_openLoop"
          ? "openLoops"
          : undefined,
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function resolveProjectId(
  projects: Array<{ id: string; code: string }>,
  preferredProjectId: string | null | undefined,
  projectCode?: string,
): string | null {
  if (preferredProjectId) return preferredProjectId;
  if (projectCode) {
    const hit = projects.find(
      (p) => p.code.toUpperCase() === projectCode.toUpperCase(),
    );
    if (hit) return hit.id;
  }
  return projects[0]?.id ?? null;
}
