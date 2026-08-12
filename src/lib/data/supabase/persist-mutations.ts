/**
 * Persist a built project bundle (and later mutations) to Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuiltProjectBundle } from "@/lib/create-project";
import type { CreateProjectInput } from "@/lib/create-project";
import { buildNewProject } from "@/lib/create-project";
import { isoToDateOnly } from "@/lib/data/supabase/load-mission-state";
import type {
  HistoryEvent,
  MemoryEntry,
  Recommendation,
  TimelineItem,
  TodoItem,
} from "@/lib/types";

function requireData<T>(
  data: T | null | undefined,
  error: { message: string } | null,
  op: string,
): T {
  if (error) throw new Error(`[supabase] ${op}: ${error.message}`);
  if (data == null) throw new Error(`[supabase] ${op}: no data returned`);
  return data;
}

export type PersistedProjectBundle = BuiltProjectBundle & {
  workspaceId: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistNewProject(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  input: CreateProjectInput,
): Promise<PersistedProjectBundle> {
  // Build locally first for structure, then replace ids with Supabase UUIDs.
  const local = buildNewProject(input);

  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: local.project.name,
      code: local.project.code,
      summary: local.project.summary ?? "",
      status: local.project.status ?? "healthy",
      kind: local.project.kind ?? "delivery",
      current_focus: local.project.currentFocus ?? "",
      next_milestone: local.project.nextMilestone ?? null,
      next_milestone_on: isoToDateOnly(local.project.nextMilestoneAt),
      created_by: userId,
    })
    .select("id")
    .single();

  const projectId = requireData(
    projectRow as { id: string } | null,
    projectError,
    "create project",
  ).id;

  const stakeholderRows = local.project.stakeholders.map((s) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    name: s.name,
    role: s.role || "Stakeholder",
    preferences: s.preferences ?? [],
    concerns: s.concerns ?? [],
  }));

  let stakeholders = local.project.stakeholders;
  if (stakeholderRows.length) {
    const { data, error } = await client
      .from("stakeholders")
      .insert(stakeholderRows)
      .select("id, name, role, preferences, concerns");
    if (error) throw new Error(`[supabase] create stakeholders: ${error.message}`);
    stakeholders = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      preferences: Array.isArray(row.preferences) ? row.preferences : [],
      concerns: Array.isArray(row.concerns) ? row.concerns : [],
    }));
  }

  const todoInserts = local.todos.map((t) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    title: t.title,
    detail: t.detail ?? null,
    done: t.done,
    due_on: isoToDateOnly(t.dueAt),
    kind: t.kind ?? "ACTION",
    waiting_on: t.waitingOn ?? null,
    created_by: userId,
  }));

  let todos: TodoItem[] = [];
  if (todoInserts.length) {
    const { data, error } = await client
      .from("todos")
      .insert(todoInserts)
      .select("*");
    if (error) throw new Error(`[supabase] create todos: ${error.message}`);
    todos = (data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      detail: row.detail ?? undefined,
      done: Boolean(row.done),
      createdAt: row.created_at,
      dueAt: row.due_on ? `${row.due_on}T12:00:00.000Z` : undefined,
      kind: row.kind,
      waitingOn: row.waiting_on ?? undefined,
    }));
  }

  const riskTitles = local.knowledge.sections.risks ?? [];
  if (riskTitles.length) {
    const { error } = await client.from("risks").insert(
      riskTitles.map((title) => ({
        workspace_id: workspaceId,
        project_id: projectId,
        title,
        status: "open",
        source: "setup",
        created_by: userId,
      })),
    );
    if (error) throw new Error(`[supabase] create risks: ${error.message}`);
  }

  const knowledgeInserts: Array<{
    workspace_id: string;
    project_id: string;
    section: string;
    body: string;
    position: number;
    created_by: string | null;
  }> = [];
  let position = 0;
  for (const [section, bullets] of Object.entries(local.knowledge.sections)) {
    for (const body of bullets) {
      knowledgeInserts.push({
        workspace_id: workspaceId,
        project_id: projectId,
        section,
        body,
        position: position++,
        created_by: userId,
      });
    }
  }
  if (knowledgeInserts.length) {
    const { error } = await client.from("knowledge_items").insert(knowledgeInserts);
    if (error) throw new Error(`[supabase] create knowledge: ${error.message}`);
  }

  let timeline: TimelineItem[] = [];
  if (local.timeline.length) {
    const { data, error } = await client
      .from("milestones")
      .insert(
        local.timeline.map((t) => ({
          workspace_id: workspaceId,
          project_id: projectId,
          label: t.label,
          type: t.type,
          start_on: isoToDateOnly(t.startAt),
          end_on: isoToDateOnly(t.endAt),
          notes: t.notes ?? null,
          source: t.source ?? "manual",
        })),
      )
      .select("*");
    if (error) throw new Error(`[supabase] create milestones: ${error.message}`);
    timeline = (data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      label: row.label,
      type: row.type,
      startAt: row.start_on
        ? `${row.start_on}T12:00:00.000Z`
        : row.created_at,
      endAt: row.end_on ? `${row.end_on}T12:00:00.000Z` : undefined,
      notes: row.notes ?? undefined,
      source: row.source || "manual",
    }));
  }

  let recommendations: Recommendation[] = [];
  if (local.recommendations.length) {
    const { data, error } = await client
      .from("recommendations")
      .insert(
        local.recommendations.map((r) => ({
          workspace_id: workspaceId,
          project_id: projectId,
          kind: r.kind,
          urgency: r.urgency,
          title: r.title,
          action: r.action,
          why: r.why,
          leadership_impact: r.leadershipImpact,
          suggested_script: r.suggestedScript ?? null,
          status: r.status,
          created_by: userId,
        })),
      )
      .select("*");
    if (error) {
      throw new Error(`[supabase] create recommendations: ${error.message}`);
    }
    recommendations = (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      urgency: row.urgency,
      title: row.title,
      action: row.action ?? row.title,
      why: row.why ?? "",
      leadershipImpact: row.leadership_impact ?? "",
      projectId: row.project_id ?? undefined,
      createdAt: row.created_at,
      status: row.status,
    }));
  }

  let setupMemory: MemoryEntry | null = null;
  if (input.sourceNarrative?.trim()) {
    const { data, error } = await client
      .from("memories")
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        type: "conversation",
        title: `Project setup — ${local.project.code}`,
        content: input.sourceNarrative.trim(),
        tags: ["project-setup", input.sourceMode ?? "setup"],
        people: stakeholders.map((s) => s.name),
        source: "capture",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(`[supabase] create memory: ${error.message}`);
    setupMemory = {
      id: data.id,
      type: "conversation",
      projectId: projectId,
      title: data.title,
      content: data.content ?? "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      people: Array.isArray(data.people) ? data.people : undefined,
      occurredAt: data.occurred_at ?? data.created_at,
      createdAt: data.created_at,
      source: "capture",
    };
  }

  await client.from("history_events").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    type: "project_created",
    title: `Created ${local.project.name}`,
    detail: local.project.code,
    source: "user",
    created_by: userId,
  });

  return {
    workspaceId,
    project: {
      ...local.project,
      id: projectId,
      stakeholders,
    },
    knowledge: {
      ...local.knowledge,
      projectId,
    },
    recommendations,
    todos,
    timeline,
    ...(setupMemory ? { setupMemory } : {}),
  } as PersistedProjectBundle & { setupMemory?: MemoryEntry };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoCreate(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  todo: Omit<TodoItem, "id" | "createdAt"> & { createdAt?: string },
): Promise<TodoItem> {
  const { data, error } = await client
    .from("todos")
    .insert({
      workspace_id: workspaceId,
      project_id: todo.projectId ?? null,
      title: todo.title,
      detail: todo.detail ?? null,
      done: todo.done ?? false,
      due_on: isoToDateOnly(todo.dueAt),
      kind: todo.kind ?? "ACTION",
      waiting_on: todo.waitingOn ?? null,
      created_by: userId,
    })
    .select("*")
    .single();
  const row = requireData(data, error, "create todo");
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    detail: row.detail ?? undefined,
    done: Boolean(row.done),
    createdAt: row.created_at,
    dueAt: row.due_on ? `${row.due_on}T12:00:00.000Z` : undefined,
    kind: row.kind,
    waitingOn: row.waiting_on ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoUpdate(
  client: SupabaseClient<any>,
  todoId: string,
  patch: Partial<{
    title: string;
    detail: string | null;
    dueAt: string | null;
    done: boolean;
    projectId: string | null;
    kind: string | null;
    waitingOn: string | null;
  }>,
): Promise<void> {
  const { error } = await client
    .from("todos")
    .update({
      title: patch.title,
      detail: patch.detail,
      due_on: patch.dueAt === undefined ? undefined : isoToDateOnly(patch.dueAt),
      done: patch.done,
      project_id: patch.projectId,
      kind: patch.kind ?? undefined,
      waiting_on: patch.waitingOn,
    })
    .eq("id", todoId);
  if (error) throw new Error(`[supabase] update todo: ${error.message}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoDelete(
  client: SupabaseClient<any>,
  todoId: string,
): Promise<void> {
  const { error } = await client.from("todos").delete().eq("id", todoId);
  if (error) throw new Error(`[supabase] delete todo: ${error.message}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistKnowledgeBullet(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  section: string,
  body: string,
  userId: string | null,
): Promise<void> {
  const { error } = await client.from("knowledge_items").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    section,
    body,
    position: 0,
    created_by: userId,
  });
  if (error) throw new Error(`[supabase] create knowledge: ${error.message}`);

  if (section === "risks") {
    await client.from("risks").insert({
      workspace_id: workspaceId,
      project_id: projectId,
      title: body,
      status: "open",
      source: "capture",
      created_by: userId,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTimelineItem(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  item: {
    label: string;
    type: string;
    startAt: string;
    endAt?: string;
    notes?: string;
    source?: string;
  },
): Promise<TimelineItem> {
  const { data, error } = await client
    .from("milestones")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      label: item.label,
      type: item.type,
      start_on: isoToDateOnly(item.startAt),
      end_on: isoToDateOnly(item.endAt),
      notes: item.notes ?? null,
      source: item.source ?? "manual",
    })
    .select("*")
    .single();
  const row = requireData(data, error, "create milestone");
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    type: row.type,
    startAt: row.start_on ? `${row.start_on}T12:00:00.000Z` : row.created_at,
    endAt: row.end_on ? `${row.end_on}T12:00:00.000Z` : undefined,
    notes: row.notes ?? undefined,
    source: row.source || "manual",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistHistoryEvent(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  event: Omit<HistoryEvent, "id" | "createdAt"> & { createdAt?: string },
): Promise<void> {
  const { error } = await client.from("history_events").insert({
    workspace_id: workspaceId,
    project_id: event.projectId ?? null,
    type: event.type,
    title: event.title,
    detail: event.detail ?? null,
    source: event.source ?? "user",
    created_by: userId,
  });
  if (error) throw new Error(`[supabase] create history: ${error.message}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistCaptureSession(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  input: {
    projectId?: string | null;
    transcript: string;
    result?: unknown;
    suggestions?: unknown;
    status?: string;
  },
): Promise<string> {
  const { data, error } = await client
    .from("capture_sessions")
    .insert({
      workspace_id: workspaceId,
      project_id: input.projectId ?? null,
      transcript: input.transcript,
      result: input.result ?? null,
      suggestions: input.suggestions ?? [],
      status: input.status ?? "applied",
      analysed_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  return requireData(data as { id: string } | null, error, "create capture session")
    .id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistMemory(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  memory: Omit<MemoryEntry, "id"> & { id?: string },
): Promise<MemoryEntry> {
  const { data, error } = await client
    .from("memories")
    .insert({
      workspace_id: workspaceId,
      project_id: memory.projectId ?? null,
      type: memory.type,
      title: memory.title,
      content: memory.content,
      tags: memory.tags ?? [],
      people: memory.people ?? [],
      occurred_at: memory.occurredAt,
      source: memory.source,
      created_by: userId,
    })
    .select("*")
    .single();
  const row = requireData(data, error, "create memory");
  return {
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
  };
}
