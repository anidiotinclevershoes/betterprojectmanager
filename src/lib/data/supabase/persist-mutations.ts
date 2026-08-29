/**
 * Persist a built project bundle (and later mutations) to Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuiltProjectBundle } from "@/lib/create-project";
import type { CreateProjectInput } from "@/lib/create-project";
import { buildNewProject } from "@/lib/create-project";
import { isoToDateOnly } from "@/lib/data/supabase/load-mission-state";
import { requireUuid } from "@/lib/data/validate";
import type {
  HistoryEvent,
  MemoryEntry,
  ProjectRisk,
  Recommendation,
  TimelineItem,
  TodoItem,
} from "@/lib/types";
import { emptyKnowledge } from "@/lib/knowledge";

/** DB check on `risks.source` — do not invent values (D-006). */
export const LEGAL_RISK_SOURCES = ["manual", "capture", "seed"] as const;
export type LegalRiskSource = (typeof LEGAL_RISK_SOURCES)[number];

/**
 * New Project risks are human-reviewed setup, not Capture and not seed.
 * Map to the legal `manual` source rather than expanding the enum.
 */
export const NEW_PROJECT_RISK_SOURCE: LegalRiskSource = "manual";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Child tables whose `project_id` is ON DELETE SET NULL.
 * Deleting only the project row would orphan these in the workspace.
 * Compensating cleanup must delete them by this project id first.
 */
export const PROJECT_BUNDLE_SET_NULL_TABLES = [
  "todos",
  "memories",
  "recommendations",
  "history_events",
  "capture_sessions",
  "coach_sessions",
] as const;

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
  risks: ProjectRisk[];
};

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint/i.test(error.message ?? "");
}

function requireLegalRiskSource(source: string): LegalRiskSource {
  if ((LEGAL_RISK_SOURCES as readonly string[]).includes(source)) {
    return source as LegalRiskSource;
  }
  throw new Error(
    `[supabase] invalid risk source "${source}" (allowed: ${LEGAL_RISK_SOURCES.join(", ")})`,
  );
}

/**
 * Schema evidence (`20260812002748_workspace_schema.sql` + snapshots migration):
 * - CASCADE: stakeholders, risks, knowledge_items, milestones, meetings, releases,
 *   project_intelligence_snapshots
 * - SET NULL: todos, memories, recommendations, history_events, capture_sessions,
 *   coach_sessions
 * - projects.cloned_from_id SET NULL (deleting a template must not delete clones)
 *
 * Deleting only the `projects` row would orphan SET NULL children in the workspace.
 * Always remove those project-scoped rows first, then delete the project.
 * Workspace-wide rows (no matching project_id) are left alone.
 */
async function deleteProjectScopedBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
): Promise<void> {
  const errors: string[] = [];
  for (const table of PROJECT_BUNDLE_SET_NULL_TABLES) {
    const { error } = await client
      .from(table)
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId);
    if (error) {
      errors.push(`${table}: ${error.message}`);
      break;
    }
  }
  if (errors.length) {
    throw new Error(
      `[supabase] cleanup failed project ${projectId}: ${errors.join("; ")}`,
    );
  }
  const { error: projectError } = await client
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);
  if (projectError) {
    throw new Error(
      `[supabase] cleanup failed project ${projectId}: projects: ${projectError.message}`,
    );
  }
}

/**
 * Remove a project created by a failed New Project attempt.
 * Same SET NULL-then-project contract as user-facing delete; does not require
 * the project row to still exist (partial insert / retry).
 */
export async function cleanupFailedNewProjectBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
): Promise<void> {
  const scopedWorkspaceId = requireUuid(workspaceId, "workspaceId");
  const scopedProjectId = requireUuid(projectId, "projectId");
  await deleteProjectScopedBundle(client, scopedWorkspaceId, scopedProjectId);
}

/**
 * User-facing project deletion. One deliberate persistence path:
 * exact durable project UUID + authenticated workspace membership.
 * Never keyed by name, label, or client-only order.
 */
