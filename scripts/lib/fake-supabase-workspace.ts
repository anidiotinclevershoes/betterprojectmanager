/**
 * In-memory Supabase-shaped client for credential-free persistence tests.
 * Models the Phase 3A/3A.1 FK contract:
 * - CASCADE on project delete for stakeholders/risks/knowledge/milestones/meetings/releases/snapshots
 * - SET NULL on project delete for todos/memories/recommendations/history/capture/coach
 * - projects.cloned_from_id SET NULL (clones survive)
 */

export type FakeRow = Record<string, unknown>;

const CASCADE_ON_PROJECT_DELETE = [
  "stakeholders",
  "risks",
  "knowledge_items",
  "milestones",
  "meetings",
  "releases",
  "project_intelligence_snapshots",
  "capture_apply_receipts",
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
  /** Fail delete() operations against this table. */
  failOnDeleteTable?: string;
};

export class FakeWorkspaceClient {
  readonly workspaceId: string;
  readonly userId: string;
  readonly tables: Record<string, FakeRow[]>;
  insertCount = 0;
  private readonly failAfterInserts?: number;
  private failOnTable?: string;
  private readonly failOnDeleteTable?: string;

  constructor(options: FakeWorkspaceOptions = {}) {
    this.workspaceId = options.workspaceId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    this.userId = options.userId ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    this.failAfterInserts = options.failAfterInserts;
    this.failOnTable = options.failOnTable;
    this.failOnDeleteTable = options.failOnDeleteTable;
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
      project_intelligence_snapshots: [],
      capture_apply_receipts: [],
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

  /** Test-only: fail the next insert() into this table. Does not change production. */
  armFailOnTable(table: string | undefined) {
    this.failOnTable = table;
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

  nextDeleteFailure(table: string): string | null {
    if (this.failOnDeleteTable === table) {
      return `injected delete failure on ${table}`;
    }
    return null;
  }

  async rpc(fn: string, args: Record<string, unknown> = {}) {
    if (fn === "ensure_personal_workspace") {
      return { data: this.workspaceId, error: null };
    }
    if (fn === "persist_risk_with_knowledge") {
      return this.runAtomic(async () => {
        const knowledge = asRow(args.p_knowledge);
        const risk = asRow(args.p_risk);
        const receipt = args.p_receipt ? asRow(args.p_receipt) : null;
        const k = await this.from("knowledge_items").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          ...knowledge,
        });
        if (k.error) throw new FakeRpcError(k.error.message, k.error.code);
        const r = await this.from("risks").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          ...risk,
        });
        if (r.error) throw new FakeRpcError(r.error.message, r.error.code);
        const riskId = String(
          (Array.isArray(r.data) ? r.data[0]?.id : (r.data as FakeRow | null)?.id) ??
            risk.id,
        );
        if (receipt) {
          const rec = await this.from("capture_apply_receipts").insert({
            workspace_id: args.p_workspace_id,
            project_id: args.p_project_id,
            operation_id: receipt.operation_id,
            entity_type: receipt.entity_type ?? "risk",
            entity_id: receipt.entity_id || riskId,
          });
          if (rec.error) throw new FakeRpcError(rec.error.message, rec.error.code);
        }
        return { knowledge_id: knowledge.id, risk_id: riskId };
      });
    }
    if (fn === "persist_todo_create_with_receipt") {
      return this.runAtomic(async () => {
        const todo = asRow(args.p_todo);
        const receipt = asRow(args.p_receipt);
        const inserted = await this.from("todos").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          ...todo,
        }).select("*").single();
        if (inserted.error) {
          throw new FakeRpcError(inserted.error.message, inserted.error.code);
        }
        const row = inserted.data as FakeRow;
        const rec = await this.from("capture_apply_receipts").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          operation_id: receipt.operation_id,
          entity_type: receipt.entity_type ?? "todo",
          entity_id: receipt.entity_id || row.id,
        });
        if (rec.error) throw new FakeRpcError(rec.error.message, rec.error.code);
        return row;
      });
    }
    if (fn === "persist_milestone_create_with_receipt") {
      return this.runAtomic(async () => {
        const milestone = asRow(args.p_milestone);
        const receipt = asRow(args.p_receipt);
        const inserted = await this.from("milestones").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          ...milestone,
        }).select("*").single();
        if (inserted.error) {
          throw new FakeRpcError(inserted.error.message, inserted.error.code);
        }
        const row = inserted.data as FakeRow;
        const rec = await this.from("capture_apply_receipts").insert({
          workspace_id: args.p_workspace_id,
          project_id: args.p_project_id,
          operation_id: receipt.operation_id,
          entity_type: receipt.entity_type ?? "milestone",
          entity_id: receipt.entity_id || row.id,
        });
        if (rec.error) throw new FakeRpcError(rec.error.message, rec.error.code);
        return row;
      });
    }
    if (fn === "persist_person_responsibility") {
      return this.runAtomic(async () => {
        const stakeholder = asRow(args.p_stakeholder);
        const knowledge = args.p_knowledge ? asRow(args.p_knowledge) : null;
        const supersedeIds = Array.isArray(args.p_supersede_ids)
          ? args.p_supersede_ids.map(String)
          : [];
        const name = String(stakeholder.name ?? "").trim();
        const wantedId = String(stakeholder.id ?? "");
        const people = this.tables.stakeholders.filter(
          (row) =>
            row.workspace_id === args.p_workspace_id &&
            row.project_id === args.p_project_id,
        );
        const byId = people.find((row) => row.id === wantedId);
        const byName = people.find(
          (row) => String(row.name).trim().toLowerCase() === name.toLowerCase(),
        );
        let personId = String(byId?.id ?? byName?.id ?? wantedId);
        let created = false;
        if (!byId && !byName) {
          const inserted = await this.from("stakeholders").insert({
            id: wantedId,
            workspace_id: args.p_workspace_id,
            project_id: args.p_project_id,
            name,
            role: String(stakeholder.role ?? "").trim() || "Stakeholder",
          });
          if (inserted.error) {
            throw new FakeRpcError(inserted.error.message, inserted.error.code);
          }
          created = true;
          personId = wantedId;
        }
        if (supersedeIds.length) {
          const updated = await this.from("knowledge_items")
            .update({ lifecycle: "superseded" })
            .in("id", supersedeIds)
            .eq("workspace_id", args.p_workspace_id)
            .eq("project_id", args.p_project_id);
          if (updated.error) {
            throw new FakeRpcError(updated.error.message, updated.error.code);
          }
        }
        let knowledgeId: string | undefined;
        if (knowledge) {
          const inserted = await this.from("knowledge_items").insert({
            workspace_id: args.p_workspace_id,
            project_id: args.p_project_id,
            ...knowledge,
          });
          if (inserted.error) {
            throw new FakeRpcError(inserted.error.message, inserted.error.code);
          }
          knowledgeId = String(knowledge.id ?? "");
        }
        return { person_id: personId, created, knowledge_id: knowledgeId };
      });
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  }

  private async runAtomic<T>(
    work: () => Promise<T>,
  ): Promise<{ data: T | null; error: FakeError | null }> {
    const snapshot = structuredClone(this.tables);
    try {
      const data = await work();
      return { data, error: null };
    } catch (err) {
      this.replaceTables(snapshot);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof FakeRpcError ? err.code : "PGRST";
      return { data: null, error: { message, code } };
    }
  }

  private replaceTables(snapshot: Record<string, FakeRow[]>) {
    for (const key of Object.keys(this.tables)) {
      const next = snapshot[key] ?? [];
      this.tables[key].splice(0, this.tables[key].length, ...structuredClone(next));
    }
    for (const key of Object.keys(snapshot)) {
      if (!this.tables[key]) {
        this.tables[key] = structuredClone(snapshot[key] ?? []);
      }
    }
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
    for (const row of this.tables.projects) {
      if (row.cloned_from_id && projectIds.includes(String(row.cloned_from_id))) {
        row.cloned_from_id = null;
      }
    }
  }
}

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private nullFilters: string[] = [];
  private insertRows: FakeRow[] | null = null;
  private updatePatch: FakeRow | null = null;
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

  update(patch: FakeRow) {
    this.updatePatch = patch;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    if (value === null) {
      this.nullFilters.push(column);
      return this;
    }
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
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
    return (
      this.filters.every((f) => row[f.column] === f.value) &&
      this.inFilters.every((f) => f.values.includes(row[f.column])) &&
      this.nullFilters.every((column) => row[column] == null)
    );
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
        if (this.table === "capture_apply_receipts") {
          const duplicate = tableRows.some(
            (row) =>
              row.workspace_id === raw.workspace_id &&
              row.project_id === raw.project_id &&
              row.operation_id === raw.operation_id,
          );
          if (duplicate) {
            return {
              data: null,
              error: {
                message:
                  "duplicate key value violates unique constraint on capture_apply_receipts (workspace_id, project_id, operation_id)",
                code: "23505",
              },
            };
          }
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
      const injected = this.db.nextDeleteFailure(this.table);
      if (injected) {
        return {
          data: null,
          error: { message: injected, code: "PGRST" },
        };
      }
      const removing = tableRows.filter((row) => this.matches(row));
      if (this.table === "projects") {
        this.db.applyProjectDelete(removing.map((row) => String(row.id)));
      } else {
        this.db.tables[this.table] = tableRows.filter((row) => !this.matches(row));
      }
      if (this.singleMode) {
        if (removing.length !== 1) {
          return {
            data: null,
            error: { message: `single() expected 1 row, got ${removing.length}` },
          };
        }
        return { data: removing[0], error: null };
      }
      if (this.maybeSingleMode) {
        return { data: removing[0] ?? null, error: null };
      }
      return { data: this.selecting ? removing : null, error: null };
    }

    if (this.updatePatch) {
      const matched = tableRows.filter((row) => this.matches(row));
      for (const row of matched) {
        for (const [key, value] of Object.entries(this.updatePatch)) {
          if (value !== undefined) row[key] = value;
        }
        row.updated_at = now();
      }
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
      return { data: this.selecting ? matched : matched, error: null };
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

class FakeRpcError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "FakeRpcError";
  }
}

function asRow(value: unknown): FakeRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as FakeRow;
}

function now() {
  return new Date().toISOString();
}
