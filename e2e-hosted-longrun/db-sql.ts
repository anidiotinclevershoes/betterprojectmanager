/**
 * Optional live read-only SQL snapshot for long-run checkpoints.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * SELECT only. Never repair test truth.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalHashInput } from "./db-verify";
import { hashCanonicalSlice, LONGRUN_PRODUCTION_SUPABASE_REF } from "./db-verify";

export type SqlRow = {
  domain: string;
  id: string;
  title: string;
  extra: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
};

export type SqlSnapshot = {
  projectId: string;
  capturedAt: string;
  hash: string;
  counts: ReturnType<typeof countsFromHashInput>;
  slice: CanonicalHashInput;
  receipts: Array<{ entityType: string; entityId: string; operationId: string }>;
  responsibilityLike: number;
};

function countsFromHashInput(slice: CanonicalHashInput) {
  return {
    people: slice.people.length,
    todos: slice.todos.length,
    todosDone: slice.todos.filter((t) => t.done).length,
    risks: slice.risks.length,
    milestones: slice.milestones.length,
    knowledge: slice.knowledge.length,
    responsibilities: slice.responsibilities.length,
  };
}

export function hasReadOnlySqlCredentials(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  );
}

function readOnlyClient(): SupabaseClient {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Read-only SQL requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const ref = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];
  if (ref && ref !== LONGRUN_PRODUCTION_SUPABASE_REF) {
    throw new Error(`SQL credentials point at ${ref}, not production Lume ${LONGRUN_PRODUCTION_SUPABASE_REF}`);
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function fetchReadOnlySqlSnapshot(projectId: string): Promise<SqlSnapshot> {
  const client = readOnlyClient();
  const [project, people, todos, risks, milestones, knowledge, receipts] = await Promise.all([
    client.from("projects").select("id,name,code,workspace_id").eq("id", projectId).maybeSingle(),
    client.from("stakeholders").select("id,name").eq("project_id", projectId),
    client.from("todos").select("id,title,done,due_on").eq("project_id", projectId),
    client.from("risks").select("id,title,status").eq("project_id", projectId),
    client.from("milestones").select("id,label,start_on").eq("project_id", projectId),
    client
      .from("knowledge_items")
      .select("id,body,kind,section")
      .eq("project_id", projectId),
    client.from("capture_apply_receipts").select("entity_type,entity_id,operation_id").eq("project_id", projectId),
  ]);
  for (const res of [project, people, todos, risks, milestones, knowledge, receipts]) {
    if (res.error) throw new Error(res.error.message);
  }
  if (!project.data) throw new Error(`project ${projectId} not found`);
  const slice: CanonicalHashInput = {
    projectId: project.data.id,
    projectName: project.data.name,
    projectCode: project.data.code || "",
    people: (people.data || []).map((p) => ({ id: p.id, name: p.name })),
    todos: (todos.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      done: Boolean(t.done),
      dueAt: t.due_on || undefined,
    })),
    risks: (risks.data || []).map((r) => ({ id: r.id, title: r.title, status: r.status })),
    milestones: (milestones.data || []).map((m) => ({
      id: m.id,
      label: m.label,
      startAt: m.start_on || "",
    })),
    knowledge: (knowledge.data || []).map((k) => ({
      id: k.id,
      body: k.body,
      kind: k.kind || undefined,
    })),
    responsibilities: (knowledge.data || [])
      .filter((k) => k.kind === "responsibility")
      .map((k) => ({ personId: undefined, scope: k.body })),
  };
  return {
    projectId,
    capturedAt: new Date().toISOString(),
    hash: hashCanonicalSlice(slice),
    counts: countsFromHashInput(slice),
    slice,
    receipts: (receipts.data || []).map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      operationId: r.operation_id,
    })),
    responsibilityLike: slice.responsibilities.length,
  };
}
