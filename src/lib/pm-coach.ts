import { getOpenAIKey, isOpenAIConfigured } from "./openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import type { MissionState, Project } from "./types";

/** Prefer first name from display name; never invent a specific person. */
export function resolveCoachManagerLabel(
  displayName?: string | null,
): string {
  const trimmed = displayName?.trim();
  if (!trimmed) return "the project manager";
  const first = trimmed.split(/\s+/)[0];
  return first || "the project manager";
}

export function buildPmCoachSystemPrompt(managerLabel: string): string {
  const who = managerLabel.trim() || "the project manager";
  return `SYSTEM ROLE — Assistant Project Manager Coach
You are an Assistant Project Manager Coach for ${who}, embedded inside an application.
You do not initiate coaching on your own.
You only respond when the app requests guidance.

Your purpose is to help ${who} operate like a high‑performing, proactive, structured, and reliable project manager by analysing the project context provided to you and advising what ${who} should do next.

You always think:
“Given the current project situation, what should ${who} do right now to look like an exceptional project manager?”

CONTEXT AWARENESS
You have access to:
- Project data
- Meeting notes
- Decisions made
- Risks and issues
- Release plans
- Testing status
- Dependencies
- Stakeholder concerns
- Team roles and responsibilities

You use this information only when the app provides it.
You do not assume or invent missing details — you ask for clarification if needed.

CORE COACHING BEHAVIOURS
When the app requests coaching, you provide:
- Clear next actions ${who} should take
- Meeting guidance (how to lead, what to ask, what to clarify)
- Risk identification based on provided context
- Communication scripts ${who} can use
- Checklists for processes (testing, releases, dev handovers, etc.)
- Corrections if ${who}'s understanding is wrong
- Structured breakdowns of what’s happening and what ${who} should do

You do not generate daily summaries or proactive alerts unless explicitly requested.

HOW YOU RESPOND
Your coaching is:
- Action‑oriented
- Specific
- Practical
- Context‑driven
- No fluff
- No generic PM theory
- No motivational platitudes

You speak like a senior PM mentor who has seen every mistake and knows how to prevent them.

THINKING FRAMEWORK
Before responding, you silently evaluate:
- What is the current situation?
- What is missing?
- What risk is emerging?
- What dependency is unclear?
- What communication needs tightening?
- What would a senior PM do next?

Then you tell ${who} exactly what to do.

OUTPUT FORMAT
Your responses MUST follow this structure exactly:

## Leadership
What an exceptional PM would do to lead with confidence now — framing, stakeholder presence, ownership moments.

## Risks
Emerging or under-tracked risks grounded in the provided project knowledge. Prefer evidence over speculation.

## Strategic Actions
Proactive moves that advance the programme, not merely overdue tasks.

## Disruptive Opportunity
Always include this section. Highlight one non-obvious, high-leverage opportunity grounded in existing project knowledge (patterns, stakeholder preferences, release history, open loops). Explain why it is disruptive and what concrete first step unlocks it. Never leave this section empty.

## Recommended Actions
A short numbered list of concrete next actions the user can accept into To Do / Knowledge.

PRIMARY GOAL
Help ${who} look like:
- The person who always knows what’s going on
- The person who spots issues early
- The person who leads meetings with clarity
- The person who drives progress
- The person others trust
- The person who never gets blindsided again`;
}

/** @deprecated Prefer buildPmCoachSystemPrompt(resolveCoachManagerLabel(...)) */
export const PM_COACH_SYSTEM_PROMPT = buildPmCoachSystemPrompt(
  "the project manager",
);
export type CoachScope = {
  mode: "overview" | "project";
  projectId?: string;
};

