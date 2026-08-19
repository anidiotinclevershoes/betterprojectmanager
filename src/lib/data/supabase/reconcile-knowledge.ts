/**
 * Slice 1A / 1A.1: reconcile MissionState Knowledge → knowledge_items.
 *
 * Prefer UPDATE over wipe/recreate. Match by exact body, then stable id,
 * then unique wording-edit pairs — never by array index alone.
 * Does not touch the risks table.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";
import {
  alignSectionLines,
  alignSectionItemIds,
  isKnowledgeUuid,
  isLikelyWordingEdit,
  KNOWLEDGE_SECTION_IDS,
  remapStructuredForSections,
} from "@/lib/knowledge-identity";

export {
  alignSectionLines,
  alignSectionItemIds,
  isKnowledgeUuid,
  isLikelyWordingEdit,
  KNOWLEDGE_SECTION_IDS,
  remapStructuredForSections,
};

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

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function desiredIdsForSection(
  desired: ProjectKnowledge,
  section: KnowledgeSectionId,
  bodies: string[],
): Array<string | null> {
  const explicit = desired.sectionItemIds?.[section];
  if (explicit && explicit.length === bodies.length) {
    return explicit.map((id) => (id && isKnowledgeUuid(id) ? id : null));
  }
  const structured = desired.structured ?? [];
  const used = new Set<string>();
  return bodies.map((body) => {
    const hit = structured.find(
      (s) =>
        s.section === section &&
        s.body === body &&
        isKnowledgeUuid(s.id) &&
        !used.has(s.id),
    );
    if (hit) {
      used.add(hit.id);
      return hit.id;
    }
    return null;
  });
}

/**
 * Build a reconcile plan for one or more Knowledge sections.
 *
 * Matching order within each section:
 * 1. Exact body match
 * 2. Stable id from sectionItemIds / structured
 * 3. Unique wording-edit pairing among leftovers (deterministic overlap)
 * 4. Insert unmatched desired; delete unmatched existing
 *
 * Never uses array index alone.
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

  const structuredById = new Map<string, CanonicalTruthItem>();
  for (const item of args.desired.structured ?? []) {
    if (isKnowledgeUuid(item.id)) structuredById.set(item.id, item);
  }

  for (const section of sections) {
    const desiredBullets = (args.desired.sections[section] ?? [])
      .map((b) => b.trim())
      .filter(Boolean);
    const desiredIds = desiredIdsForSection(
      args.desired,
      section,
      desiredBullets,
    );
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
    const slots: Slot[] = desiredBullets.map(() => ({
      kind: "insert",
      body: "",
      position: 0,
    }));

    // Pass 1: exact body
    for (let i = 0; i < desiredBullets.length; i++) {
      const body = desiredBullets[i]!;
      const exactIdx = unmatchedRows.findIndex((r) => r.body === body);
      if (exactIdx >= 0) {
        const [row] = unmatchedRows.splice(exactIdx, 1);
        slots[i] = { kind: "keep", row: row!, body, position: i };
      } else {
        slots[i] = {
          kind: "insert",
          body,
          position: i,
          structured: desiredIds[i]
            ? structuredById.get(desiredIds[i]!)
            : undefined,
        };
      }
    }

    // Pass 2: stable id hints on still-insert slots
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      if (slot.kind !== "insert") continue;
      const id = desiredIds[i];
      if (!id || !isKnowledgeUuid(id)) continue;
      const byIdIdx = unmatchedRows.findIndex((r) => r.id === id);
      if (byIdIdx < 0) continue;
      const [row] = unmatchedRows.splice(byIdIdx, 1);
      slots[i] = {
        kind: "keep",
        row: row!,
        body: slot.body,
        position: slot.position,
      };
    }

    // Pass 3: unique wording-edit pairs among leftovers (no index salvage)
    const insertIdxs = slots
      .map((s, i) => (s.kind === "insert" ? i : -1))
      .filter((i) => i >= 0);
    type Edge = { slotIndex: number; rowIndex: number; score: number };
    const edges: Edge[] = [];
    for (const slotIndex of insertIdxs) {
      const body = (slots[slotIndex] as { body: string }).body;
      unmatchedRows.forEach((row, rowIndex) => {
        if (!isLikelyWordingEdit(row.body, body)) return;
        const tokens = (t: string) =>
          new Set(
            t
              .toLowerCase()
              .replace(/[^a-z0-9\s]/gi, " ")
              .split(/\s+/)
              .filter((x) => x.length > 1),
          );
        const A = tokens(row.body);
        const B = tokens(body);
        let inter = 0;
        for (const t of A) if (B.has(t)) inter += 1;
        const score =
          A.size + B.size === 0 ? 1 : inter / (A.size + B.size - inter || 1);
        edges.push({ slotIndex, rowIndex, score });
      });
    }
    edges.sort((a, b) => b.score - a.score);
    const usedSlots = new Set<number>();
    const usedRows = new Set<number>();
    for (const edge of edges) {
      if (usedSlots.has(edge.slotIndex) || usedRows.has(edge.rowIndex)) continue;
      const rivalSlots = edges.filter(
        (e) =>
          e.slotIndex === edge.slotIndex &&
          e.rowIndex !== edge.rowIndex &&
          e.score >= edge.score - 1e-9,
      );
      const rivalRows = edges.filter(
        (e) =>
          e.rowIndex === edge.rowIndex &&
          e.slotIndex !== edge.slotIndex &&
          e.score >= edge.score - 1e-9,
      );
      if (rivalSlots.some((e) => !usedRows.has(e.rowIndex))) continue;
      if (rivalRows.some((e) => !usedSlots.has(e.slotIndex))) continue;

      usedSlots.add(edge.slotIndex);
      usedRows.add(edge.rowIndex);
      const row = unmatchedRows[edge.rowIndex]!;
      const slot = slots[edge.slotIndex] as {
        kind: "insert";
        body: string;
        position: number;
      };
      slots[edge.slotIndex] = {
        kind: "keep",
        row,
        body: slot.body,
        position: slot.position,
      };
    }
    // Remove used rows from unmatched (highest index first)
    [...usedRows]
      .sort((a, b) => b - a)
      .forEach((idx) => unmatchedRows.splice(idx, 1));

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
        // New item: never inherit metadata from an unrelated prior row.
        const structured = slot.structured;
        const safeStructured =
          structured &&
          isKnowledgeUuid(structured.id) &&
          structured.body === slot.body
            ? structured
            : undefined;
        inserts.push({
          id: newRowId(),
          section,
          body: slot.body,
          position: slot.position,
          kind: safeStructured?.kind ?? null,
          epistemic: safeStructured?.epistemic ?? null,
          lifecycle: safeStructured?.lifecycle ?? "current",
          supersedes_id: null,
          meta: {},
          provenance: appendManualEditProvenance(
            [],
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

/** @deprecated use alignSectionLines from knowledge-identity — kept for tests */
export function planWithAlignmentHelper(
  previousBodies: string[],
  previousIds: Array<string | null>,
  nextBodies: string[],
) {
  return alignSectionLines(previousBodies, previousIds, nextBodies);
}
