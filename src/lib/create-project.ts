import { emptyKnowledge } from "./knowledge";
import type {
  Project,
  ProjectKnowledge,
  Recommendation,
  Stakeholder,
  TodoItem,
} from "./types";

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
  stakeholders?: Array<{
    name: string;
    role?: string;
    concerns?: string[];
    preferences?: string[];
  }>;
  knowledgeNow?: string[];
  knowledgeRisks?: string[];
  knowledgePeople?: string[];
  knowledgeOpenLoops?: string[];
  knowledgeDecisions?: string[];
};

export type BuiltProjectBundle = {
  project: Project;
  knowledge: ProjectKnowledge;
  recommendations: Recommendation[];
  todos: TodoItem[];
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
    nextMilestone: input.nextMilestone?.trim() || undefined,
    nextMilestoneAt: toIsoFromDateInput(input.nextMilestoneAt),
    stakeholders,
  };

  const knowledge = emptyKnowledge(projectId);
  knowledge.updatedAt = now;
  knowledge.sections.now = uniqueBullets([
    ...(input.knowledgeNow ?? []),
    input.currentFocus.trim() ? `Current focus: ${input.currentFocus.trim()}` : "",
    input.summary.trim() ? input.summary.trim() : "",
  ]);
  knowledge.sections.decisions = uniqueBullets(input.knowledgeDecisions ?? []);
  knowledge.sections.risks = uniqueBullets(input.knowledgeRisks ?? []);
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

  if (!stakeholders.length) {
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

  if (!project.nextMilestone) {
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

  if (!knowledge.sections.risks.length) {
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

  const todos: TodoItem[] = [
    {
      id: id("todo"),
      projectId,
      title: "Confirm project baseline with key stakeholders",
      detail: "Align on outcome, next milestone, and who owns what.",
      done: false,
      createdAt: now,
      dueAt: project.nextMilestoneAt,
    },
  ];

  return { project, knowledge, recommendations, todos };
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
    if (out.length >= 8) break;
  }
  return out;
}

/** Best interview questions for building a useful Lume project. */
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
    knowledgeOpenLoops: risks.filter((r) =>
      /wait|confirm|unsigned|unconfirmed|chase/i.test(r),
    ),
    knowledgePeople: people.map((p) => {
      const c = p.concerns?.[0] ? ` — ${p.concerns[0]}` : "";
      return `${p.name} (${p.role ?? "Stakeholder"})${c}`;
    }),
  };
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
  const people: CreateProjectInput["stakeholders"] = [];
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
  if (!cleaned) return { label: undefined as string | undefined, date: undefined as string | undefined };
  const iso = cleaned.match(/(\d{4}-\d{2}-\d{2})/);
  const dmy = cleaned.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
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
    .replace(/\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i, "")
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