function projectBundle(state: MissionState, project: Project) {
  const pid = project.id;
  return {
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      kind: project.kind ?? "delivery",
      status: project.status,
      summary: project.summary,
      currentFocus: project.currentFocus,
      nextMilestone: project.nextMilestone,
      nextMilestoneAt: project.nextMilestoneAt,
      stakeholders: project.stakeholders,
    },
    knowledge:
      state.knowledge.find((k) => k.projectId === pid)?.sections ?? null,
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === pid && !t.done)
      .slice(0, 12),
    activeRecommendations: state.recommendations
      .filter((r) => r.status === "active" && r.projectId === pid)
      .slice(0, 8)
      .map((r) => ({
        kind: r.kind,
        urgency: r.urgency,
        title: r.title,
        action: r.action,
        why: r.why,
      })),
    upcomingMeetings: state.meetings
      .filter((m) => m.projectId === pid && m.phase === "upcoming")
      .slice(0, 8)
      .map((m) => ({
        title: m.title,
        startsAt: m.startsAt,
        attendees: m.attendees,
        objectives: m.prep.objectives,
        decisionsToObtain: m.prep.decisionsToObtain,
        risksToDiscuss: m.prep.risksToDiscuss,
        openingScript: m.prep.openingScript,
      })),
    releases: state.releases
      .filter((r) => r.projectId === pid)
      .map((r) => ({
        name: r.name,
        targetDate: r.targetDate,
        currentStage: r.currentStage,
        risks: r.risks,
        stages: r.stages.filter(
          (s) =>
            s.status === "current" ||
            s.status === "at_risk" ||
            s.status === "blocked",
        ),
      })),
    timeline: (state.timeline ?? [])
      .filter((t) => t.projectId === pid)
      .slice(0, 16)
      .map((t) => ({
        label: t.label,
        type: t.type,
        startAt: t.startAt,
        endAt: t.endAt,
        notes: t.notes,
      })),
    recentMemories: state.memories
      .filter((m) => m.projectId === pid)
      .slice(0, 8)
      .map((m) => ({
        type: m.type,
        title: m.title,
        content: m.content.slice(0, 400),
        occurredAt: m.occurredAt,
      })),
  };
}

export function buildCoachContext(
  state: MissionState,
  scope: CoachScope,
  managerLabel: string = "the project manager",
): { title: string; context: unknown } {
  const who = managerLabel.trim() || "the project manager";
  if (scope.mode === "project" && scope.projectId) {
    const project = state.projects.find((p) => p.id === scope.projectId);
    if (!project) {
      return {
        title: "Project coaching",
        context: { error: "Project not found", projectId: scope.projectId },
      };
    }
    return {
      title: `Coach ${who} on ${project.code} — ${project.name}`,
      context: {
        scope: "single_project",
        ...projectBundle(state, project),
      },
    };
  }

  const projects = state.projects.filter(
    (p) => p.status === "watch" || p.status === "at_risk" || p.status === "healthy",
  );

  return {
    title: `Coach ${who} across all active projects`,
    context: {
      scope: "overview_all_projects",
      projects: projects.map((p) => projectBundle(state, p)),
    },
  };
}

export type CoachResult = {
  markdown: string;
  title: string;
  provider: "openai" | "local";
  scope: CoachScope;
};

export async function requestPmCoaching(
  state: MissionState,
  scope: CoachScope,
  managerLabel: string = "the project manager",
): Promise<CoachResult> {
  const who = resolveCoachManagerLabel(managerLabel);
  const { title, context } = buildCoachContext(state, scope, who);

  if (!isOpenAIConfigured()) {
    return {
      title,
      provider: "local",
      scope,
      markdown: localCoachFallback(state, scope),
    };
  }

  const key = getOpenAIKey();
  const userPrompt = `${title}

Use ONLY the project context JSON below. Do not invent missing facts. If something critical is missing, say what ${who} should confirm.

Respond in the required coaching sections.
Always include a highlighted ## Disruptive Opportunity section grounded in project knowledge.

CONTEXT JSON:
${JSON.stringify(context, null, 2)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAIChatModel(),
      temperature: 0.35,
      messages: [
        { role: "system", content: buildPmCoachSystemPrompt(who) },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Coach request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const markdown = data.choices?.[0]?.message?.content?.trim();
  if (!markdown) {
    throw new Error("Coach returned an empty response");
  }

  return { title, markdown, provider: "openai", scope };
}

export type CoachStreamEvent =
  | { type: "meta"; title: string; provider: "openai" | "local"; scope: CoachScope }
  | { type: "delta"; text: string }
  | { type: "done"; markdown: string }
  | { type: "error"; error: string };

/** Async generator that streams coach markdown (OpenAI stream or chunked local). */
export async function* streamPmCoaching(
  state: MissionState,
  scope: CoachScope,
  managerLabel: string = "the project manager",
): AsyncGenerator<CoachStreamEvent> {
  const who = resolveCoachManagerLabel(managerLabel);
  const { title, context } = buildCoachContext(state, scope, who);

  if (!isOpenAIConfigured()) {
    const markdown = localCoachFallback(state, scope);
    yield { type: "meta", title, provider: "local", scope };
    for (const chunk of chunkText(markdown, 48)) {
      yield { type: "delta", text: chunk };
      await sleep(18);
    }
    yield { type: "done", markdown };
    return;
  }

  const key = getOpenAIKey();
  const userPrompt = `${title}

Use ONLY the project context JSON below. Do not invent missing facts. If something critical is missing, say what ${who} should confirm.

Respond in the required coaching sections.
Always include a highlighted ## Disruptive Opportunity section grounded in project knowledge.
Under ## Recommended Actions, put each action on its own numbered line.

CONTEXT JSON:
${JSON.stringify(context, null, 2)}`;

  yield { type: "meta", title, provider: "openai", scope };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAIChatModel(),
      temperature: 0.35,
      stream: true,
      messages: [
        { role: "system", content: buildPmCoachSystemPrompt(who) },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(`Coach request failed (${response.status}): ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let markdown = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          markdown += delta;
          yield { type: "delta", text: delta };
        }
      } catch {
        // ignore partial JSON
      }
    }
  }

  if (!markdown.trim()) {
    throw new Error("Coach returned an empty response");
  }
  yield { type: "done", markdown };
}

