import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireNonEmptyString,
  requireUuid,
} from "@/lib/data/validate";
import type {
  CaptureSessionRepository,
  CreateCaptureSessionInput,
  CreateHistoryEventInput,
  CreateKnowledgeInput,
  CreateProjectInput,
  CreateRiskInput,
  CreateTodoInput,
  HistoryRepository,
  KnowledgeRepository,
  LumeDataRepositories,
  ProjectRepository,
  RiskRepository,
  TodoRepository,
  WorkspaceRepository,
} from "@/lib/data/types";

/** Untyped client at the boundary — schema enforced by migrations + validate helpers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

function requireData<T>(
  data: T | null | undefined,
  error: { message: string } | null,
  op: string,
): T {
  if (error) throw new Error(`[supabase] ${op}: ${error.message}`);
  if (data == null) throw new Error(`[supabase] ${op}: no data returned`);
  return data;
}

export function createSupabaseRepositories(client: Client): LumeDataRepositories {
  const workspaces: WorkspaceRepository = {
    async listForCurrentUser() {
      const { data, error } = await client
        .from("workspace_members")
        .select("role, workspaces(id, name)");
      if (error) throw new Error(`[supabase] list workspaces: ${error.message}`);
      return (data ?? []).flatMap((row: {
        role: string;
        workspaces: { id: string; name: string } | { id: string; name: string }[] | null;
      }) => {
        const wsRaw = row.workspaces;
        const ws = Array.isArray(wsRaw) ? wsRaw[0] : wsRaw;
        if (!ws) return [];
        return [{ id: ws.id, name: ws.name, role: row.role }];
      });
    },
    async createPersonal(name: string) {
      const { data, error } = await client.rpc("create_workspace_with_owner", {
        p_name: name,
      });
      return String(requireData(data as string | null, error, "createPersonal"));
    },
  };

  const projects: ProjectRepository = {
    async listByWorkspace(workspaceId) {
      const { data, error } = await client
        .from("projects")
        .select("id, workspace_id, name, code, status")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`[supabase] list projects: ${error.message}`);
      return data ?? [];
    },
    async getById(projectId) {
      const { data, error } = await client
        .from("projects")
        .select("id, workspace_id, name, code")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new Error(`[supabase] get project: ${error.message}`);
      return data;
    },
    async create(input: CreateProjectInput) {
      const workspaceId = requireUuid(input.workspaceId, "workspaceId");
      const name = requireNonEmptyString(input.name, "name");
      const code = requireNonEmptyString(input.code, "code").toUpperCase();
      const { data, error } = await client
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name,
          code,
          summary: input.summary ?? "",
          status: input.status ?? "healthy",
          kind: input.kind ?? "delivery",
          current_focus: input.currentFocus ?? "",
          next_milestone: input.nextMilestone ?? null,
          next_milestone_on: input.nextMilestoneOn ?? null,
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create project").id;
    },
    async update(projectId, patch) {
      const { error } = await client
        .from("projects")
        .update({
          name: patch.name,
          code: patch.code,
          summary: patch.summary,
          status: patch.status,
          kind: patch.kind,
          current_focus: patch.currentFocus,
          next_milestone: patch.nextMilestone,
          next_milestone_on: patch.nextMilestoneOn,
        })
        .eq("id", projectId);
      if (error) throw new Error(`[supabase] update project: ${error.message}`);
    },
    async delete(projectId) {
      const { error } = await client.from("projects").delete().eq("id", projectId);
      if (error) throw new Error(`[supabase] delete project: ${error.message}`);
    },
  };

  const todos: TodoRepository = {
    async listByProject(projectId) {
      const { data, error } = await client
        .from("todos")
        .select("id, title")
        .eq("project_id", projectId);
      if (error) throw new Error(`[supabase] list todos: ${error.message}`);
      return data ?? [];
    },
    async create(input: CreateTodoInput) {
      const { data, error } = await client
        .from("todos")
        .insert({
          workspace_id: requireUuid(input.workspaceId, "workspaceId"),
          project_id: input.projectId ?? null,
          title: requireNonEmptyString(input.title, "title"),
          detail: input.detail ?? null,
          due_on: input.dueOn ?? null,
          kind: input.kind ?? "ACTION",
          waiting_on: input.waitingOn ?? null,
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create todo").id;
    },
    async update(todoId, patch) {
      const { error } = await client
        .from("todos")
        .update({
          project_id: patch.projectId,
          title: patch.title,
          detail: patch.detail,
          due_on: patch.dueOn,
          kind: patch.kind,
          waiting_on: patch.waitingOn,
        })
        .eq("id", todoId);
      if (error) throw new Error(`[supabase] update todo: ${error.message}`);
    },
    async delete(todoId) {
      const { error } = await client.from("todos").delete().eq("id", todoId);
      if (error) throw new Error(`[supabase] delete todo: ${error.message}`);
    },
  };

  const risks: RiskRepository = {
    async listByProject(projectId) {
      const { data, error } = await client
        .from("risks")
        .select("id, title")
        .eq("project_id", projectId);
      if (error) throw new Error(`[supabase] list risks: ${error.message}`);
      return data ?? [];
    },
    async create(input: CreateRiskInput) {
      const { data, error } = await client
        .from("risks")
        .insert({
          workspace_id: requireUuid(input.workspaceId, "workspaceId"),
          project_id: requireUuid(input.projectId, "projectId"),
          title: requireNonEmptyString(input.title, "title"),
          status: input.status ?? "open",
          source: input.source ?? "manual",
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create risk").id;
    },
    async update(riskId, patch) {
      const { error } = await client
        .from("risks")
        .update({
          project_id: patch.projectId,
          title: patch.title,
          status: patch.status,
          source: patch.source,
        })
        .eq("id", riskId);
      if (error) throw new Error(`[supabase] update risk: ${error.message}`);
    },
    async delete(riskId) {
      const { error } = await client.from("risks").delete().eq("id", riskId);
      if (error) throw new Error(`[supabase] delete risk: ${error.message}`);
    },
  };

  const knowledge: KnowledgeRepository = {
    async listByProject(projectId) {
      const { data, error } = await client
        .from("knowledge_items")
        .select("id, section, body")
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw new Error(`[supabase] list knowledge: ${error.message}`);
      return data ?? [];
    },
    async create(input: CreateKnowledgeInput) {
      const { data, error } = await client
        .from("knowledge_items")
        .insert({
          workspace_id: requireUuid(input.workspaceId, "workspaceId"),
          project_id: requireUuid(input.projectId, "projectId"),
          section: input.section,
          body: requireNonEmptyString(input.body, "body"),
          position: input.position ?? 0,
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create knowledge").id;
    },
    async delete(itemId) {
      const { error } = await client.from("knowledge_items").delete().eq("id", itemId);
      if (error) throw new Error(`[supabase] delete knowledge: ${error.message}`);
    },
  };

  const captureSessions: CaptureSessionRepository = {
    async listByWorkspace(workspaceId) {
      const { data, error } = await client
        .from("capture_sessions")
        .select("id")
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(`[supabase] list capture sessions: ${error.message}`);
      return data ?? [];
    },
    async create(input: CreateCaptureSessionInput) {
      const { data, error } = await client
        .from("capture_sessions")
        .insert({
          workspace_id: requireUuid(input.workspaceId, "workspaceId"),
          project_id: input.projectId ?? null,
          source: input.source ?? "typed",
          transcript: input.transcript ?? "",
          result: input.result ?? null,
          suggestions: input.suggestions ?? [],
          status: input.status ?? "open",
          analysed_at: input.analysedAt ?? null,
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create capture session").id;
    },
    async getById(id) {
      const { data, error } = await client
        .from("capture_sessions")
        .select("id, workspace_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`[supabase] get capture session: ${error.message}`);
      return data;
    },
    async delete(id) {
      const { error } = await client.from("capture_sessions").delete().eq("id", id);
      if (error) throw new Error(`[supabase] delete capture session: ${error.message}`);
    },
  };

  const history: HistoryRepository = {
    async listByWorkspace(workspaceId) {
      const { data, error } = await client
        .from("history_events")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`[supabase] list history: ${error.message}`);
      return data ?? [];
    },
    async create(input: CreateHistoryEventInput) {
      const { data, error } = await client
        .from("history_events")
        .insert({
          workspace_id: requireUuid(input.workspaceId, "workspaceId"),
          project_id: input.projectId ?? null,
          type: requireNonEmptyString(input.type, "type"),
          title: requireNonEmptyString(input.title, "title"),
          detail: input.detail ?? null,
          source: input.source ?? null,
          created_by: input.createdBy ?? null,
        })
        .select("id")
        .single();
      return requireData(data as { id: string } | null, error, "create history").id;
    },
    async getById(id) {
      const { data, error } = await client
        .from("history_events")
        .select("id, workspace_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`[supabase] get history: ${error.message}`);
      return data;
    },
    async delete(id) {
      const { error } = await client.from("history_events").delete().eq("id", id);
      if (error) throw new Error(`[supabase] delete history: ${error.message}`);
    },
  };

  return {
    workspaces,
    projects,
    todos,
    risks,
    knowledge,
    captureSessions,
    history,
  };
}
