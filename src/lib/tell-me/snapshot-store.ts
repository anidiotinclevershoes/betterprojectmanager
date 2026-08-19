/**
 * Optional Supabase persistence for Project Intelligence Snapshots.
 * Falls back silently when Supabase is unavailable (local/demo).
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ProjectIntelligenceSnapshot,
  TellMeSuggestedQuestion,
} from "@/lib/tell-me/types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function asQuestions(value: unknown): TellMeSuggestedQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      if (typeof r.question !== "string") return null;
      return {
        id: typeof r.id === "string" ? r.id : `q_${Math.random().toString(36).slice(2, 8)}`,
        question: r.question,
        reason: typeof r.reason === "string" ? r.reason : "",
        signals: asStringArray(r.signals),
      };
    })
    .filter((x): x is TellMeSuggestedQuestion => Boolean(x));
}

export async function loadSnapshotFromSupabase(
  projectId: string,
): Promise<ProjectIntelligenceSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("project_intelligence_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      workspaceId: data.workspace_id ? String(data.workspace_id) : null,
      projectId: String(data.project_id),
      summary: String(data.summary ?? ""),
      keyState: asStringArray(data.key_state),
      constraints: asStringArray(data.constraint_notes),
      majorRisks: asStringArray(data.major_risks),
      keyDependencies: asStringArray(data.key_dependencies),
      keyStakeholders: asStringArray(data.key_stakeholders),
      importantKnowledge: asStringArray(data.important_knowledge),
      significantDates: asStringArray(data.significant_dates),
      suggestedQuestions: asQuestions(data.suggested_questions),
      sourceRevision: String(data.source_revision ?? ""),
      createdAt: String(data.created_at ?? new Date().toISOString()),
      kind: data.kind === "ai_refresh" ? "ai_refresh" : "deterministic",
    };
  } catch {
    return null;
  }
}

export async function saveSnapshotToSupabase(
  snapshot: ProjectIntelligenceSnapshot,
  workspaceId: string,
): Promise<ProjectIntelligenceSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const row = {
      workspace_id: workspaceId,
      project_id: snapshot.projectId,
      summary: snapshot.summary,
      key_state: snapshot.keyState,
      constraint_notes: snapshot.constraints,
      major_risks: snapshot.majorRisks,
      key_dependencies: snapshot.keyDependencies,
      key_stakeholders: snapshot.keyStakeholders,
      important_knowledge: snapshot.importantKnowledge,
      significant_dates: snapshot.significantDates,
      suggested_questions: snapshot.suggestedQuestions,
      source_revision: snapshot.sourceRevision,
      kind: snapshot.kind,
      updated_at: new Date().toISOString(),
      created_at: snapshot.createdAt,
    };
    const { data, error } = await supabase
      .from("project_intelligence_snapshots")
      .upsert(row, { onConflict: "project_id" })
      .select("*")
      .maybeSingle();
    if (error || !data) return snapshot;
    return {
      ...snapshot,
      id: String(data.id),
      workspaceId,
    };
  } catch {
    return snapshot;
  }
}

export async function resolveWorkspaceIdForProject(
  projectId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", projectId)
      .maybeSingle();
    if (error || !data?.workspace_id) return null;
    return String(data.workspace_id);
  } catch {
    return null;
  }
}
