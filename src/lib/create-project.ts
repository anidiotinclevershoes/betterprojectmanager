import { emptyKnowledge } from "./knowledge";
import type {
  Project,
  ProjectKnowledge,
  Recommendation,
  Stakeholder,
  TimelineItem,
  TodoItem,
  TodoKind,
} from "./types";

export type SetupTodoDraft = {
  title: string;
  dueAt?: string;
  kind?: TodoKind;
  waitingOn?: string;
  needsReview?: boolean;
};

export type SetupDateDraft = {
  label: string;
  date?: string;
  needsReview?: boolean;
};

export type SetupStakeholderDraft = {
  name: string;
  role?: string;
  concerns?: string[];
  preferences?: string[];
  needsReview?: boolean;
};

export type SetupRiskDraft = {
  title: string;
  needsReview?: boolean;
};

export type SetupKnowledgeDraft = {
  text: string;
  /** When false, excluded from create. Default true. */
  remember?: boolean;
};

/**
 * Structured project-setup draft shared by Talk and Paste pathways.
 * Also used by Start Blank (minimal fields).
 */
export type CreateProjectInput = {
  name: string;
  code: string;
  summary: string;
  kind?: "delivery" | "release_ops";
  status?: Project["status"];
  currentFocus: string;
  nextMilestone?: string;
  /** yyyy-mm-dd or ISO */
  nextMilestoneAt?: string;
  stakeholders?: SetupStakeholderDraft[];
  knowledgeNow?: string[];
  knowledgeRisks?: string[];
  knowledgePeople?: string[];
  knowledgeOpenLoops?: string[];
  knowledgeDecisions?: string[];
  /** Durable facts — Things Lume will remember. */
  knowledgeRemember?: SetupKnowledgeDraft[];
  todos?: SetupTodoDraft[];
  risks?: SetupRiskDraft[];
  importantDates?: SetupDateDraft[];
  /** Optional not-mentioned hints for review (never block create). */
  notMentioned?: string[];
  /** Original Talk/Paste source for history. */
  sourceNarrative?: string;
  sourceMode?: "talk" | "paste" | "blank" | "interview";
};

export type BuiltProjectBundle = {
  project: Project;
  knowledge: ProjectKnowledge;
  recommendations: Recommendation[];
  todos: TodoItem[];
  timeline: TimelineItem[];
};

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function suggestCode(name: string) {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!words.length) return "PROJ";
  if (words.length === 1) return words[0]!.slice(0, 8);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .slice(0, 8);
}

export function toIsoFromDateInput(value?: string) {
  if (!value?.trim()) return undefined;
  if (value.includes("T")) return value;
  return new Date(`${value}T09:00:00`).toISOString();
}

export function countSetupItems(draft: CreateProjectInput) {
  const remember = (draft.knowledgeRemember ?? []).filter(
    (k) => k.remember !== false && k.text.trim(),
  );
  const knowledgeLegacy = [
    ...(draft.knowledgeNow ?? []),
    ...(draft.knowledgeDecisions ?? []),
    ...(draft.knowledgeOpenLoops ?? []),
  ].filter(Boolean);
  return {
    todos: (draft.todos ?? []).filter((t) => t.title.trim()).length,
    risks:
      (draft.risks ?? []).filter((r) => r.title.trim()).length ||
      (draft.knowledgeRisks ?? []).filter(Boolean).length,
    stakeholders: (draft.stakeholders ?? []).filter((s) => s.name.trim())
      .length,
    dates: (draft.importantDates ?? []).filter((d) => d.label.trim()).length,
    knowledge: remember.length || knowledgeLegacy.length,
  };
}

export function includedItemCount(draft: CreateProjectInput) {
  const c = countSetupItems(draft);
  const base = draft.name.trim() ? 1 : 0;
  return (
    base +
    c.todos +
    c.risks +
    c.stakeholders +
    c.dates +
    c.knowledge +
    (draft.summary.trim() ? 1 : 0)
  );
}

