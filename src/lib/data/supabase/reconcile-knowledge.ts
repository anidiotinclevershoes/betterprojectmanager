/**
 * Slice 1A: reconcile MissionState Knowledge sections → knowledge_items rows.
 *
 * Pure plan + Supabase apply. Prefer UPDATE over wipe/recreate.
 * Does not touch the risks table (out of scope for Slice 1A).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";

export const KNOWLEDGE_SECTION_IDS: KnowledgeSectionId[] = [
  "now",
  "decisions",
  "risks",
  "people",
  "openLoops",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isKnowledgeUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export type KnowledgeItemRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  section: string;
  body: string;
  position: number;
  kind?: string | null;
  epistemic?: string | null;
  lifecycle?: string | null;
  supersedes_id?: string | null;
  meta?: Record<string, unknown> | null;
  provenance?: unknown;
  created_by?: string | null;
};

export type KnowledgeReconcileUpdate = {
  id: string;
  body: string;
  position: number;
  provenance: unknown[];
};

export type KnowledgeReconcileInsert = {
  id: string;
  section: KnowledgeSectionId;
  body: string;
  position: number;
  kind: string | null;
  epistemic: string | null;
  lifecycle: string;
  supersedes_id: string | null;
  meta: Record<string, unknown>;
  provenance: unknown[];
};

export type KnowledgeReconcilePlan = {
  projectId: string;
  sections: KnowledgeSectionId[];
  updates: KnowledgeReconcileUpdate[];
  inserts: KnowledgeReconcileInsert[];
  deleteIds: string[];
};

function asProvenanceArray(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : [];
}

function appendManualEditProvenance(
  existing: unknown,
  note: string,
  at: string,
): unknown[] {
  const next = asProvenanceArray(existing);
  next.push({
    type: "manual_edit",
    at,
    note,
  });
  return next;
}

/**
 * Remap structured overlay when section string bodies change.
 * Prefer same-index mapping within a section so edits keep identity/metadata.
 */
export function remapStructuredForSections(
  previous: ProjectKnowledge | undefined,
  nextSections: ProjectKnowledge["sections"],
  sectionsToRemap: KnowledgeSectionId[] = KNOWLEDGE_SECTION_IDS,
): CanonicalTruthItem[] | undefined {
  if (!previous?.structured?.length) {
    return previous?.structured;
  }

  const used = new Set<string>();
  const result: CanonicalTruthItem[] = [];
  const remapSet = new Set(sectionsToRemap);

  for (const sectionId of KNOWLEDGE_SECTION_IDS) {
    if (!remapSet.has(sectionId)) {
      for (const item of previous.structured) {
        if (item.section === sectionId && !used.has(item.id)) {
          used.add(item.id);
          result.push(item);
        }
      }
      continue;
    }

    const oldBullets = previous.sections[sectionId] ?? [];
    const newBullets = nextSections[sectionId] ?? [];

    for (let i = 0; i < newBullets.length; i++) {
      const newBody = newBullets[i]!;
      const oldBody = oldBullets[i];

      if (oldBody != null) {
        const byIndex = previous.structured.find(
          (s) =>
            s.section === sectionId &&
            s.body === oldBody &&
            !used.has(s.id),
        );
        if (byIndex) {
          used.add(byIndex.id);
          result.push({ ...byIndex, body: newBody });
          continue;
        }
      }

      const byBody = previous.structured.find(
        (s) =>
          s.section === sectionId &&
          s.body === newBody &&
          !used.has(s.id),
      );
      if (byBody) {
        used.add(byBody.id);
        result.push(byBody);
      }
    }
  }

  // Retain superseded/historical items not present in current section strings.
  for (const item of previous.structured) {
    if (used.has(item.id)) continue;
    if (item.lifecycle === "superseded" || item.lifecycle === "historical") {
      result.push(item);
    }
  }

  return result;
}

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes in tests
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a reconcile plan for one or more Knowledge sections.
 *
 * Matching order within each section:
 * 1. Exact body match to an unmatched existing row
 * 2. Structured UUID hint for the desired bullet (when available)
 * 3. Positional match among remaining rows (in-place edit)
 * 4. Insert leftovers; delete unmatched existing rows in those sections only
 */
