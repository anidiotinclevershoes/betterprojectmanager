/**
 * Lume persistence repository boundary.
 *
 * UI / Capture continue to use MissionState via store.tsx today.
 * These interfaces define the controlled path toward Supabase.
 */

import type {
  KnowledgeSection,
  ProjectKind,
  ProjectStatus,
  RiskStatus,
  TodoKind,
} from "@/types/database";

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  code: string;
  summary?: string;
  status?: ProjectStatus;
  kind?: ProjectKind;
  currentFocus?: string;
  nextMilestone?: string | null;
  nextMilestoneOn?: string | null;
  createdBy?: string | null;
};

export type CreateTodoInput = {
  workspaceId: string;
  projectId?: string | null;
  title: string;
  detail?: string | null;
  dueOn?: string | null;
  kind?: TodoKind;
  waitingOn?: string | null;
  createdBy?: string | null;
};

export type CreateRiskInput = {
  workspaceId: string;
  projectId: string;
  title: string;
  status?: RiskStatus;
  source?: string;
  createdBy?: string | null;
};

export type CreateKnowledgeInput = {
  workspaceId: string;
  projectId: string;
  section: KnowledgeSection;
  body: string;
  position?: number;
  createdBy?: string | null;
};

export type CreateCaptureSessionInput = {
  workspaceId: string;
  projectId?: string | null;
  source?: string;
  transcript: string;
  result?: unknown;
  suggestions?: unknown;
  status?: string;
  analysedAt?: string | null;
  createdBy?: string | null;
};

export type CreateHistoryEventInput = {
  workspaceId: string;
  projectId?: string | null;
  type: string;
  title: string;
  detail?: string | null;
  source?: string | null;
  createdBy?: string | null;
};

export interface WorkspaceRepository {
  listForCurrentUser(): Promise<
    Array<{ id: string; name: string; role: string }>
  >;
  createPersonal(name: string): Promise<string>;
}

export interface ProjectRepository {
  listByWorkspace(workspaceId: string): Promise<
    Array<{
      id: string;
      workspace_id: string;
      name: string;
      code: string;
      status: string;
    }>
  >;
  getById(projectId: string): Promise<{
    id: string;
    workspace_id: string;
    name: string;
    code: string;
  } | null>;
  create(input: CreateProjectInput): Promise<string>;
  update(
    projectId: string,
    patch: Partial<Omit<CreateProjectInput, "workspaceId" | "createdBy">>,
  ): Promise<void>;
  delete(projectId: string): Promise<void>;
}

export interface TodoRepository {
  listByProject(projectId: string): Promise<Array<{ id: string; title: string }>>;
  create(input: CreateTodoInput): Promise<string>;
  update(
    todoId: string,
    patch: Partial<Omit<CreateTodoInput, "workspaceId" | "createdBy">>,
  ): Promise<void>;
  delete(todoId: string): Promise<void>;
}

export interface RiskRepository {
  listByProject(projectId: string): Promise<Array<{ id: string; title: string }>>;
  create(input: CreateRiskInput): Promise<string>;
  update(
    riskId: string,
    patch: Partial<Omit<CreateRiskInput, "workspaceId" | "createdBy">>,
  ): Promise<void>;
  delete(riskId: string): Promise<void>;
}

export interface KnowledgeRepository {
  listByProject(projectId: string): Promise<
    Array<{ id: string; section: string; body: string }>
  >;
  create(input: CreateKnowledgeInput): Promise<string>;
  delete(itemId: string): Promise<void>;
}

export interface CaptureSessionRepository {
  listByWorkspace(workspaceId: string): Promise<Array<{ id: string }>>;
  create(input: CreateCaptureSessionInput): Promise<string>;
  getById(id: string): Promise<{ id: string; workspace_id: string } | null>;
  delete(id: string): Promise<void>;
}

export interface HistoryRepository {
  listByWorkspace(workspaceId: string): Promise<Array<{ id: string; title: string }>>;
  create(input: CreateHistoryEventInput): Promise<string>;
  getById(id: string): Promise<{ id: string; workspace_id: string } | null>;
  delete(id: string): Promise<void>;
}

export type LumeDataRepositories = {
  workspaces: WorkspaceRepository;
  projects: ProjectRepository;
  todos: TodoRepository;
  risks: RiskRepository;
  knowledge: KnowledgeRepository;
  captureSessions: CaptureSessionRepository;
  history: HistoryRepository;
};
