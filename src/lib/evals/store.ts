/**
 * Persistence for immutable evaluation runs.
 * Prefer Supabase service-role table; fall back to local filesystem for DX.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";
import type { EvalCaseResult, EvalRunRecord } from "@/lib/evals/types";

const LOCAL_DIR = path.join(process.cwd(), ".data", "eval-runs");

function canUseSupabaseStore() {
  if (process.env.LUME_EVAL_FORCE_FILESTORE === "1") return false;
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

function rowToRun(row: Record<string, unknown>): EvalRunRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    label: String(row.label ?? ""),
    status: row.status as EvalRunRecord["status"],
    gitCommit: (row.git_commit as string) ?? null,
    lumeVersion: (row.lume_version as string) ?? null,
    fixtureVersion: String(row.fixture_version ?? ""),
    fixtureLabel: String(row.fixture_label ?? ""),
    lumeModel: (row.lume_model as string) ?? null,
    baselineModel: (row.baseline_model as string) ?? null,
    baselinePromptVersion: String(row.baseline_prompt_version ?? ""),
    createdByEmail: String(row.created_by_email ?? ""),
    notes: (row.notes as string) ?? null,
    worldFilter: (row.world_filter as string[] | null) ?? null,
    categoryFilter: (row.category_filter as EvalRunRecord["categoryFilter"]) ?? null,
    summary: row.summary as EvalRunRecord["summary"],
    cases: (row.cases as EvalCaseResult[]) ?? [],
  };
}

export async function insertEvalRun(run: EvalRunRecord): Promise<EvalRunRecord> {
  if (canUseSupabaseStore()) {
    const admin = createServiceSupabaseClient();
    const { data, error } = await admin
      .from("eval_runs")
      .insert({
        id: run.id,
        created_at: run.createdAt,
        label: run.label,
        status: run.status,
        git_commit: run.gitCommit,
        lume_version: run.lumeVersion,
        fixture_version: run.fixtureVersion,
        fixture_label: run.fixtureLabel,
        lume_model: run.lumeModel,
        baseline_model: run.baselineModel,
        baseline_prompt_version: run.baselinePromptVersion,
        created_by_email: run.createdByEmail,
        notes: run.notes,
        world_filter: run.worldFilter,
        category_filter: run.categoryFilter,
        summary: run.summary,
        cases: run.cases,
      })
      .select("*")
      .single();
    if (error) throw new Error(`[evals] insert failed: ${error.message}`);
    return rowToRun(data as Record<string, unknown>);
  }

  await ensureLocalDir();
  const file = path.join(LOCAL_DIR, `${run.id}.json`);
  await fs.writeFile(file, JSON.stringify(run, null, 2), "utf8");
  return run;
}

export async function updateEvalRun(run: EvalRunRecord): Promise<EvalRunRecord> {
  if (canUseSupabaseStore()) {
    const admin = createServiceSupabaseClient();
    const { data, error } = await admin
      .from("eval_runs")
      .update({
        label: run.label,
        status: run.status,
        notes: run.notes,
        summary: run.summary,
        cases: run.cases,
        lume_model: run.lumeModel,
        baseline_model: run.baselineModel,
      })
      .eq("id", run.id)
      .select("*")
      .single();
    if (error) throw new Error(`[evals] update failed: ${error.message}`);
    return rowToRun(data as Record<string, unknown>);
  }

  await ensureLocalDir();
  const file = path.join(LOCAL_DIR, `${run.id}.json`);
  await fs.writeFile(file, JSON.stringify(run, null, 2), "utf8");
  return run;
}

export async function getEvalRun(id: string): Promise<EvalRunRecord | null> {
  if (canUseSupabaseStore()) {
    const admin = createServiceSupabaseClient();
    const { data, error } = await admin
      .from("eval_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`[evals] get failed: ${error.message}`);
    if (!data) return null;
    return rowToRun(data as Record<string, unknown>);
  }

  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as EvalRunRecord;
  } catch {
    return null;
  }
}

export async function listEvalRuns(limit = 50): Promise<EvalRunRecord[]> {
  if (canUseSupabaseStore()) {
    const admin = createServiceSupabaseClient();
    const { data, error } = await admin
      .from("eval_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`[evals] list failed: ${error.message}`);
    return (data ?? []).map((row) => rowToRun(row as Record<string, unknown>));
  }

  try {
    await ensureLocalDir();
    const files = await fs.readdir(LOCAL_DIR);
    const runs: EvalRunRecord[] = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const raw = await fs.readFile(path.join(LOCAL_DIR, f), "utf8");
        runs.push(JSON.parse(raw) as EvalRunRecord);
      } catch {
        /* skip */
      }
    }
    return runs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function evalStoreBackend(): "supabase" | "filesystem" {
  return canUseSupabaseStore() ? "supabase" : "filesystem";
}