export function buildNewProject(input: CreateProjectInput): BuiltProjectBundle {
  const name = input.name.trim();
  const code = (input.code.trim() || suggestCode(name)).toUpperCase();
  const projectId = id("proj");
  const now = new Date().toISOString();

  const stakeholders: Stakeholder[] = (input.stakeholders ?? [])
    .map((s) => ({
      id: id("st"),
      name: s.name.trim(),
      role: (s.role ?? "Stakeholder").trim() || "Stakeholder",
      concerns: s.concerns?.map((c) => c.trim()).filter(Boolean),
      preferences: s.preferences?.map((p) => p.trim()).filter(Boolean),
    }))
    .filter((s) => s.name);

  const dates = (input.importantDates ?? []).filter((d) => d.label.trim());
  const primaryDate =
    dates.find((d) => d.date) ??
    (input.nextMilestoneAt
      ? { label: input.nextMilestone || "Next milestone", date: input.nextMilestoneAt }
      : undefined);

  const project: Project = {
    id: projectId,
    name,
    code,
    summary: input.summary.trim() || `${name} — newly added to Lume.`,
    status: input.status ?? "watch",
    kind: input.kind ?? "delivery",
    currentFocus:
      input.currentFocus.trim() ||
      "Establish baseline: owners, next milestone, and open risks",
    nextMilestone:
      input.nextMilestone?.trim() ||
      primaryDate?.label ||
      undefined,
    nextMilestoneAt: toIsoFromDateInput(
      input.nextMilestoneAt || primaryDate?.date,
    ),
    stakeholders,
  };

  const rememberBullets = (input.knowledgeRemember ?? [])
    .filter((k) => k.remember !== false && k.text.trim())
    .map((k) => k.text.trim());

  const riskTitles = [
    ...(input.risks ?? []).map((r) => r.title.trim()).filter(Boolean),
    ...(input.knowledgeRisks ?? []),
  ];

  const knowledge = emptyKnowledge(projectId);
  knowledge.updatedAt = now;
  knowledge.sections.now = uniqueBullets([
    ...(input.knowledgeNow ?? []),
    ...rememberBullets.slice(0, 4),
    input.currentFocus.trim() ? `Current focus: ${input.currentFocus.trim()}` : "",
    input.summary.trim() ? input.summary.trim() : "",
  ]);
  knowledge.sections.decisions = uniqueBullets([
    ...(input.knowledgeDecisions ?? []),
    ...rememberBullets.slice(4),
  ]);
  knowledge.sections.risks = uniqueBullets(riskTitles);
  knowledge.sections.people = uniqueBullets([
    ...(input.knowledgePeople ?? []),
    ...stakeholders.map((s) => {
      const concern = s.concerns?.[0] ? ` — ${s.concerns[0]}` : "";
      return `${s.name} (${s.role})${concern}`;
    }),
  ]);
  knowledge.sections.openLoops = uniqueBullets(input.knowledgeOpenLoops ?? []);

  const recommendations: Recommendation[] = [];
  const pushRec = (
    partial: Omit<Recommendation, "id" | "createdAt" | "status" | "projectId">,
  ) => {
    recommendations.push({
      ...partial,
      id: id("rec"),
      projectId,
      createdAt: now,
      status: "active",
    });
  };

  if (!stakeholders.length && input.sourceMode !== "blank") {
    pushRec({
      kind: "stakeholder_update",
      urgency: "this_week",
      title: "Name the 2–3 people who can make or break this project",
      action:
        "Capture sponsor, delivery lead, and anyone skeptical — with what they care about.",
      why: "Without named stakeholders, coaching and updates stay generic.",
      leadershipImpact:
        "You look prepared because you already know who matters.",
    });
  }

  if (!project.nextMilestone && input.sourceMode !== "blank") {
    pushRec({
      kind: "decision",
      urgency: "today",
      title: "Set the next visible milestone with a date",
      action:
        "Pick one near-term win stakeholders can see, and put a date on it.",
      why: "A project without a next visible win drifts into status theatre.",
      leadershipImpact: "You create forward motion people can trust.",
    });
  }

  if (!knowledge.sections.risks.length && input.sourceMode !== "blank") {
    pushRec({
      kind: "risk",
      urgency: "this_week",
      title: "Log the first risk or open loop",
      action:
        "Write down what could surprise a stakeholder if left unspoken this week.",
      why: "Empty risk lists are usually optimism, not control.",
      leadershipImpact: "You surface issues before they surface you.",
    });
  }

  const draftTodos = (input.todos ?? []).filter((t) => t.title.trim());
  const todos: TodoItem[] =
    draftTodos.length > 0
      ? draftTodos.map((t) => ({
          id: id("todo"),
          projectId,
          title: t.title.trim(),
          done: false,
          createdAt: now,
          dueAt: toIsoFromDateInput(t.dueAt),
          kind: t.kind ?? "ACTION",
          waitingOn: t.waitingOn,
        }))
      : input.sourceMode === "blank"
        ? []
        : [
            {
              id: id("todo"),
              projectId,
              title: "Confirm project baseline with key stakeholders",
              detail: "Align on outcome, next milestone, and who owns what.",
              done: false,
              createdAt: now,
              dueAt: project.nextMilestoneAt,
              kind: "ACTION" as const,
            },
          ];

  const timeline: TimelineItem[] = dates
    .filter((d) => d.date)
    .map((d) => {
      const label = d.label.trim();
      const lower = label.toLowerCase();
      const type = /cab|submit|submission|pack due/.test(lower)
        ? ("submission" as const)
        : /meeting|sync|review|board|walkthrough/.test(lower)
          ? ("meeting" as const)
          : /deadline|due|freeze|cut.?off|sign-?off|release|go-?live|launch/.test(
                lower,
              )
            ? ("deadline" as const)
            : /window|phase|testing|hypercare|merge/.test(lower)
              ? ("phase" as const)
              : ("milestone" as const);
      return {
        id: id("tl"),
        projectId,
        label,
        type,
        startAt: toIsoFromDateInput(d.date)!,
        source: "manual" as const,
      };
    });

  return { project, knowledge, recommendations, todos, timeline };
}

