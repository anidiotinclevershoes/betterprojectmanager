/**
 * Persist retrieval tags. Metadata only — never writes to truth tables.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemTag, ProjectTag } from "@/lib/tags";

function requireOk(error: { message: string } | null, op: string) {
  if (error) throw new Error(`[supabase] ${op}: ${error.message}`);
}

export async function persistTagBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  projectId: string,
  projectTags: ProjectTag[],
  itemTags: ItemTag[],
): Promise<void> {
  if (!projectTags.length && !itemTags.length) return;

  if (projectTags.length) {
    const { error } = await client.from("project_tags").insert(
      projectTags.map((tag) => ({
        id: tag.id,
        workspace_id: workspaceId,
        project_id: projectId,
        name: tag.name,
        slug: tag.slug,
        origin: tag.origin,
      })),
    );
    requireOk(error, "create project tags");
  }

  if (itemTags.length) {
    const { error } = await client.from("item_tags").insert(
      itemTags.map((row) => ({
        id: row.id,
        workspace_id: workspaceId,
        project_id: projectId,
        tag_id: row.tagId,
        target_kind: row.targetKind,
        target_id: row.targetId,
      })),
    );
    requireOk(error, "attach item tags");
  }
}

export async function persistEnsureProjectTag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  tag: ProjectTag,
): Promise<ProjectTag> {
  const { data: existing, error: lookupError } = await client
    .from("project_tags")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", tag.projectId)
    .eq("slug", tag.slug)
    .maybeSingle();
  requireOk(lookupError, "lookup project tag");
  if (existing?.id) {
    return {
      id: String(existing.id),
      projectId: String(existing.project_id),
      name: String(existing.name),
      slug: String(existing.slug),
      origin: existing.origin === "predefined" ? "predefined" : "custom",
    };
  }

  const { data, error } = await client
    .from("project_tags")
    .insert({
      id: tag.id,
      workspace_id: workspaceId,
      project_id: tag.projectId,
      name: tag.name,
      slug: tag.slug,
      origin: tag.origin,
    })
    .select("*")
    .single();
  if (error) throw new Error(`[supabase] create project tag: ${error.message}`);
  return {
    id: String(data.id),
    projectId: String(data.project_id),
    name: String(data.name),
    slug: String(data.slug),
    origin: data.origin === "predefined" ? "predefined" : "custom",
  };
}

export async function persistAttachItemTag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  row: ItemTag,
): Promise<void> {
  const { error } = await client.from("item_tags").insert({
    id: row.id,
    workspace_id: workspaceId,
    project_id: row.projectId,
    tag_id: row.tagId,
    target_kind: row.targetKind,
    target_id: row.targetId,
  });
  if (error && error.code === "23505") return;
  requireOk(error, "attach item tag");
}

export async function persistDetachItemTag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  workspaceId: string,
  row: Pick<ItemTag, "tagId" | "targetKind" | "targetId" | "projectId">,
): Promise<void> {
  const { error } = await client
    .from("item_tags")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("project_id", row.projectId)
    .eq("tag_id", row.tagId)
    .eq("target_kind", row.targetKind)
    .eq("target_id", row.targetId);
  requireOk(error, "detach item tag");
}
