/**
 * In-memory Supabase-shaped client for credential-free persistence tests.
 * Models the Phase 3A FK contract:
 * - CASCADE on project delete for stakeholders/risks/knowledge/milestones/meetings/releases
 * - SET NULL on project delete for todos/memories/recommendations/history/capture/coach
 */

export type FakeRow = Record<string, unknown>;

const CASCADE_ON_PROJECT_DELETE = [
  "stakeholders",
  "risks",
  "knowledge_items",
  "milestones",
  "meetings",
  "releases",
] as const;

const SET_NULL_ON_PROJECT_DELETE = [
  "todos",
  "memories",
  "recommendations",
  "history_events",
  "capture_sessions",
  "coach_sessions",
] as const;

export type FakeWorkspaceOptions = {
  workspaceId?: string;
  userId?: string;
  /** Succeed this many insert() operations, then fail the next insert. */
  failAfterInserts?: number;
  /** Fail the first insert into this table. */
  failOnTable?: string;
};

export class FakeWorkspaceClient {
  readonly workspaceId: string;
  readonly userId: string;
  readonly tables: Record<string, FakeRow[]>;
  insertCount = 0;
  private readonly failAfterInserts?: number;
  private readonly failOnTable?: string;

  constructor(options: FakeWorkspaceOptions = {}) {
    this.workspaceId = options.workspaceId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    this.userId = options.userId ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    this.failAfterInserts = options.failAfterInserts;
    this.failOnTable = options.failOnTable;
    this.tables = {
      projects: [],
      stakeholders: [],
      todos: [],
      risks: [],
      knowledge_items: [],
      milestones: [],
      memories: [],
      recommendations: [],
      meetings: [],
      releases: [],
      history_events: [],
      capture_sessions: [],
      coach_sessions: [],
      workspace_members: [
        {
          workspace_id: this.workspaceId,
          user_id: this.userId,
          role: "owner",
          workspaces: { id: this.workspaceId, name: "Personal Lume Workspace" },
        },
      ],
    };
  }

  auth = {
    getUser: async () => ({
      data: { user: { id: this.userId } },
      error: null,
    }),
  };

  from(table: string) {
    return new FakeQuery(this, table);
  }

  /** Used by the query builder — keep failure flags private to this class. */
  nextInsertFailure(table: string): string | null {
    if (this.failOnTable === table) return `injected failure on ${table}`;
    if (
      this.failAfterInserts !== undefined &&
      this.insertCount >= this.failAfterInserts
    ) {
      return `injected failure after ${this.insertCount} inserts`;
    }
    return null;
  }

  async rpc(fn: string) {
    if (fn === "ensure_personal_workspace") {
      return { data: this.workspaceId, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  }

  seedProject(row: FakeRow) {
    this.tables.projects.push({
      created_at: now(),
      updated_at: now(),
      ...row,
    });
  }

  countByProject(table: string, projectId: string) {
    return (this.tables[table] ?? []).filter(
      (row) => row.project_id === projectId || row.id === projectId,
    ).length;
  }

  rowsForProject(table: string, projectId: string) {
    return (this.tables[table] ?? []).filter(
      (row) => row.project_id === projectId,
    );
  }

  applyProjectDelete(projectIds: string[]) {
    for (const projectId of projectIds) {
      for (const table of CASCADE_ON_PROJECT_DELETE) {
        this.tables[table] = (this.tables[table] ?? []).filter(
          (row) => row.project_id !== projectId,
        );
      }
      for (const table of SET_NULL_ON_PROJECT_DELETE) {
        for (const row of this.tables[table] ?? []) {
          if (row.project_id === projectId) row.project_id = null;
        }
      }
    }
    this.tables.projects = this.tables.projects.filter(
      (row) => !projectIds.includes(String(row.id)),
    );
  }
}

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private insertRows: FakeRow[] | null = null;
  private deleting = false;
  private selecting = false;
  private singleMode = false;
  private maybeSingleMode = false;

  constructor(
    private readonly db: FakeWorkspaceClient,
    private readonly table: string,
  ) {}

  insert(row: FakeRow | FakeRow[]) {
    this.insertRows = Array.isArray(row) ? row : [row];
    return this;
  }

  select(_columns?: string) {
    this.selecting = true;
    return this;
  }

  delete() {
    this.deleting = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(_column: string, _opts?: { ascending: boolean }) {
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: FakeError | null }) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: FakeRow) {
    return this.filters.every((f) => row[f.column] === f.value);
  }

  private async execute(): Promise<{ data: unknown; error: FakeError | null }> {
    const tableRows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.insertRows) {
      const injected = this.db.nextInsertFailure(this.table);
      if (injected) {
        return {
          data: null,
          error: {
            message: injected,
            code: "PGRST",
          },
        };
      }

      const inserted: FakeRow[] = [];
      for (const raw of this.insertRows) {
        const id = (raw.id as string | undefined) ?? crypto.randomUUID();
        if (tableRows.some((row) => row.id === id)) {
          return {
            data: null,
            error: {
              message: `duplicate key value violates unique constraint on ${this.table}.id`,
              code: "23505",
            },
          };
        }
        const row: FakeRow = {
          created_at: now(),
          updated_at: now(),
          ...raw,
          id,
        };
        tableRows.push(row);
        inserted.push(row);
      }
      this.db.insertCount += 1;
      if (this.singleMode) {
        return { data: inserted[0] ?? null, error: null };
      }
      return { data: this.selecting ? inserted : inserted, error: null };
    }

    if (this.deleting) {
      const removing = tableRows.filter((row) => this.matches(row));
      if (this.table === "projects") {
        this.db.applyProjectDelete(removing.map((row) => String(row.id)));
      } else {
        this.db.tables[this.table] = tableRows.filter((row) => !this.matches(row));
      }
      return { data: null, error: null };
    }

    const matched = tableRows.filter((row) => this.matches(row));
    if (this.singleMode) {
      if (matched.length !== 1) {
        return {
          data: null,
          error: { message: `single() expected 1 row, got ${matched.length}` },
        };
      }
      return { data: matched[0], error: null };
    }
    if (this.maybeSingleMode) {
      return { data: matched[0] ?? null, error: null };
    }
    return { data: matched, error: null };
  }
}

type FakeError = { message: string; code?: string };

function now() {
  return new Date().toISOString();
}
