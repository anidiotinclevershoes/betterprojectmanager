-- Representative v0.9 rows on the pre-#110 schema. Disposable local DB only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000a1';
  uid_b uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000b2';
  ws_a uuid;
  ws_b uuid;
  proj uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000p1';
BEGIN
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM auth.users WHERE id IN (uid_a, uid_b) OR email IN (
    'hulk-dbq-a@example.test',
    'hulk-dbq-b@example.test'
  );

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    uid_a,
    'authenticated',
    'authenticated',
    'hulk-dbq-a@example.test',
    crypt('dbq-pass', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    uid_b,
    'authenticated',
    'authenticated',
    'hulk-dbq-b@example.test',
    crypt('dbq-pass', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  );

  SELECT m.workspace_id INTO ws_a
  FROM public.workspace_members m
  WHERE m.user_id = uid_a
  LIMIT 1;
  IF ws_a IS NULL THEN
    INSERT INTO public.workspaces (id, name)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000w1', 'Hulk A workspace')
    RETURNING id INTO ws_a;
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (ws_a, uid_a, 'owner');
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (uid_a, 'hulk-dbq-a@example.test', 'Hulk A')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT m.workspace_id INTO ws_b
  FROM public.workspace_members m
  WHERE m.user_id = uid_b
  LIMIT 1;
  IF ws_b IS NULL THEN
    INSERT INTO public.workspaces (id, name)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000w2', 'Hulk B workspace')
    RETURNING id INTO ws_b;
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (ws_b, uid_b, 'owner');
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (uid_b, 'hulk-dbq-b@example.test', 'Hulk B')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.projects (id, workspace_id, name, code, summary, current_focus)
  VALUES (proj, ws_a, 'HULK-DBQ-ALPHA', 'DBQ', 'Representative v0.9 project', 'Qualify');

  INSERT INTO public.todos (id, workspace_id, project_id, title, done, kind)
  VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000t1',
    ws_a,
    proj,
    'HULK-DBQ-SEED-TODO',
    false,
    'ACTION'
  );

  INSERT INTO public.risks (id, workspace_id, project_id, title, status, source)
  VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000r1',
    ws_a,
    proj,
    'HULK-DBQ-SEED-RISK',
    'open',
    'manual'
  );

  INSERT INTO public.stakeholders (id, workspace_id, project_id, name, role)
  VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000s1',
    ws_a,
    proj,
    'HULK-DBQ-SEED-PERSON',
    'Sponsor'
  );

  INSERT INTO public.knowledge_items (id, workspace_id, project_id, section, body, position)
  VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000k1',
    ws_a,
    proj,
    'now',
    'HULK-DBQ-SEED-KNOWLEDGE',
    0
  );
END $$;
