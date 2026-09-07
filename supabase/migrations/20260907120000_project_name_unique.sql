-- Workspace-scoped unique project names (authoritative uniqueness).
-- Preflight: never delete or rename existing projects. If duplicate names
-- already exist in a workspace, fail clearly so a human can reconcile them.

do $$
declare
  dup text;
begin
  select string_agg(
    format('%s / %s ×%s', workspace_id::text, lower(btrim(name)), cnt),
    ', '
  )
  into dup
  from (
    select
      workspace_id,
      lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) as name,
      count(*) as cnt
    from public.projects
    group by 1, 2
    having count(*) > 1
  ) d;

  if dup is not null then
    raise exception
      'Cannot create unique index projects_workspace_name_lower_idx; duplicate project names already exist in a workspace: %. Reconcile names before applying uniqueness. Existing projects were not renamed or deleted.',
      dup;
  end if;
end
$$;

create unique index if not exists projects_workspace_name_lower_idx
  on public.projects (
    workspace_id,
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  );
