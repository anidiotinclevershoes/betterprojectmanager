/**
 * Local/demo repositories — preserve current prototype behaviour.
 * These do not talk to Supabase. MissionState / localStorage remains
 * the live UI source of truth via store.tsx.
 *
 * Methods throw "not wired" for remote-style IDs so accidental use
 * of LUME_PERSISTENCE=supabase without credentials fails loudly,
 * while structural verify can still import the local factory.
 */

import type {
  CaptureSessionRepository,
  HistoryRepository,
  KnowledgeRepository,
  LumeDataRepositories,
  ProjectRepository,
  RiskRepository,
  TodoRepository,
  WorkspaceRepository,
} from "@/lib/data/types";

function unsupported(op: string): never {
  throw new Error(
    `[local repository] ${op} is not available in local/demo mode. ` +
      `The live UI continues to use MissionState (localStorage) via store.tsx.`,
  );
}

const localWorkspaces: WorkspaceRepository = {
  async listForCurrentUser() {
    return [];
  },
  async createPersonal() {
    unsupported("createPersonal workspace");
  },
};

const localProjects: ProjectRepository = {
  async listByWorkspace() {
    return [];
  },
  async getById() {
    return null;
  },
  async create() {
    unsupported("create project");
  },
  async update() {
    unsupported("update project");
  },
  async delete() {
    unsupported("delete project");
  },
};

const localTodos: TodoRepository = {
  async listByProject() {
    return [];
  },
  async create() {
    unsupported("create todo");
  },
  async update() {
    unsupported("update todo");
  },
  async delete() {
    unsupported("delete todo");
  },
};

const localRisks: RiskRepository = {
  async listByProject() {
    return [];
  },
  async create() {
    unsupported("create risk");
  },
  async update() {
    unsupported("update risk");
  },
  async delete() {
    unsupported("delete risk");
  },
};

const localKnowledge: KnowledgeRepository = {
  async listByProject() {
    return [];
  },
  async create() {
    unsupported("create knowledge");
  },
  async delete() {
    unsupported("delete knowledge");
  },
};

const localCaptureSessions: CaptureSessionRepository = {
  async listByWorkspace() {
    return [];
  },
  async create() {
    unsupported("create capture session");
  },
  async getById() {
    return null;
  },
  async delete() {
    unsupported("delete capture session");
  },
};

const localHistory: HistoryRepository = {
  async listByWorkspace() {
    return [];
  },
  async create() {
    unsupported("create history event");
  },
  async getById() {
    return null;
  },
  async delete() {
    unsupported("delete history event");
  },
};

export function createLocalRepositories(): LumeDataRepositories {
  return {
    workspaces: localWorkspaces,
    projects: localProjects,
    todos: localTodos,
    risks: localRisks,
    knowledge: localKnowledge,
    captureSessions: localCaptureSessions,
    history: localHistory,
  };
}
