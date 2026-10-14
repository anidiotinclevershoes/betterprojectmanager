-- Atomic Issue edit: Title + Notes + retrieval tags commit together.
-- Existing rows stay valid. No new columns. No Knowledge rewrite.
-- SECURITY INVOKER: RLS stays in force. Membership and project scope are
-- also checked explicitly so a foreign Issue UUID cannot be updated.

create or replace function public.save_risk_edit(
  p_workspace_id uuid,
  p_project_id uuid,
  p_risk_id uuid,
  p_title text,
  p_notes text,
  p_tags jsonb,
  p_created_by uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row public.risks%rowtype;
  v_title_prev text;
  v_title_next text;
  v_title_changed boolean;
  v_notes_prev text;
  v_notes_next text;
  v_notes_changed boolean;
  v_notes_title text;
  v_notes_detail text;
  v_title_detail text;
  v_elem jsonb;
  v_i int;
  v_name text;
  v_slug text;
  v_collapsed text;
  v_display text;
  v_piece text;
  v_word text;
  v_desired_slugs text[] := '{}';
  v_desired_names text[] := '{}';
  v_current_slugs text[] := '{}';
  v_tags_changed boolean;
  v_tag_id uuid;
  v_tag_ids uuid[] := '{}';
  v_history jsonb := '[]'::jsonb;
  v_history_id uuid;
  v_history_at timestamptz;
  v_updated_at timestamptz;
  v_tags jsonb;
  v_item_tags jsonb;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and workspace_id = p_workspace_id
  ) then
    raise exception 'project is not in this workspace';
  end if;

  select *
  into v_row
  from public.risks
  where id = p_risk_id
    and project_id = p_project_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'issue is not in this project';
  end if;

  v_title_prev := btrim(coalesce(v_row.title, ''));
  v_title_next := btrim(coalesce(p_title, ''));
  if v_title_next = '' then
    raise exception 'issue title is blank';
  end if;
  v_title_changed := v_title_prev is distinct from v_title_next;

  v_notes_prev := nullif(btrim(coalesce(v_row.notes, '')), '');
  v_notes_next := nullif(btrim(coalesce(p_notes, '')), '');
  v_notes_changed := v_notes_prev is distinct from v_notes_next;

  if p_tags is null or jsonb_typeof(p_tags) <> 'array' then
    raise exception 'tags must be a list';
  end if;

  for v_i in 0 .. jsonb_array_length(p_tags) - 1 loop
    v_elem := p_tags -> v_i;
    if jsonb_typeof(v_elem) <> 'object'
      or not jsonb_exists(v_elem, 'name')
      or not jsonb_exists(v_elem, 'slug')
      or jsonb_typeof(v_elem -> 'name') <> 'string'
      or jsonb_typeof(v_elem -> 'slug') <> 'string'
    then
      raise exception 'tag value is malformed';
    end if;

    v_name := v_elem ->> 'name';
    v_slug := v_elem ->> 'slug';
    v_collapsed := regexp_replace(btrim(v_name), '\s+', ' ', 'g');
    if v_collapsed = '' or btrim(v_slug) = '' then
      raise exception 'tag value is empty';
    end if;
    if v_slug is distinct from lower(v_collapsed) then
      raise exception 'tag slug does not match its name';
    end if;

    v_display := '';
    foreach v_word in array string_to_array(v_collapsed, ' ') loop
      if v_word = upper(v_word) and char_length(v_word) <= 4 then
        v_piece := v_word;
      else
        v_piece := upper(substr(v_word, 1, 1)) || substr(v_word, 2);
      end if;
      if v_display = '' then
        v_display := v_piece;
      else
        v_display := v_display || ' ' || v_piece;
      end if;
    end loop;

    if v_name is distinct from v_display then
      raise exception 'tag name is not display-canonical';
    end if;

    if v_slug = any(v_desired_slugs) then
      continue;
    end if;
    v_desired_slugs := array_append(v_desired_slugs, v_slug);
    v_desired_names := array_append(v_desired_names, v_name);
  end loop;

  select coalesce(array_agg(pt.slug), '{}'::text[])
  into v_current_slugs
  from public.item_tags it
  join public.project_tags pt
    on pt.id = it.tag_id
   and pt.project_id = it.project_id
  where it.project_id = p_project_id
    and it.workspace_id = p_workspace_id
    and it.target_kind = 'risk'
    and it.target_id = v_row.id;

  select (
    (
      select coalesce(array_agg(s order by s), '{}'::text[])
      from unnest(v_desired_slugs) s
    )
    is distinct from
    (
      select coalesce(array_agg(s order by s), '{}'::text[])
      from unnest(coalesce(v_current_slugs, '{}'::text[])) s
    )
  )
  into v_tags_changed;

  v_updated_at := v_row.updated_at;

  if v_title_changed or v_notes_changed then
    update public.risks
    set
      title = case when v_title_changed then v_title_next else title end,
      notes = case when v_notes_changed then v_notes_next else notes end,
      updated_at = timezone('utc', now())
    where id = v_row.id
      and project_id = p_project_id
      and workspace_id = p_workspace_id
    returning updated_at into v_updated_at;
  end if;

  if v_title_changed then
    v_title_detail :=
      'Previous title:' || E'\n' || v_title_prev ||
      E'\n' || 'Current title:' || E'\n' || v_title_next;
    insert into public.history_events (
      workspace_id,
      project_id,
      type,
      title,
      detail,
      source,
      created_by,
      target_kind,
      target_id
    ) values (
      p_workspace_id,
      p_project_id,
      'other',
      'Issue title updated',
      v_title_detail,
      'user',
      p_created_by,
      'risk',
      v_row.id
    )
    returning id, created_at into v_history_id, v_history_at;
    v_history := v_history || jsonb_build_array(
      jsonb_build_object(
        'id', v_history_id,
        'title', 'Issue title updated',
        'detail', v_title_detail,
        'created_at', v_history_at
      )
    );
  end if;

  if v_notes_changed then
    if v_notes_prev is null then
      v_notes_title := 'Issue notes added';
    elsif v_notes_next is null then
      v_notes_title := 'Issue notes cleared';
    else
      v_notes_title := 'Issue notes updated';
    end if;
    v_notes_detail :=
      'Previous notes:' || E'\n' || coalesce(v_notes_prev, '') ||
      E'\n' || 'Current notes:' || E'\n' || coalesce(v_notes_next, '');
    insert into public.history_events (
      workspace_id,
      project_id,
      type,
      title,
      detail,
      source,
      created_by,
      target_kind,
      target_id
    ) values (
      p_workspace_id,
      p_project_id,
      'other',
      v_notes_title,
      v_notes_detail,
      'user',
      p_created_by,
      'risk',
      v_row.id
    )
    returning id, created_at into v_history_id, v_history_at;
    v_history := v_history || jsonb_build_array(
      jsonb_build_object(
        'id', v_history_id,
        'title', v_notes_title,
        'detail', v_notes_detail,
        'created_at', v_history_at
      )
    );
  end if;

  if v_tags_changed then
    for v_i in 1 .. coalesce(array_length(v_desired_slugs, 1), 0) loop
      v_slug := v_desired_slugs[v_i];
      v_name := v_desired_names[v_i];
      v_tag_id := null;
      select id
      into v_tag_id
      from public.project_tags
      where project_id = p_project_id
        and slug = v_slug;
      if v_tag_id is null then
        insert into public.project_tags (
          workspace_id,
          project_id,
          name,
          slug,
          origin
        ) values (
          p_workspace_id,
          p_project_id,
          v_name,
          v_slug,
          'custom'
        )
        on conflict (project_id, slug) do nothing
        returning id into v_tag_id;
        if v_tag_id is null then
          select id
          into v_tag_id
          from public.project_tags
          where project_id = p_project_id
            and slug = v_slug;
        end if;
      end if;
      if v_tag_id is null then
        raise exception 'could not save issue tags';
      end if;
      v_tag_ids := array_append(v_tag_ids, v_tag_id);
    end loop;

    delete from public.item_tags
    where project_id = p_project_id
      and workspace_id = p_workspace_id
      and target_kind = 'risk'
      and target_id = v_row.id
      and not (tag_id = any(v_tag_ids));

    insert into public.item_tags (
      workspace_id,
      project_id,
      tag_id,
      target_kind,
      target_id
    )
    select
      p_workspace_id,
      p_project_id,
      wanted.tag_id,
      'risk',
      v_row.id
    from unnest(v_tag_ids) as wanted(tag_id)
    where not exists (
      select 1
      from public.item_tags existing
      where existing.tag_id = wanted.tag_id
        and existing.target_kind = 'risk'
        and existing.target_id = v_row.id
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pt.id,
        'name', pt.name,
        'slug', pt.slug,
        'origin', pt.origin
      )
      order by pt.slug
    ),
    '[]'::jsonb
  )
  into v_tags
  from public.item_tags it
  join public.project_tags pt
    on pt.id = it.tag_id
   and pt.project_id = it.project_id
  where it.project_id = p_project_id
    and it.workspace_id = p_workspace_id
    and it.target_kind = 'risk'
    and it.target_id = v_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', it.id,
        'tag_id', it.tag_id
      )
      order by it.tag_id
    ),
    '[]'::jsonb
  )
  into v_item_tags
  from public.item_tags it
  where it.project_id = p_project_id
    and it.workspace_id = p_workspace_id
    and it.target_kind = 'risk'
    and it.target_id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'changed', v_title_changed or v_notes_changed or v_tags_changed,
    'title_changed', v_title_changed,
    'notes_changed', v_notes_changed,
    'tags_changed', v_tags_changed,
    'title', case when v_title_changed then v_title_next else v_row.title end,
    'notes', v_notes_next,
    'updated_at', v_updated_at,
    'history', v_history,
    'tags', coalesce(v_tags, '[]'::jsonb),
    'item_tags', coalesce(v_item_tags, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.save_risk_edit(uuid, uuid, uuid, text, text, jsonb, uuid) to authenticated;