function uniqueBullets(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.replace(/^[-•*\d.)\s]+/, "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 220));
    if (out.length >= 12) break;
  }
  return out;
}

/** Best interview questions — retained for legacy/API compatibility. */
export const PROJECT_INTERVIEW: Array<{
  id: string;
  prompt: string;
  tip: string;
  voiceHint: string;
}> = [
  {
    id: "identity",
    prompt: "What is this project called, and what’s a short code for the tab?",
    tip: "Code is what you’ll see in the top tabs — e.g. ATLAS, HORIZON.",
    voiceHint: "Say the full name, then a short code if you have one.",
  },
  {
    id: "outcome",
    prompt: "In one or two sentences, what is this project trying to achieve?",
    tip: "Outcome, not activity. What does ‘done well’ look like?",
    voiceHint: "Describe the outcome stakeholders actually care about.",
  },
  {
    id: "focus",
    prompt: "What should you be focused on right now / this week?",
    tip: "This becomes Current focus — keep it concrete and near-term.",
    voiceHint: "What’s the main thing you’re driving this week?",
  },
  {
    id: "milestone",
    prompt: "What’s the next visible milestone, and roughly when is it due?",
    tip: "Something others can see — a CAB, workshop, demo, or go-live.",
    voiceHint: "Name the milestone and a date if you know one.",
  },
  {
    id: "people",
    prompt:
      "Who are the key people? For each: name, role, and what they care about or worry about.",
    tip: "Sponsor, delivery lead, skeptics — 2–4 people is enough to start.",
    voiceHint: "Walk through people one by one: name, role, concern.",
  },
  {
    id: "risks",
    prompt: "What risks, blockers, or open loops should we not forget?",
    tip: "Anything that could surprise a stakeholder if left unspoken.",
    voiceHint: "List risks and waits — even if they’re still assumptions.",
  },
];