export async function persistProjectDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
): Promise<{ projectId: string; workspaceId: string }> {
  const scopedWorkspaceId = requireUuid(workspaceId, "workspaceId");
  const scopedProjectId = requireUuid(projectId, "projectId");

  const { data, error } = await client
    .from("projects")
    .select("id")
    .eq("id", scopedProjectId)
    .eq("workspace_id", scopedWorkspaceId)
    .maybeSingle();
  if (error) {
    throw new Error(`[supabase] delete project: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `[supabase] delete project: not found in this workspace`,
    );
  }

  await deleteProjectScopedBundle(client, scopedWorkspaceId, scopedProjectId);
  return { projectId: scopedProjectId, workspaceId: scopedWorkspaceId };
}

function mapTodoRows(rows: Array<Record<string, unknown>>): TodoItem[] {
  return rows.map((row) => ({
    id: String(row.id),
    projectId: (row.project_id as string | null) ?? undefined,
    title: String(row.title),
    detail: (row.detail as string | null) ?? undefined,
    done: Boolean(row.done),
    createdAt: String(row.created_at),
    dueAt: row.due_on ? `${row.due_on}T12:00:00.000Z` : undefined,
    kind: row.kind as TodoItem["kind"],
    waitingOn: (row.waiting_on as string | null) ?? undefined,
  }));
}

function mapRiskRows(rows: Array<Record<string, unknown>>): ProjectRisk[] {
  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    status: (row.status as ProjectRisk["status"]) || "open",
    source: requireLegalRiskSource(String(row.source || NEW_PROJECT_RISK_SOURCE)),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }));
}

function mapMilestoneRows(rows: Array<Record<string, unknown>>): TimelineItem[] {
  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    label: String(row.label),
    type: row.type as TimelineItem["type"],
    startAt: row.start_on
      ? `${row.start_on}T12:00:00.000Z`
      : String(row.created_at),
    endAt: row.end_on ? `${row.end_on}T12:00:00.000Z` : undefined,
    notes: (row.notes as string | null) ?? undefined,
    source: (row.source as TimelineItem["source"]) || "manual",
  }));
}

function mapRecommendationRows(
  rows: Array<Record<string, unknown>>,
): Recommendation[] {
  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as Recommendation["kind"],
    urgency: row.urgency as Recommendation["urgency"],
    title: String(row.title),
    action: (row.action as string | null) ?? String(row.title),
    why: (row.why as string | null) ?? "",
    leadershipImpact: (row.leadership_impact as string | null) ?? "",
    projectId: (row.project_id as string | null) ?? undefined,
    createdAt: String(row.created_at),
    status: row.status as Recommendation["status"],
  }));
}

async function loadExistingProjectBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
): Promise<PersistedProjectBundle | null> {
  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    throw new Error(`[supabase] load project: ${projectError.message}`);
  }
  if (!projectRow || projectRow.workspace_id !== workspaceId) return null;

  const [
    stakeholdersRes,
    todosRes,
    risksRes,
    knowledgeRes,
    milestonesRes,
    recommendationsRes,
    memoriesRes,
  ] = await Promise.all([
    client.from("stakeholders").select("*").eq("project_id", projectId),
    client.from("todos").select("*").eq("project_id", projectId),
    client.from("risks").select("*").eq("project_id", projectId),
    client.from("knowledge_items").select("*").eq("project_id", projectId),
    client.from("milestones").select("*").eq("project_id", projectId),
    client.from("recommendations").select("*").eq("project_id", projectId),
    client.from("memories").select("*").eq("project_id", projectId),
  ]);

  for (const res of [
    stakeholdersRes,
    todosRes,
    risksRes,
    knowledgeRes,
    milestonesRes,
    recommendationsRes,
    memoriesRes,
  ]) {
    if (res.error) {
      throw new Error(`[supabase] load project bundle: ${res.error.message}`);
    }
  }

  const stakeholders = (stakeholdersRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      role: String(row.role || "Stakeholder"),
      preferences: Array.isArray(row.preferences) ? row.preferences : [],
      concerns: Array.isArray(row.concerns) ? row.concerns : [],
    }),
  );

  const knowledge = emptyKnowledge(projectId);
  for (const row of knowledgeRes.data ?? []) {
    const section = row.section as keyof typeof knowledge.sections;
    if (section in knowledge.sections) {
      knowledge.sections[section] = [
        ...knowledge.sections[section],
        String(row.body),
      ];
    }
  }

  return {
    workspaceId,
    project: {
      id: projectId,
      name: String(projectRow.name),
      code: String(projectRow.code),
      summary: String(projectRow.summary ?? ""),
      status: projectRow.status,
      kind: projectRow.kind,
      currentFocus: String(projectRow.current_focus ?? ""),
      nextMilestone: projectRow.next_milestone ?? undefined,
      nextMilestoneAt: projectRow.next_milestone_on
        ? `${projectRow.next_milestone_on}T12:00:00.000Z`
        : undefined,
      stakeholders,
    },
    knowledge,
    recommendations: mapRecommendationRows(recommendationsRes.data ?? []),
    todos: mapTodoRows(todosRes.data ?? []),
    timeline: mapMilestoneRows(milestonesRes.data ?? []),
    risks: mapRiskRows(risksRes.data ?? []),
    ...(memoriesRes.data?.[0]
      ? {
          setupMemory: {
            id: String(memoriesRes.data[0].id),
            type: "conversation" as const,
            projectId,
            title: String(memoriesRes.data[0].title),
            content: String(memoriesRes.data[0].content ?? ""),
            tags: Array.isArray(memoriesRes.data[0].tags)
              ? memoriesRes.data[0].tags
              : [],
            people: Array.isArray(memoriesRes.data[0].people)
              ? memoriesRes.data[0].people
              : undefined,
            occurredAt:
              memoriesRes.data[0].occurred_at ?? memoriesRes.data[0].created_at,
            createdAt: String(memoriesRes.data[0].created_at),
            source: "capture" as const,
          } satisfies MemoryEntry,
        }
      : {}),
  } as PersistedProjectBundle & { setupMemory?: MemoryEntry };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistNewProject(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  input: CreateProjectInput,
): Promise<PersistedProjectBundle> {
  const local = buildNewProject(input);
  const requestedId =
    input.clientProjectId && UUID_RE.test(input.clientProjectId)
      ? input.clientProjectId
      : undefined;

  let projectId: string | null = null;
  let createdThisCall = false;

  try {
    const projectInsert: Record<string, unknown> = {
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
    };
    if (requestedId) projectInsert.id = requestedId;

    const { data: projectRow, error: projectError } = await client
      .from("projects")
      .insert(projectInsert)
      .select("id")
      .single();

    if (projectError && requestedId && isUniqueViolation(projectError)) {
      const existing = await loadExistingProjectBundle(
        client,
        workspaceId,
        requestedId,
      );
      if (existing) return existing;
      throw new Error(
        `[supabase] create project: duplicate id ${requestedId} is not in this workspace`,
      );
    }

    projectId = requireData(
      projectRow as { id: string } | null,
      projectError,
      "create project",
    ).id;
    createdThisCall = true;

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
      if (error) {
        throw new Error(`[supabase] create stakeholders: ${error.message}`);
      }
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
      const { data, error } = await client.from("todos").insert(todoInserts).select("*");
      if (error) throw new Error(`[supabase] create todos: ${error.message}`);
      todos = mapTodoRows(data ?? []);
    }

    const riskTitles = local.knowledge.sections.risks ?? [];
    let risks: ProjectRisk[] = [];
    if (riskTitles.length) {
      const riskSource = requireLegalRiskSource(NEW_PROJECT_RISK_SOURCE);
      const { data, error } = await client
        .from("risks")
        .insert(
          riskTitles.map((title) => ({
            workspace_id: workspaceId,
            project_id: projectId,
            title,
            status: "open",
            source: riskSource,
            created_by: userId,
          })),
        )
        .select("*");
      if (error) throw new Error(`[supabase] create risks: ${error.message}`);
      risks = mapRiskRows(data ?? []);
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
      timeline = mapMilestoneRows(data ?? []);
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
      recommendations = mapRecommendationRows(data ?? []);
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
        projectId,
        title: data.title,
        content: data.content ?? "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        people: Array.isArray(data.people) ? data.people : undefined,
        occurredAt: data.occurred_at ?? data.created_at,
        createdAt: data.created_at,
        source: "capture",
      };
    }

    // History is secondary evidence after authoritative success. Failure must
    // not roll back the project bundle or be recorded for a cleaned-up create.
    const { error: historyError } = await client.from("history_events").insert({
      workspace_id: workspaceId,
      project_id: projectId,
      type: "project_created",
      title: `Created ${local.project.name}`,
      detail: local.project.code,
      source: "user",
      created_by: userId,
    });
    if (historyError) {
      console.error(
        "[persistNewProject] history evidence skipped",
        historyError.message,
      );
    }

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
      risks,
      ...(setupMemory ? { setupMemory } : {}),
    } as PersistedProjectBundle & { setupMemory?: MemoryEntry };
  } catch (err) {
    if (createdThisCall && projectId) {
      try {
        await cleanupFailedNewProjectBundle(client, workspaceId, projectId);
      } catch (cleanupErr) {
        const origin = err instanceof Error ? err.message : String(err);
        const cleanup =
          cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        throw new Error(
          `${origin} (also failed to clean up partial project: ${cleanup})`,
        );
      }
    }
    throw err;
  }
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

/**
 * Every To Do UPDATE/DELETE is constrained to the intended workspace + current
 * project + todo id. `patch.projectId` is a SET destination only, never WHERE proof.
 */
function scopeExistingTodo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  workspaceId: string,
  projectId: string | null,
  todoId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
  const scoped = query.eq("id", todoId).eq("workspace_id", workspaceId);
  return projectId === null
    ? scoped.is("project_id", null)
    : scoped.eq("project_id", projectId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoUpdate(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string | null,
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
  const scopedWorkspaceId = requireUuid(workspaceId, "workspaceId");
  const scopedTodoId = requireUuid(todoId, "todoId");
  const scopedProjectId =
    projectId === null ? null : requireUuid(projectId, "projectId");

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.detail !== undefined) update.detail = patch.detail;
  if (patch.dueAt !== undefined) update.due_on = isoToDateOnly(patch.dueAt);
  if (patch.done !== undefined) update.done = patch.done;
  if (patch.projectId !== undefined) update.project_id = patch.projectId;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.waitingOn !== undefined) update.waiting_on = patch.waitingOn;
  if (!Object.keys(update).length) {
    throw new Error("[supabase] update todo: empty patch");
  }

  const { data, error } = await scopeExistingTodo(
    client.from("todos").update(update),
    scopedWorkspaceId,
    scopedProjectId,
    scopedTodoId,
  )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`[supabase] update todo: ${error.message}`);
  if (!data) {
    throw new Error("[supabase] update todo: not found in this project");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoDelete(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string | null,
  todoId: string,
): Promise<void> {
  const scopedWorkspaceId = requireUuid(workspaceId, "workspaceId");
  const scopedTodoId = requireUuid(todoId, "todoId");
  const scopedProjectId =
    projectId === null ? null : requireUuid(projectId, "projectId");

  const { data, error } = await scopeExistingTodo(
    client.from("todos").delete(),
    scopedWorkspaceId,
    scopedProjectId,
    scopedTodoId,
  )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`[supabase] delete todo: ${error.message}`);
  if (!data) {
    throw new Error("[supabase] delete todo: not found in this project");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistKnowledgeBullet(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  section: string,
  body: string,
  userId: string | null,
  meta?: {
    id?: string | null;
    kind?: string | null;
    epistemic?: string | null;
    lifecycle?: string | null;
    supersedesId?: string | null;
    meta?: Record<string, unknown> | null;
    provenance?: unknown[] | null;
    /** Stable risks.id when dual-writing a genuine Risk (Slice 1B). */
    riskId?: string | null;
    /** Optional Apply receipt written in the same transaction as the risk. */
    receipt?: CaptureApplyReceipt | null;
  },
): Promise<{ riskId?: string }> {
  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    project_id: projectId,
    section,
    body,
    position: 0,
    created_by: userId,
  };
  if (meta?.id) row.id = meta.id;
  if (meta?.kind != null) row.kind = meta.kind;
  if (meta?.epistemic != null) row.epistemic = meta.epistemic;
  if (meta?.lifecycle != null) row.lifecycle = meta.lifecycle;
  if (meta?.supersedesId != null) row.supersedes_id = meta.supersedesId;
  if (meta?.meta != null) row.meta = meta.meta;
  if (meta?.provenance != null) row.provenance = meta.provenance;

  const knowledgeId =
    meta?.id && UUID_RE.test(meta.id) ? meta.id : crypto.randomUUID();
  row.id = knowledgeId;

  if (section === "risks") {
    const riskId =
      meta?.riskId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        meta.riskId,
      )
        ? meta.riskId
        : crypto.randomUUID();
    const { data, error } = await client.rpc("persist_risk_with_knowledge", {
      p_workspace_id: workspaceId,
      p_project_id: projectId,
      p_knowledge: row,
      p_risk: {
        id: riskId,
        title: body,
        status: "open",
        source: "capture",
        created_by: userId,
      },
      p_receipt: meta?.receipt
        ? {
            operation_id: meta.receipt.operationId,
            entity_type: meta.receipt.entityType,
            entity_id: meta.receipt.entityId,
          }
        : null,
    });
    if (error) throw new Error(`[supabase] create risk: ${error.message}`);
    const returnedId =
      data && typeof data === "object" && data !== null && "risk_id" in data
        ? String((data as { risk_id: string }).risk_id)
        : riskId;
    return { riskId: returnedId };
  }

  const { error } = await client.from("knowledge_items").insert(row);
  if (error) throw new Error(`[supabase] create knowledge: ${error.message}`);

  return {};
}

/**
 * Slice 1B: update authoritative Risk lifecycle status.
 * Scoped by project + workspace to preserve tenant isolation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistRiskStatus(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  riskId: string,
  status: "open" | "watch" | "resolved" | "accepted",
): Promise<void> {
  const { error } = await client
    .from("risks")
    .update({ status })
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw new Error(`[supabase] update risk status: ${error.message}`);
  }
}

/**
 * Slice 1C: ensure a durable project-scoped Person (stakeholders row).
 * Inserts when missing; returns the durable UUID. Exact id preferred;
 * otherwise insert with provided/new UUID (caller must have deduped in memory).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistEnsureStakeholder(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  stakeholder: {
    id: string;
    name: string;
    role?: string;
  },
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: lookupError } = await client
    .from("stakeholders")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("id", stakeholder.id)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`[supabase] lookup stakeholder: ${lookupError.message}`);
  }
  if (existing?.id) {
    return { id: existing.id as string, created: false };
  }

  // Exact name match within project (no fuzzy merge)
  const { data: byName, error: nameError } = await client
    .from("stakeholders")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);
  if (nameError) {
    throw new Error(`[supabase] list stakeholders: ${nameError.message}`);
  }
  const needle = stakeholder.name.trim().toLowerCase();
  const nameHit = (byName ?? []).find(
    (row) => String(row.name).trim().toLowerCase() === needle,
  );
  if (nameHit?.id) {
    return { id: nameHit.id as string, created: false };
  }

  const { error: insertError } = await client.from("stakeholders").insert({
    id: stakeholder.id,
    workspace_id: workspaceId,
    project_id: projectId,
    name: stakeholder.name.trim(),
    role: stakeholder.role?.trim() || "Stakeholder",
  });
  if (insertError) {
    throw new Error(`[supabase] create stakeholder: ${insertError.message}`);
  }
  return { id: stakeholder.id, created: true };
}

/**
 * Compensation only — delete a stakeholder row this mutation just created.
 * Scoped to workspace + project + id. Never used as a user-facing Apply op.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDeleteStakeholder(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  stakeholderId: string,
): Promise<void> {
  const { error } = await client
    .from("stakeholders")
    .delete()
    .eq("id", stakeholderId)
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);
  if (error) {
    throw new Error(`[supabase] delete stakeholder: ${error.message}`);
  }
}

export type CaptureApplyReceipt = {
  operationId: string;
  entityType: string;
  entityId: string;
};

/**
 * Approved Capture create receipt. Same Review/Apply operation identity
 * replays to the same authoritative row. Not title uniqueness.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistFindCaptureApplyReceipt(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  operationId: string,
): Promise<CaptureApplyReceipt | null> {
  const key = operationId.trim();
  if (!key) return null;
  const { data, error } = await client
    .from("capture_apply_receipts")
    .select("operation_id, entity_type, entity_id")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("operation_id", key)
    .maybeSingle();
  if (error) {
    throw new Error(`[supabase] lookup capture apply receipt: ${error.message}`);
  }
  if (!data?.entity_id) return null;
  return {
    operationId: String(data.operation_id),
    entityType: String(data.entity_type),
    entityId: String(data.entity_id),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistPutCaptureApplyReceipt(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  receipt: CaptureApplyReceipt,
): Promise<void> {
  const { error } = await client.from("capture_apply_receipts").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    operation_id: receipt.operationId,
    entity_type: receipt.entityType,
    entity_id: receipt.entityId,
  });
  if (error) {
    if (isUniqueViolation(error)) return;
    throw new Error(`[supabase] create capture apply receipt: ${error.message}`);
  }
}

function receiptPayload(receipt: CaptureApplyReceipt) {
  return {
    operation_id: receipt.operationId,
    entity_type: receipt.entityType,
    entity_id: receipt.entityId,
  };
}

/**
 * Authoritative Todo create + Apply receipt in one transaction.
 * Order inside the transaction: truth row, then receipt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTodoCreateWithReceipt(
  client: SupabaseClient<any>,
  workspaceId: string,
  userId: string | null,
  todo: Omit<TodoItem, "id" | "createdAt"> & { createdAt?: string },
  receipt: CaptureApplyReceipt,
): Promise<TodoItem> {
  const { data, error } = await client.rpc("persist_todo_create_with_receipt", {
    p_workspace_id: workspaceId,
    p_project_id: todo.projectId ?? null,
    p_todo: {
      title: todo.title,
      detail: todo.detail ?? null,
      done: todo.done ?? false,
      due_on: isoToDateOnly(todo.dueAt),
      kind: todo.kind ?? "ACTION",
      waiting_on: todo.waitingOn ?? null,
      created_by: userId,
    },
    p_receipt: receiptPayload(receipt),
  });
  const row = requireData(data as Record<string, unknown> | null, error, "create todo");
  return {
    id: String(row.id),
    projectId: (row.project_id as string | null) ?? undefined,
    title: String(row.title),
    detail: (row.detail as string | null) ?? undefined,
    done: Boolean(row.done),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    dueAt: row.due_on ? `${row.due_on}T12:00:00.000Z` : undefined,
    kind: row.kind as TodoItem["kind"],
    waitingOn: (row.waiting_on as string | null) ?? undefined,
  };
}

/**
 * Authoritative milestone create + Apply receipt in one transaction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTimelineItemWithReceipt(
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
  receipt: CaptureApplyReceipt,
): Promise<TimelineItem> {
  const { data, error } = await client.rpc(
    "persist_milestone_create_with_receipt",
    {
      p_workspace_id: workspaceId,
      p_project_id: projectId,
      p_milestone: {
        label: item.label,
        type: item.type,
        start_on: isoToDateOnly(item.startAt),
        end_on: isoToDateOnly(item.endAt),
        notes: item.notes ?? null,
        source: item.source ?? "manual",
      },
      p_receipt: receiptPayload(receipt),
    },
  );
  const row = requireData(
    data as Record<string, unknown> | null,
    error,
    "create milestone",
  );
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    label: String(row.label),
    type: String(row.type),
    startAt: row.start_on ? `${row.start_on}T12:00:00.000Z` : String(row.created_at),
    endAt: row.end_on ? `${row.end_on}T12:00:00.000Z` : undefined,
    notes: (row.notes as string | null) ?? undefined,
    source: (row.source as string | null) || "manual",
  };
}

export type PersonResponsibilityBundle = {
  stakeholder: {
    id: string;
    name: string;
    role?: string;
  };
  supersedeIds?: string[];
  knowledge?: {
    id?: string | null;
    section?: string;
    body: string;
    createdBy?: string | null;
    kind?: string | null;
    epistemic?: string | null;
    lifecycle?: string | null;
    supersedesId?: string | null;
    meta?: Record<string, unknown> | null;
    provenance?: unknown[] | null;
  } | null;
};

/**
 * Person + optional responsibility knowledge in one transaction.
 * Lookup/insert of the stakeholder, optional lifecycle supersede, optional bullet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistPersonResponsibilityBundle(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  bundle: PersonResponsibilityBundle,
): Promise<{ personId: string; created: boolean }> {
  const { data, error } = await client.rpc("persist_person_responsibility", {
    p_workspace_id: workspaceId,
    p_project_id: projectId,
    p_stakeholder: {
      id: bundle.stakeholder.id,
      name: bundle.stakeholder.name,
      role: bundle.stakeholder.role,
    },
    p_supersede_ids: bundle.supersedeIds ?? [],
    p_knowledge: bundle.knowledge
      ? {
          id: bundle.knowledge.id ?? null,
          section: bundle.knowledge.section ?? "people",
          body: bundle.knowledge.body,
          created_by: bundle.knowledge.createdBy ?? null,
          kind: bundle.knowledge.kind ?? null,
          epistemic: bundle.knowledge.epistemic ?? null,
          lifecycle: bundle.knowledge.lifecycle ?? null,
          supersedes_id: bundle.knowledge.supersedesId ?? null,
          meta: bundle.knowledge.meta ?? {},
          provenance: bundle.knowledge.provenance ?? [],
        }
      : null,
  });
  const row = requireData(
    data as Record<string, unknown> | null,
    error,
    "persist person responsibility",
  );
  return {
    personId: String(row.person_id),
    created: Boolean(row.created),
  };
}

/**
 * Slice 1C: mark knowledge_items lifecycle (e.g. superseded responsibility).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistKnowledgeLifecycle(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  itemIds: string[],
  lifecycle: "current" | "superseded" | "historical",
): Promise<void> {
  if (!itemIds.length) return;
  const { error } = await client
    .from("knowledge_items")
    .update({ lifecycle })
    .in("id", itemIds)
    .eq("project_id", projectId)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw new Error(`[supabase] update knowledge lifecycle: ${error.message}`);
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

/**
 * Phase 3B: update an existing milestone/date in place.
 * Completing a milestone is not a column on this table — callers must fail closed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistTimelineUpdate(
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  patch: {
    label?: string;
    startAt?: string;
    endAt?: string;
    notes?: string;
  },
): Promise<TimelineItem> {
  const scopedProjectId = requireUuid(projectId, "projectId");
  const scopedMilestoneId = requireUuid(milestoneId, "milestoneId");
  const update: Record<string, unknown> = {};
  if (patch.label != null) update.label = patch.label;
  if (patch.startAt !== undefined) update.start_on = isoToDateOnly(patch.startAt);
  if (patch.endAt !== undefined) update.end_on = isoToDateOnly(patch.endAt);
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (!Object.keys(update).length) {
    throw new Error("[supabase] update milestone: empty patch");
  }
  const { data, error } = await client
    .from("milestones")
    .update(update)
    .eq("id", scopedMilestoneId)
    .eq("project_id", scopedProjectId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  const row = requireData(data, error, "update milestone");
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
