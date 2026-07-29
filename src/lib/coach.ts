import { CONTINUOUS_ANALYSIS_QUESTIONS, DAILY_PRINCIPLE } from "./mission";
import { getPlaybookStage } from "./release-playbook";
import type {
  CaptureInput,
  CaptureResult,
  Meeting,
  MemoryEntry,
  MissionState,
  Recommendation,
} from "./types";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function daysSince(iso?: string) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

/**
 * Analyse captured information immediately — never wait for the user to ask.
 */
export function analyseCapture(
  input: CaptureInput,
  state: MissionState,
): CaptureResult {
  const content = input.content.trim();
  const lower = content.toLowerCase();
  const projectId = input.projectId;
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const sourceType = input.sourceType ?? "note";

  const typeMap = {
    note: "conversation",
    voice_note: "voice_note",
    conversation: "conversation",
    meeting_note: "meeting_note",
  } as const;

  const memory: MemoryEntry = {
    id: id("mem"),
    type: typeMap[sourceType],
    projectId,
    title: deriveTitle(content),
    content,
    tags: deriveTags(lower),
    people: derivePeople(content, state),
    occurredAt,
    createdAt: new Date().toISOString(),
    source: "capture",
  };

  const insights: string[] = [];
  const assumptions: string[] = [];
  const recommendations: Recommendation[] = [];

  insights.push(
    `Captured as ${memory.type.replaceAll("_", " ")}. Running continuous analysis against ${CONTINUOUS_ANALYSIS_QUESTIONS.length} Programme Manager checks.`,
  );

  // Risk signals
  if (
    /risk|blocker|blocked|delay|slipping|slip|concern|worried|unstable|flaky|failure|outage/i.test(
      content,
    )
  ) {
    insights.push(
      "Risk language detected — treating this as an emerging delivery signal, not a passive note.",
    );
    recommendations.push({
      id: id("rec"),
      kind: "risk",
      urgency: "today",
      title: "Surface this risk with an owner and date",
      action:
        "Translate what you captured into a named risk: owner, impact, mitigation, and the next check-in date.",
      why: "Unowned risks become stakeholder surprises. Capturing it now is only useful if someone owns the next move.",
      leadershipImpact:
        "You look like the person who sees problems early and puts structure around them.",
      projectId,
      relatedMemoryIds: [memory.id],
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  // Waiting / dependency
  if (
    /waiting on|waiting for|depend|blocked by|need .+ from|chasing|follow.?up/i.test(
      content,
    )
  ) {
    insights.push(
      "Someone may be waiting on you — or you on them. Dependency pressure detected.",
    );
    recommendations.push({
      id: id("rec"),
      kind: "dependency",
      urgency: "now",
      title: "Close the waiting loop today",
      action:
        "Send a short, specific chase or unblock message with what you need, by when, and why it matters to the next milestone.",
      why: "Silent waits erode trust. Exceptional Programme Managers make dependency pressure visible early.",
      leadershipImpact:
        "You appear organised and dependable — not someone things stall with.",
      projectId,
      relatedMemoryIds: [memory.id],
      suggestedScript:
        "Quick nudge: I need [artefact/decision] by [date] to keep [milestone] on track. Anything blocking you that I can help clear?",
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  // Decision needed
  if (
    /decide|decision|need agreement|sign.?off|approve|go\/no-go|trade-?off/i.test(
      content,
    )
  ) {
    insights.push("A decision appears to be forming or outstanding.");
    recommendations.push({
      id: id("rec"),
      kind: "decision",
      urgency: "today",
      title: "Frame and obtain the decision",
      action:
        "Write the decision in one sentence, offer 2–3 options with a recommendation, and take it to the right person.",
      why: "Decisions that sit in notes do not move delivery. Leaders bring options and a clear ask.",
      leadershipImpact:
        "You lead the discussion instead of reacting when someone else forces the call.",
      projectId,
      relatedMemoryIds: [memory.id],
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  // Stakeholder / update
  if (
    /stakeholder|sponsor|update|comms|communicate|brief|cab|steering/i.test(
      content,
    )
  ) {
    insights.push(
      "Stakeholder or governance signal — check whether communication is overdue.",
    );
  }

  // Meeting needed
  if (
    /should meet|need a meeting|workshop|review|sync with|walk .+ through/i.test(
      content,
    )
  ) {
    recommendations.push({
      id: id("rec"),
      kind: "meeting",
      urgency: "this_week",
      title: "Arrange the conversation with a clear purpose",
      action:
        "Propose a short meeting with objectives, decisions required, and a draft agenda in the invite.",
      why: "Calling a meeting without purpose looks busy. Calling one with decisions required looks like leadership.",
      leadershipImpact:
        "You set the frame before you enter the room.",
      projectId,
      relatedMemoryIds: [memory.id],
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  // Assumptions when information is thin
  if (content.length < 80) {
    assumptions.push(
      "Information is thin — recommendation quality will improve if you add who was involved, what changed, and what happens next.",
    );
  }
  if (!projectId) {
    assumptions.push(
      "No project linked — analysing generically. Link a project to connect this to release history and stakeholders.",
    );
  }
  if (
    /assume|probably|might|not sure|unclear|i think|seems/i.test(content)
  ) {
    assumptions.push(
      "Uncertainty language detected — Lume will treat unverified claims as assumptions until confirmed.",
    );
    recommendations.push({
      id: id("rec"),
      kind: "assumption",
      urgency: "watch",
      title: "Label and test the assumption",
      action:
        "Write the assumption explicitly and identify who can confirm or kill it this week.",
      why: "Hidden assumptions are how projects get surprised. Exceptional Programme Managers make them visible.",
      leadershipImpact:
        "You look rigorous and calm under uncertainty — not guessing silently.",
      projectId,
      relatedMemoryIds: [memory.id],
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  // Recurring issue pattern against memory
  if (projectId) {
    const related = state.memories.filter(
      (m) =>
        m.projectId === projectId &&
        m.tags.some((t) => memory.tags.includes(t)),
    );
    if (related.length >= 2) {
      insights.push(
        `This connects to ${related.length} prior memories on similar tags — possible recurring theme.`,
      );
      recommendations.push({
        id: id("rec"),
        kind: "leadership",
        urgency: "today",
        title: "Challenge the recurring theme with history",
        action: `Reference prior notes (${related
          .slice(0, 2)
          .map((m) => m.title)
          .join("; ")}) and ask for a dated plan — not another acknowledgement.`,
        why: "Recurring themes that only get acknowledged become release-blocking surprises.",
        leadershipImpact:
          "You use institutional memory as authority — you sound experienced, not reactive.",
        projectId,
        relatedMemoryIds: [memory.id, ...related.slice(0, 3).map((m) => m.id)],
        createdAt: new Date().toISOString(),
        status: "active",
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: id("rec"),
      kind: "conversation",
      urgency: "watch",
      title: "Decide the next leadership move",
      action:
        "Ask: if an exceptional Programme Manager read this note, what conversation, decision or update would they initiate next?",
      why: `Captured information should never sit idle. ${DAILY_PRINCIPLE}`,
      leadershipImpact:
        "You stay in motion — prepared and proactive rather than archival.",
      projectId,
      relatedMemoryIds: [memory.id],
      createdAt: new Date().toISOString(),
      status: "active",
    });
  }

  return { memory, insights, assumptions, recommendations };
}

/**
 * Re-scan the whole operational picture and surface proactive coaching.
 * Safe to run after every capture or on Today's Brief load.
 */
export function generateProactiveRecommendations(
  state: MissionState,
): Recommendation[] {
  const out: Recommendation[] = [];
  const existingKeys = new Set(
    state.recommendations
      .filter((r) => r.status === "active")
      .map((r) => `${r.kind}:${r.projectId}:${r.title}`),
  );

  const push = (rec: Omit<Recommendation, "id" | "createdAt" | "status">) => {
    const key = `${rec.kind}:${rec.projectId}:${rec.title}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    out.push({
      ...rec,
      id: id("rec"),
      createdAt: new Date().toISOString(),
      status: "active",
    });
  };

  for (const project of state.projects) {
    for (const stakeholder of project.stakeholders) {
      const silentDays = daysSince(stakeholder.lastContactAt);
      if (silentDays >= 14) {
        push({
          kind: "stakeholder_update",
          urgency: silentDays >= 21 ? "today" : "this_week",
          title: `Update ${stakeholder.name} (${stakeholder.role})`,
          action: `Send a concise stakeholder update to ${stakeholder.name} covering progress, risks and asks.`,
          why: `No contact for ~${Math.floor(silentDays)} days. Silence with sponsors creates room for surprise and eroded confidence.`,
          leadershipImpact:
            "You stay present in the sponsor relationship before they have to chase you.",
          projectId: project.id,
          suggestedScript: stakeholder.preferences?.[0]
            ? `Keep their preference in mind: ${stakeholder.preferences[0]}`
            : undefined,
        });
      }
    }
  }

  for (const release of state.releases) {
    const playbook = getPlaybookStage(release.currentStage);
    const blocked = release.stages.filter(
      (s) =>
        s.status === "at_risk" ||
        s.status === "blocked" ||
        (s.missingArtefacts && s.missingArtefacts.length > 0 && s.status === "current"),
    );
    for (const stage of blocked) {
      push({
        kind: "release",
        urgency: "today",
        title: `Unblock ${release.name}: ${stage.label}`,
        action: stage.missingArtefacts?.length
          ? `Close missing artefacts: ${stage.missingArtefacts.join(", ")}.`
          : `Address at-risk stage notes: ${stage.notes ?? stage.label}.`,
        why:
          playbook?.coachingFocus ??
          "Release milestones punish late scramble. Close gaps before governance forums.",
        leadershipImpact:
          "You walk into CAB and go-live looking prepared, not surprised.",
        projectId: release.projectId,
      });
    }
  }

  for (const meeting of state.meetings.filter((m) => m.phase === "upcoming")) {
    const hours =
      (new Date(meeting.startsAt).getTime() - Date.now()) / 3600000;
    if (hours >= 0 && hours <= 48) {
      push({
        kind: "meeting_prep",
        urgency: hours <= 24 ? "now" : "today",
        title: `Prepare to lead: ${meeting.title}`,
        action:
          "Review objectives, opening script, decisions to obtain, and the one leadership moment you will own in the room.",
        why: "Walking in prepared is how you lead the discussion instead of reacting to it.",
        leadershipImpact:
          "You sound like the confident person leading the project.",
        projectId: meeting.projectId,
      });
    }
  }

  // Recurring issues in memory
  const recurring = state.memories.filter((m) => m.type === "recurring_issue");
  for (const memory of recurring) {
    push({
      kind: "leadership",
      urgency: "today",
      title: `Challenge recurring issue: ${memory.title}`,
      action:
        "Take the pattern into your next conversation with evidence and ask for a dated plan.",
      why: memory.content.slice(0, 220),
      leadershipImpact:
        "You convert recurring noise into owned action before stakeholders notice the pattern.",
      projectId: memory.projectId,
      relatedMemoryIds: [memory.id],
    });
  }

  return out;
}

export function searchMemory(
  state: MissionState,
  query: string,
): MemoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...state.memories].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  return state.memories
    .map((m) => {
      const hay = [
        m.title,
        m.content,
        m.type,
        ...m.tags,
        ...(m.people ?? []),
      ]
        .join(" ")
        .toLowerCase();
      const score = tokens.reduce(
        (acc, t) => acc + (hay.includes(t) ? 1 : 0),
        0,
      );
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.m.occurredAt).getTime() - new Date(a.m.occurredAt).getTime(),
    )
    .map((x) => x.m);
}

export function answerMemoryQuestion(
  state: MissionState,
  question: string,
): { answer: string; memories: MemoryEntry[] } {
  const memories = searchMemory(state, question).slice(0, 5);
  if (memories.length === 0) {
    return {
      answer:
        "I do not have enough institutional memory to answer that yet. Capture the decision, meeting note or release history and I will remember it.",
      memories: [],
    };
  }

  const top = memories[0];
  return {
    answer: `From institutional memory: ${top.title}. ${top.content}`,
    memories,
  };
}

export function getUpcomingMeetingBrief(
  meeting: Meeting,
): { headline: string; focus: string } {
  const decision = meeting.prep.decisionsToObtain[0];
  const risk = meeting.prep.risksToDiscuss[0];
  return {
    headline: `Lead ${meeting.title} — obtain: ${decision ?? "clarity on next moves"}`,
    focus: risk
      ? `Watch for surprise on: ${risk}`
      : meeting.prep.openingScript,
  };
}

function deriveTitle(content: string) {
  const line = content.split(/\n/)[0]?.trim() ?? "Captured note";
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
}

function deriveTags(lower: string): string[] {
  const catalog = [
    "CAB",
    "release",
    "risk",
    "finance",
    "dependency",
    "build",
    "regression",
    "hypercare",
    "roadmap",
    "stakeholder",
    "decision",
    "blocker",
  ];
  return catalog.filter((t) => lower.includes(t.toLowerCase()));
}

function derivePeople(content: string, state: MissionState): string[] {
  const names = new Set<string>();
  for (const project of state.projects) {
    for (const s of project.stakeholders) {
      if (content.toLowerCase().includes(s.name.toLowerCase())) {
        names.add(s.name);
      }
      const first = s.name.split(" ")[0];
      if (first && content.toLowerCase().includes(first.toLowerCase())) {
        names.add(s.name);
      }
    }
  }
  return [...names];
}
