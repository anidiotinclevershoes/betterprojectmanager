/**
 * Load a user's workspace into MissionState shape (application cache).
 * Empty workspace → empty MissionState (zero-project onboarding). Never seeds ATLAS/HORIZON/RELOPS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import type {
  HistoryEvent,
  Meeting,
  MemoryEntry,
  MissionState,
  Project,
  ProjectKnowledge,
  Recommendation,
  Release,
  Stakeholder,
  TimelineItem,
  TodoItem,
} from "@/lib/types";
import { emptyKnowledge } from "@/lib/knowledge";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";

export type LoadedWorkspace = {
  workspaceId: string;
  userId: string;
  state: MissionState;
};

function emptyMissionState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    timeline: [],
    history: [],
    analysesThisMonth: 0,
  };
}

function dateToIsoDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // date columns come as YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00.000Z`;
  }
  return value;
}

function isoToDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMissionStateFromSupabase(
  client: SupabaseClient<any>,
): Promise<LoadedWorkspace> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  const { workspaceId } = await ensurePersonalWorkspace(client);

  const [
    projectsRes,
    stakeholdersRes,
    todosRes,
    risksRes,
    knowledgeRes,
    milestonesRes,
    memoriesRes,
    recommendationsRes,
    meetingsRes,
    releasesRes,
    historyRes,
  ] = await Promise.all([
    client
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    client.from("stakeholders").select("*").eq("workspace_id", workspaceId),
    client.from("todos").select("*").eq("workspace_id", workspaceId),
    client.from("risks").select("*").eq("workspace_id", workspaceId),
    client
      .from("knowledge_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    client.from("milestones").select("*").eq("workspace_id", workspaceId),
    client.from("memories").select("*").eq("workspace_id", workspaceId),
    client.from("recommendations").select("*").eq("workspace_id", workspaceId),
    client.from("meetings").select("*").eq("workspace_id", workspaceId),
    client.from("releases").select("*").eq("workspace_id", workspaceId),
    client
      .from("history_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  for (const res of [
    projectsRes,
    stakeholdersRes,
    todosRes,
    risksRes,
    knowledgeRes,
    milestonesRes,
    memoriesRes,
    recommendationsRes,
    meetingsRes,
    releasesRes,
    historyRes,
  ]) {
    if (res.error) {
      throw new Error(`[supabase] load workspace: ${res.error.message}`);
    }
  }

  const stakeholdersByProject = new Map<string, Stakeholder[]>();
  for (const row of stakeholdersRes.data ?? []) {
    const list = stakeholdersByProject.get(row.project_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      role: row.role || "Stakeholder",
      preferences: Array.isArray(row.preferences) ? row.preferences : [],
      concerns: Array.isArray(row.concerns) ? row.concerns : [],
      lastContactAt: row.last_contact_at ?? undefined,
    });
    stakeholdersByProject.set(row.project_id, list);
  }

  const projects: Project[] = (projectsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    summary: row.summary ?? "",
    status: row.status,
    kind: row.kind,
    currentFocus: row.current_focus ?? "",
    nextMilestone: row.next_milestone ?? undefined,
    nextMilestoneAt: dateToIsoDay(row.next_milestone_on),
    stakeholders: stakeholdersByProject.get(row.id) ?? [],
    releaseMonth: row.release_month ?? undefined,
    mergeDate: dateToIsoDay(row.merge_on),
    releaseDate: dateToIsoDay(row.release_on),
    isTemplate: row.is_template ?? false,
    clonedFromId: row.cloned_from_id ?? undefined,
  }));

  const todos: TodoItem[] = (todosRes.data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    detail: row.detail ?? undefined,
    done: Boolean(row.done),
    createdAt: row.created_at,
    dueAt: dateToIsoDay(row.due_on),
    kind: row.kind,
    waitingOn: row.waiting_on ?? undefined,
    sourceRecommendationId: row.source_recommendation_id ?? undefined,
  }));

  // Knowledge: fold bullets by project + section; risks table also folds into knowledge.risks
  const knowledgeMap = new Map<string, ProjectKnowledge>();
  for (const project of projects) {
    knowledgeMap.set(project.id, emptyKnowledge(project.id));
  }
  for (const row of knowledgeRes.data ?? []) {
    const current =
      knowledgeMap.get(row.project_id) ?? emptyKnowledge(row.project_id);
    const section = row.section as keyof ProjectKnowledge["sections"];
    if (section in current.sections) {
      const nextBodies = [...current.sections[section], row.body].slice(0, 24);
      const priorIds = current.sectionItemIds?.[section] ?? [];
      const nextIds = [...priorIds, row.id].slice(0, 24);
      current.sections[section] = nextBodies;
      current.sectionItemIds = {
        ...(current.sectionItemIds ?? {}),
        [section]: nextIds,
      };
      current.updatedAt = row.updated_at ?? current.updatedAt;
      // Slice 1 / 1A.1: restore structured overlay + stable ids for every row
      const kind = (row as { kind?: string | null }).kind;
      const epistemic = (row as { epistemic?: string | null }).epistemic;
      const lifecycle =
        (row as { lifecycle?: string }).lifecycle ?? "current";
      const meta = (row as { meta?: Record<string, unknown> }).meta;
      const provenance = (row as { provenance?: unknown }).provenance;
      current.structured = [
        ...(current.structured ?? []),
        {
          id: row.id,
          projectId: row.project_id,
          section: section as
            | "now"
            | "decisions"
            | "risks"
            | "people"
            | "openLoops",
          body: row.body,
          kind: (kind as import("@/lib/canonical-truth/types").CanonicalTruthKind) ||
            "fact",
          epistemic:
            (epistemic as import("@/lib/canonical-truth/types").EpistemicStatus) ||
            null,
          lifecycle: (lifecycle as
            | "current"
            | "superseded"
            | "historical") || "current",
          supersedesId:
            (row as { supersedes_id?: string | null }).supersedes_id ?? null,
          meta: (meta as CanonicalTruthItem["meta"]) ?? null,
          provenance: Array.isArray(provenance)
            ? (provenance as CanonicalTruthItem["provenance"])
            : null,
        },
      ];
      knowledgeMap.set(row.project_id, current);
    }
  }
  for (const row of risksRes.data ?? []) {
    if (row.status === "resolved" || row.status === "accepted") continue;
    const current =
      knowledgeMap.get(row.project_id) ?? emptyKnowledge(row.project_id);
    if (!current.sections.risks.includes(row.title)) {
      current.sections.risks = [...current.sections.risks, row.title].slice(
        0,
        24,
      );
      knowledgeMap.set(row.project_id, current);
    }
  }

  const timeline: TimelineItem[] = (milestonesRes.data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    type: row.type,
    startAt: dateToIsoDay(row.start_on) || row.created_at,
    endAt: dateToIsoDay(row.end_on),
    notes: row.notes ?? undefined,
    source: (row.source as TimelineItem["source"]) || "manual",
  }));

  const memories: MemoryEntry[] = (memoriesRes.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    projectId: row.project_id ?? undefined,
    title: row.title,
    content: row.content ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    people: Array.isArray(row.people) ? row.people : undefined,
    occurredAt: row.occurred_at ?? row.created_at,
    createdAt: row.created_at,
    source: row.source || "system",
  }));

  const recommendations: Recommendation[] = (recommendationsRes.data ?? []).map(
    (row) => ({
      id: row.id,
      kind: row.kind,
      urgency: row.urgency,
      title: row.title,
      action: row.action ?? row.title,
      why: row.why ?? "",
      leadershipImpact: row.leadership_impact ?? "",
      projectId: row.project_id ?? undefined,
      suggestedScript: row.suggested_script ?? undefined,
      createdAt: row.created_at,
      status: row.status,
    }),
  );

  const meetings: Meeting[] = (meetingsRes.data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    startsAt: row.starts_at,
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    phase: row.phase || "upcoming",
    prep: (row.prep as Meeting["prep"]) || {
      objectives: [],
      openingScript: "",
      talkingPoints: [],
      questionsToAsk: [],
      decisionsToObtain: [],
      risksToDiscuss: [],
      peopleToEngage: [],
      leadershipOpportunities: [],
      stakeholderConcerns: [],
      ownershipMoments: [],
    },
    duringPrompts: Array.isArray(row.during_prompts) ? row.during_prompts : [],
    debrief: row.debrief ?? undefined,
  }));

  const releases: Release[] = (releasesRes.data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    targetDate: row.target_on || row.created_at,
    currentStage: row.current_stage,
    stages: Array.isArray(row.stages) ? row.stages : [],
    risks: Array.isArray(row.risks) ? row.risks : [],
  }));

  const history: HistoryEvent[] = (historyRes.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail ?? undefined,
    projectId: row.project_id,
    createdAt: row.created_at,
    source: row.source ?? undefined,
  }));

  const state: MissionState = {
    ...emptyMissionState(),
    projects,
    todos,
    knowledge: Array.from(knowledgeMap.values()),
    timeline,
    memories,
    recommendations,
    meetings,
    releases,
    history,
  };

  return { workspaceId, userId: user.id, state };
}

export { emptyMissionState, isoToDateOnly, dateToIsoDay };