export type InterviewAnswers = Record<string, string>;

export const TALK_GUIDANCE_TOPICS = [
  "What are you trying to deliver?",
  "What are the important dates, milestones or releases?",
  "Who is involved and what do they do?",
  "What work is already underway?",
  "What still needs doing?",
  "What are you worried might go wrong?",
  "What decisions have already been made?",
  "Are you waiting for anything from somebody else?",
  "Are there rules, constraints or unusual details that Lume should remember?",
] as const;

export const TALK_EXAMPLE = `This is the Horizon Customer Portal project.

We're replacing the current portal before the November renewal window.

Sarah owns the business side and Marcus is leading technical delivery.

Security sign-off is due on the 12th.

We're worried the identity provider integration may delay testing.

CAB needs the release pack 48 hours before the meeting, and Sarah normally wants the residual-risk summary in writing before she'll approve anything.

We've already started regression testing, but we still need confirmation from Finance…`;

/** Local (no API) assembly of interview answers into a create payload. */
export function assembleFromInterview(
  answers: InterviewAnswers,
  kind: "delivery" | "release_ops" = "delivery",
): CreateProjectInput {
  const identity = answers.identity ?? "";
  const { name, code } = parseIdentity(identity);
  const people = parsePeople(answers.people ?? "");
  const milestone = parseMilestone(answers.milestone ?? "");
  const risks = splitBullets(answers.risks ?? "");

  return {
    name: name || "New project",
    code: code || suggestCode(name || "NEW"),
    summary: (answers.outcome ?? "").trim(),
    kind,
    currentFocus: (answers.focus ?? "").trim(),
    nextMilestone: milestone.label,
    nextMilestoneAt: milestone.date,
    stakeholders: people,
    knowledgeRisks: risks,
    risks: risks.map((title) => ({ title })),
    knowledgeOpenLoops: risks.filter((r) =>
      /wait|confirm|unsigned|unconfirmed|chase/i.test(r),
    ),
    knowledgePeople: people.map((p) => {
      const c = p.concerns?.[0] ? ` — ${p.concerns[0]}` : "";
      return `${p.name} (${p.role ?? "Stakeholder"})${c}`;
    }),
    sourceMode: "interview",
  };
}

/**
 * Deterministic free-form Talk/Paste → draft extractor.
 * Does not invent people, risks, or tasks that are not evidenced.
 */
export function assembleFromNarrative(
  narrative: string,
  kind: "delivery" | "release_ops" = "delivery",
  sourceMode: "talk" | "paste" = "paste",
): CreateProjectInput {
  const text = narrative.trim();
  if (!text) {
    return {
      name: "New project",
      code: "PROJ",
      summary: "",
      kind,
      currentFocus: "",
      sourceMode,
      sourceNarrative: narrative,
    };
  }

  const { name, code } = extractProjectName(text);
  const summary = extractObjective(text, name);
  const stakeholders = extractStakeholders(text);
  const risks = extractRisks(text);
  const todos = extractTodos(text);
  const dates = extractDates(text);
  const remember = extractKnowledge(text);
  const focus = extractFocus(text);

  const primary = dates[0];
  const notMentioned: string[] = [];
  if (!stakeholders.some((s) => /sponsor/i.test(s.role ?? ""))) {
    notMentioned.push("Project sponsor");
  }
  if (!dates.some((d) => /release|go-?live|launch/i.test(d.label))) {
    notMentioned.push("Final release date");
  }
  if (!/budget|cost|£|\$/i.test(text)) {
    notMentioned.push("Budget");
  }

  return {
    name: name || "New project",
    code: code || suggestCode(name || "NEW"),
    summary,
    kind,
    currentFocus: focus,
    nextMilestone: primary?.label,
    nextMilestoneAt: primary?.date,
    stakeholders,
    risks,
    knowledgeRisks: risks.map((r) => r.title),
    todos,
    importantDates: dates,
    knowledgeRemember: remember.map((text) => ({ text, remember: true })),
    knowledgeDecisions: remember.filter((t) =>
      /decid|agreed|approved|rule|requires|needs|prefer/i.test(t),
    ),
    knowledgeNow: remember.slice(0, 3),
    knowledgePeople: stakeholders.map((p) => {
      const c = p.concerns?.[0] ? ` — ${p.concerns[0]}` : "";
      return `${p.name} (${p.role ?? "Stakeholder"})${c}`;
    }),
    knowledgeOpenLoops: todos
      .filter((t) => t.kind === "WAITING" || t.kind === "CHASE")
      .map((t) => t.title),
    notMentioned: notMentioned.slice(0, 4),
    sourceNarrative: narrative,
    sourceMode,
  };
}