function chunkText(text: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localCoachFallback(state: MissionState, scope: CoachScope): string {
  const projects =
    scope.mode === "project" && scope.projectId
      ? state.projects.filter((p) => p.id === scope.projectId)
      : state.projects;

  const lines: string[] = [];
  lines.push("## Leadership");
  for (const p of projects) {
    lines.push(
      `- **${p.code}**: Lead with a crisp narrative on “${p.currentFocus}”. Own the next conversation before stakeholders ask.`,
    );
  }

  lines.push("");
  lines.push("## Risks");
  for (const p of projects) {
    const knowledge = state.knowledge.find((k) => k.projectId === p.id);
    const risks = knowledge?.sections.risks ?? [];
    const loops = knowledge?.sections.openLoops ?? [];
    if (risks[0]) lines.push(`- (${p.code}) ${risks[0]}`);
    if (loops[0]) lines.push(`- (${p.code}) Open loop: ${loops[0]}`);
  }
  if (lines[lines.length - 1] === "## Risks") {
    lines.push("- No explicit risks in knowledge yet — confirm testing/release evidence is current.");
  }

  lines.push("");
  lines.push("## Strategic Actions");
  let n = 1;
  for (const p of projects) {
    const top = state.recommendations.find(
      (r) => r.status === "active" && r.projectId === p.id,
    );
    const todo = (state.todos ?? []).find(
      (t) => t.projectId === p.id && !t.done,
    );
    if (top) {
      lines.push(`${n}. (${p.code}) ${top.action}`);
      n += 1;
    } else if (todo) {
      lines.push(`${n}. (${p.code}) Close to-do: ${todo.title}`);
      n += 1;
    }
  }
  if (n === 1) {
    lines.push("1. Capture the latest update for each active project, then re-run coaching.");
  }

  lines.push("");
  lines.push("## Disruptive Opportunity");
  const disruptProject = projects[0];
  const knowledge = disruptProject
    ? state.knowledge.find((k) => k.projectId === disruptProject.id)
    : undefined;
  const preference =
    disruptProject?.stakeholders.find((s) => s.preferences?.[0])?.preferences?.[0] ??
    knowledge?.sections.people?.[0] ??
    knowledge?.sections.decisions?.[0];
  if (disruptProject && preference) {
    lines.push(
      `Use ${disruptProject.code} knowledge (“${preference}”) to pre-empt the next difficult conversation — send a short written brief before the meeting so you set the frame instead of reacting to it.`,
    );
  } else {
    lines.push(
      "Turn silent stakeholders into an early-warning system: schedule a 15-minute pre-brief with the least-contacted sponsor and ask what would surprise them in the next steering conversation.",
    );
  }

  lines.push("");
  lines.push("## Recommended Actions");
  lines.push("1. Draft the disruptive brief and add it to To Do");
  lines.push("2. Confirm owners for the top risk in Knowledge");
  lines.push("3. Rehearse the next meeting opening out loud once");
  lines.push("");
  lines.push(
    "_Local coach mode — add OPENAI_API_KEY for full Assistant PM Coach responses._",
  );

  return lines.join("\n");
}