export function planKnowledgeReconcile(args: {
  projectId: string;
  workspaceId: string;
  desired: ProjectKnowledge;
  existingRows: KnowledgeItemRow[];
  sections?: KnowledgeSectionId[];
  userId?: string | null;
  at?: string;
}): KnowledgeReconcilePlan {
  const sections = args.sections ?? KNOWLEDGE_SECTION_IDS;
  const at = args.at ?? new Date().toISOString();
  const updates: KnowledgeReconcileUpdate[] = [];
  const inserts: KnowledgeReconcileInsert[] = [];
  const deleteIds: string[] = [];

  const structuredByBody = new Map<string, CanonicalTruthItem>();
  for (const item of args.desired.structured ?? []) {
    if (!item.section) continue;
    structuredByBody.set(`${item.section}::${item.body}`, item);
  }

  for (const section of sections) {
    const desiredBullets = (args.desired.sections[section] ?? [])
      .map((b) => b.trim())
      .filter(Boolean);
    const existing = args.existingRows
      .filter((r) => r.section === section)
      .slice()
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

    const unmatchedRows = [...existing];
    type Slot =
      | { kind: "keep"; row: KnowledgeItemRow; body: string; position: number }
      | {
          kind: "insert";
          body: string;
          position: number;
          structured?: CanonicalTruthItem;
        };

    const slots: Slot[] = [];

    for (let i = 0; i < desiredBullets.length; i++) {
      const body = desiredBullets[i]!;
      const exactIdx = unmatchedRows.findIndex((r) => r.body === body);
      if (exactIdx >= 0) {
        const [row] = unmatchedRows.splice(exactIdx, 1);
        slots.push({ kind: "keep", row: row!, body, position: i });
        continue;
      }

      const structured = structuredByBody.get(`${section}::${body}`);
      if (structured && isKnowledgeUuid(structured.id)) {
        const byIdIdx = unmatchedRows.findIndex((r) => r.id === structured.id);
        if (byIdIdx >= 0) {
          const [row] = unmatchedRows.splice(byIdIdx, 1);
          slots.push({ kind: "keep", row: row!, body, position: i });
          continue;
        }
      }

      slots.push({ kind: "insert", body, position: i, structured });
    }

    // Positional salvage: pair remaining "insert" slots with leftover rows in order.
    const leftover = [...unmatchedRows];
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s]!;
      if (slot.kind !== "insert") continue;
      if (leftover.length === 0) break;
      const row = leftover.shift()!;
      const unmatchedIdx = unmatchedRows.findIndex((r) => r.id === row.id);
      if (unmatchedIdx >= 0) unmatchedRows.splice(unmatchedIdx, 1);
      slots[s] = {
        kind: "keep",
        row,
        body: slot.body,
        position: slot.position,
      };
    }

    for (const slot of slots) {
      if (slot.kind === "keep") {
        const bodyChanged = slot.row.body !== slot.body;
        const positionChanged = slot.row.position !== slot.position;
        if (bodyChanged || positionChanged) {
          updates.push({
            id: slot.row.id,
            body: slot.body,
            position: slot.position,
            provenance: appendManualEditProvenance(
              slot.row.provenance,
              bodyChanged
                ? "Knowledge body corrected via Knowledge Centre"
                : "Knowledge position updated via Knowledge Centre",
              at,
            ),
          });
        }
      } else {
        const structured = slot.structured;
        inserts.push({
          id:
            structured && isKnowledgeUuid(structured.id)
              ? structured.id
              : newRowId(),
          section,
          body: slot.body,
          position: slot.position,
          kind: structured?.kind ?? null,
          epistemic: structured?.epistemic ?? null,
          lifecycle: structured?.lifecycle ?? "current",
          supersedes_id:
            structured?.supersedesId && isKnowledgeUuid(structured.supersedesId)
              ? structured.supersedesId
              : null,
          meta: (structured?.meta as Record<string, unknown>) ?? {},
          provenance: appendManualEditProvenance(
            structured?.provenance ?? [],
            "Knowledge item created via Knowledge Centre correction",
            at,
          ),
        });
      }
    }

    for (const row of unmatchedRows) {
      deleteIds.push(row.id);
    }
  }

  return {
    projectId: args.projectId,
    sections,
    updates,
    inserts,
    deleteIds,
  };
}

/**
 * Apply a reconcile plan. Does not modify risks / stakeholders / other tables.
 */
export async function applyKnowledgeReconcilePlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  plan: KnowledgeReconcilePlan,
  userId: string | null,
): Promise<void> {
  for (const update of plan.updates) {
    const { error } = await client
      .from("knowledge_items")
      .update({
        body: update.body,
        position: update.position,
        provenance: update.provenance,
      })
      .eq("id", update.id)
      .eq("project_id", projectId)
      .eq("workspace_id", workspaceId);
    if (error) {
      throw new Error(`[supabase] update knowledge: ${error.message}`);
    }
  }

  if (plan.inserts.length) {
    const rows = plan.inserts.map((ins) => ({
      id: ins.id,
      workspace_id: workspaceId,
      project_id: projectId,
      section: ins.section,
      body: ins.body,
      position: ins.position,
      kind: ins.kind,
      epistemic: ins.epistemic,
      lifecycle: ins.lifecycle,
      supersedes_id: ins.supersedes_id,
      meta: ins.meta,
      provenance: ins.provenance,
      created_by: userId,
    }));
    const { error } = await client.from("knowledge_items").insert(rows);
    if (error) {
      throw new Error(`[supabase] insert knowledge: ${error.message}`);
    }
  }

  if (plan.deleteIds.length) {
    const { error } = await client
      .from("knowledge_items")
      .delete()
      .in("id", plan.deleteIds)
      .eq("project_id", projectId)
      .eq("workspace_id", workspaceId);
    if (error) {
      throw new Error(`[supabase] delete knowledge: ${error.message}`);
    }
  }
}

/**
 * Fetch existing knowledge_items for a project and reconcile desired sections.
 */
export async function persistKnowledgeReconcile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  desired: ProjectKnowledge,
  userId: string | null,
  sections?: KnowledgeSectionId[],
): Promise<KnowledgeReconcilePlan> {
  const sectionList = sections ?? KNOWLEDGE_SECTION_IDS;
  let query = client
    .from("knowledge_items")
    .select(
      "id, workspace_id, project_id, section, body, position, kind, epistemic, lifecycle, supersedes_id, meta, provenance, created_by",
    )
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);

  if (sections && sections.length < KNOWLEDGE_SECTION_IDS.length) {
    query = query.in("section", sectionList);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[supabase] list knowledge for reconcile: ${error.message}`);
  }

  const plan = planKnowledgeReconcile({
    projectId,
    workspaceId,
    desired: {
      ...desired,
      projectId,
    },
    existingRows: (data ?? []) as KnowledgeItemRow[],
    sections: sectionList,
    userId,
  });

  await applyKnowledgeReconcilePlan(
    client,
    workspaceId,
    projectId,
    plan,
    userId,
  );

  return plan;
}