function extractProjectName(text: string): { name: string; code: string } {
  const patterns = [
    /(?:this is|project(?:\s+is)?|called|we're working on)\s+(?:the\s+)?([A-Z][A-Za-z0-9 &/-]{2,60}?)(?:\s+project)?[.!\n]/i,
    /^([A-Z][A-Za-z0-9 &/-]{2,40})\s+project\b/im,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const name = m[1]
        .replace(/\bproject\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (name.length >= 3) {
        return { name, code: suggestCode(name) };
      }
    }
  }
  const first = text.split(/[.!\n]/)[0]?.trim() ?? "";
  if (first.length > 8 && first.length < 60 && /^[A-Z]/.test(first)) {
    const name = first.replace(/\b(this is|we're|we are)\b/gi, "").trim();
    if (name.length >= 3) return { name: name.slice(0, 60), code: suggestCode(name) };
  }
  return { name: "", code: "" };
}

function extractObjective(text: string, name: string): string {
  const re =
    /(?:we're|we are|trying to|aim(?:ing)? to|goal is to|objective is to|deliver(?:ing)?|replac(?:e|ing)|build(?:ing)?)\s+([^.!\n]{12,160})/i;
  const m = text.match(re);
  if (m?.[1]) {
    let s = m[0].replace(/\s+/g, " ").trim();
    if (name) s = s; // keep as spoken
    return ensureSentence(s.slice(0, 220));
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  return sentences[1] || sentences[0] || "";
}

function extractFocus(text: string): string {
  const m = text.match(
    /(?:already started|currently|right now|this week|focused on|working on)\s+([^.!\n]{8,120})/i,
  );
  return m ? ensureSentence(m[0].replace(/\s+/g, " ").trim().slice(0, 160)) : "";
}

/** Proper noun capture — do not use the `i` flag with [A-Z] (JS would match lowercase). */
const PERSON =
  "\\b((?:[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)|(?:Finance|Security|Operations|Platform))\\b";

function extractStakeholders(text: string): SetupStakeholderDraft[] {
  const people: SetupStakeholderDraft[] = [];
  const patterns: Array<{ re: RegExp; role?: string; roleFromGroup?: number }> =
    [
      {
        re: new RegExp(
          `${PERSON}\\s+(?:owns|is|as)\\s+(?:the\\s+)?(?:business(?:\\s+side)?|business owner)`,
          "g",
        ),
        role: "Business Owner",
      },
      {
        re: new RegExp(
          `${PERSON}\\s+(?:is leading|leads|leading)\\s+technical`,
          "g",
        ),
        role: "Technical Lead",
      },
      {
        re: new RegExp(
          `${PERSON}\\s+(?:owns|is)\\s+(?:the\\s+)?sponsor`,
          "g",
        ),
        role: "Sponsor",
      },
      {
        re: new RegExp(
          `${PERSON}\\s+(?:handles|owns|leads)\\s+([^.!\\n,]{4,40})`,
          "g",
        ),
        roleFromGroup: 2,
      },
    ];

  const stop = /^(This|We|The|Our|CAB|Security|Platform|And|But|Then|Need|Needs|Confirmation|Await|Waiting)$/i;

  for (const { re, role, roleFromGroup } of patterns) {
    for (const match of text.matchAll(re)) {
      const name = match[1]?.trim();
      if (!name || stop.test(name) || name.includes(" and ")) continue;
      if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        continue;
      }
      const fromGroup =
        roleFromGroup != null
          ? titleCase((match[roleFromGroup] ?? "").trim().slice(0, 40))
          : "";
      const inferredRole = role || fromGroup || undefined;
      if (!inferredRole) continue;
      // Skip roles that look like sentence debris
      if (/^(the|and|but|from|for)\b/i.test(inferredRole)) continue;
      people.push({
        name,
        role: inferredRole,
        needsReview: !role,
      });
      if (people.length >= 8) break;
    }
    if (people.length >= 8) break;
  }

  // Team / function named without a person — e.g. "confirmation from Finance"
  if (
    /\bfrom Finance\b/i.test(text) &&
    !people.some((p) => /finance/i.test(p.name) || /finance/i.test(p.role ?? ""))
  ) {
    people.push({
      name: "Finance",
      role: "Finance",
      needsReview: true,
    });
  }

  return people;
}

function extractRisks(text: string): SetupRiskDraft[] {
  const risks: SetupRiskDraft[] = [];
  const cues = [
    /\b(?:we're|we are)\s+worried\s+(?:that\s+)?([^.!\n]{10,140})/gi,
    /\bworried\s+(?:that\s+)?([^.!\n]{10,140})/gi,
    /\bconcern(?:ed)?\s+(?:that\s+|about\s+)?([^.!\n]{10,140})/gi,
    /\b(?:risk(?:s)?\s+(?:is|are|that)\s+)([^.!\n]{10,140})/gi,
    /\b([^.!\n]{8,120}?\b(?:may|might|could)\s+delay\b[^.!\n]{0,80})/gi,
    /\b([^.!\n]{8,100}?\bthreaten(?:s|ed|ing)?\b[^.!\n]{0,80})/gi,
  ];
  for (const re of cues) {
    for (const match of text.matchAll(re)) {
      let title = (match[1] ?? match[0]!).replace(/\s+/g, " ").trim();
      title = title.replace(/^(worried|concerned|concern)\s+(that\s+|about\s+)?/i, "");
      title = title.replace(/^(we're|we are)\s+worried\s+(that\s+)?/i, "");
      // Avoid knowledge lines that merely mention "risk" as a noun in a preference
      if (
        /\b(?:residual[- ]risk|risk summary|risks included)\b/i.test(title) &&
        !/\b(delay|threaten|blocker|worried)\b/i.test(title)
      ) {
        continue;
      }
      title = ensureSentence(title.slice(0, 160));
      if (title.length < 12) continue;
      const needsReview = /maybe|possibly|might|could be/i.test(title);
      if (!risks.some((r) => r.title.toLowerCase() === title.toLowerCase())) {
        risks.push({ title, needsReview });
      }
      if (risks.length >= 8) break;
    }
    if (risks.length >= 8) break;
  }
  return risks;
}

function extractTodos(text: string): SetupTodoDraft[] {
  const todos: SetupTodoDraft[] = [];

  const chase = text.matchAll(
    /chase\s+([A-Z][a-zA-Z]+)(?:\s+for|\s+on)?\s+([^.!\n]{6,100})/gi,
  );
  for (const m of chase) {
    const who = m[1]!;
    if (!/^[A-Z]/.test(who) || /^(two|the|a)$/i.test(who)) continue;
    todos.push({
      title: `Chase ${who}: ${m[2]!.replace(/\s+/g, " ").trim()}`,
      kind: "CHASE",
      waitingOn: who,
      dueAt: extractLooseDateNear(m[0]!),
    });
  }

  const waiting = text.matchAll(
    /(?:still need|waiting (?:on|for)|await(?:ing)?)\s+([^.!\n]{6,100})/gi,
  );
  for (const m of waiting) {
    const detail = m[1]!.replace(/\s+/g, " ").trim();
    const whoMatch = detail.match(/^([A-Z][a-zA-Z]+|Finance|Vendor|Security)/);
    todos.push({
      title: ensureSentence(`Await ${detail}`.slice(0, 140)),
      kind: "WAITING",
      waitingOn: whoMatch?.[1],
    });
  }

  const need = text.matchAll(
    /(?:still need to|need to|must|should)\s+([^.!\n]{8,100})/gi,
  );
  for (const m of need) {
    const title = ensureSentence(m[1]!.replace(/\s+/g, " ").trim().slice(0, 140));
    if (/worried|risk|remember/i.test(title)) continue;
    if (!todos.some((t) => t.title.toLowerCase().includes(title.toLowerCase().slice(0, 24)))) {
      todos.push({ title, kind: "ACTION", dueAt: extractLooseDateNear(m[0]!) });
    }
    if (todos.length >= 10) break;
  }

  return todos.slice(0, 10);
}

function extractDates(text: string): SetupDateDraft[] {
  const dates: SetupDateDraft[] = [];
  const monthRe =
    /([A-Za-z][A-Za-z0-9 &\-/]{3,50}?)\s+(?:due|on|by|before)?\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/gi;
  const year = new Date().getFullYear();
  for (const m of text.matchAll(monthRe)) {
    const label = m[1]!.replace(/\s+/g, " ").trim();
    const day = m[2]!.padStart(2, "0");
    const month = monthNum(m[3]!);
    if (!month) continue;
    dates.push({
      label: titleCase(label.replace(/^(the|a)\s+/i, "")),
      date: `${year}-${month}-${day}`,
    });
  }

  const named =
    /(?:before|by|for)\s+(?:the\s+)?(November|December|January|February|March|April|May|June|July|August|September|October)\s+([A-Za-z0-9 &\-/]{3,40})/gi;
  for (const m of text.matchAll(named)) {
    const month = monthNum(m[1]!);
    const label = titleCase(m[2]!.replace(/\s+/g, " ").trim());
    if (!month) continue;
    if (!dates.some((d) => d.label.toLowerCase() === label.toLowerCase())) {
      dates.push({
        label,
        date: `${year}-${month}-15`,
        needsReview: true,
      });
    }
  }

  const iso = text.matchAll(
    /([A-Za-z][A-Za-z0-9 &\-/]{3,40}?)\s+(?:on|by|due)\s+(\d{4}-\d{2}-\d{2})/gi,
  );
  for (const m of iso) {
    dates.push({
      label: titleCase(m[1]!.replace(/\s+/g, " ").trim()),
      date: m[2]!,
    });
  }

  return dates.slice(0, 8);
}

function extractKnowledge(text: string): string[] {
  const facts: string[] = [];
  const patterns = [
    /((?:CAB|Security|Platform|Steering)[^.!\n]{10,140}(?:requires?|needs?|prefer|normally|only|must|before)[^.!\n]{5,80})/gi,
    /((?:[A-Z][a-z]+)\s+(?:normally|usually|only|prefers?|wants?|requires?)[^.!\n]{10,120})/gi,
    /((?:remember|rule|constraint|always|never)\s+[^.!\n]{10,120})/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      let fact = m[1]!.replace(/\s+/g, " ").trim();
      fact = fact.replace(/^remember(?:\s+that)?\s+/i, "");
      if (/^(worried|we need|we've|finance)/i.test(fact)) continue;
      if (/\b(still need|waiting on|confirmation from)\b/i.test(fact)) continue;
      const cleaned = ensureSentence(fact.slice(0, 180));
      if (cleaned.length < 24) continue;
      // Skip exact duplicates and obvious substring echoes of a longer fact
      const lower = cleaned.toLowerCase();
      if (facts.some((f) => f.toLowerCase() === lower)) continue;
      if (facts.some((f) => f.toLowerCase().includes(lower) && f.length > cleaned.length + 10)) {
        continue;
      }
      // Prefer longer fact when a new one contains an existing shorter one
      const shorterIdx = facts.findIndex(
        (f) => lower.includes(f.toLowerCase()) && cleaned.length > f.length + 10,
      );
      if (shorterIdx >= 0) {
        facts.splice(shorterIdx, 1, cleaned);
      } else {
        facts.push(cleaned);
      }
      if (facts.length >= 12) return facts;
    }
  }
  return facts;
}

function extractLooseDateNear(snippet: string): string | undefined {
  const m = snippet.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
  );
  if (!m) {
    if (/\bfriday\b/i.test(snippet)) return undefined;
    return undefined;
  }
  const year = new Date().getFullYear();
  const month = monthNum(m[2]!);
  if (!month) return undefined;
  return `${year}-${month}-${m[1]!.padStart(2, "0")}`;
}

function monthNum(name: string) {
  const map: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  return map[name.toLowerCase()];
}

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function ensureSentence(s: string) {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : capped;
}

function parseIdentity(text: string) {
  const cleaned = text.trim();
  const codeInParens = cleaned.match(/\(([A-Za-z0-9-]{2,12})\)/);
  const codeAfter = cleaned.match(
    /(?:code|tab|call it)\s*[:=]?\s*([A-Za-z0-9-]{2,12})/i,
  );
  const code = (codeInParens?.[1] || codeAfter?.[1] || "").toUpperCase();
  let name = cleaned
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:code|tab|call it)\s*[:=]?\s*[A-Za-z0-9-]{2,12}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name && cleaned) name = cleaned.split(/[,.]/)[0]!.trim();
  return { name, code };
}

function parsePeople(text: string) {
  const chunks = text
    .split(/\n|;|\.(?=\s+[A-Z])/)
    .map((c) => c.trim())
    .filter(Boolean);
  const people: SetupStakeholderDraft[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)(?:\s*[-–,:(]\s*|\s+)(.+)$/,
    );
    if (m) {
      const name = m[1]!;
      const rest = m[2]!.replace(/^role\s*/i, "").trim();
      const [rolePart, ...concernParts] = rest.split(/[-–:]/);
      people.push({
        name,
        role: (rolePart ?? "Stakeholder").trim().slice(0, 60),
        concerns: concernParts.length
          ? [concernParts.join(":").trim()].filter(Boolean)
          : undefined,
      });
    } else if (chunk.length > 2) {
      people.push({ name: chunk.slice(0, 60), role: "Stakeholder" });
    }
    if (people.length >= 6) break;
  }
  return people;
}

function parseMilestone(text: string) {
  const cleaned = text.trim();
  if (!cleaned)
    return {
      label: undefined as string | undefined,
      date: undefined as string | undefined,
    };
  const iso = cleaned.match(/(\d{4}-\d{2}-\d{2})/);
  const dmy = cleaned.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  );
  let date: string | undefined;
  if (iso) date = iso[1];
  else if (dmy) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const mm = months[dmy[2]!.slice(0, 3).toLowerCase()]!;
    date = `${dmy[3]}-${mm}-${dmy[1]!.padStart(2, "0")}`;
  }
  const label = cleaned
    .replace(/\d{4}-\d{2}-\d{2}/, "")
    .replace(
      /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i,
      "",
    )
    .replace(/\b(due|by|on|around|roughly)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.\-–\s]+|[,.\-–\s]+$/g, "")
    .trim();
  return { label: label || cleaned.slice(0, 80), date };
}

function splitBullets(text: string) {
  return text
    .split(/\n|;|(?:^|\s)[-•*]\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3)
    .slice(0, 8);
}
