-- Real Postgres RPC / constraint / cascade qualification.
-- No FakeWorkspaceClient. Test-only triggers are dropped at the end.

CREATE TEMP TABLE hulk_dbq (
  id text PRIMARY KEY,
  result text NOT NULL,
  detail text NOT NULL
);

CREATE OR REPLACE FUNCTION public.hulk_dbq_fail_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'injected second-stage failure';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.claim(p_user uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.note(p_id text, p_ok boolean, p_detail text)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO hulk_dbq (id, result, detail)
  VALUES (p_id, CASE WHEN p_ok THEN 'PASS' ELSE 'RED' END, p_detail)
  ON CONFLICT (id) DO UPDATE SET result = EXCLUDED.result, detail = EXCLUDED.detail;
$$;

DO $$
DECLARE
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000a1';
  uid_b uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000b2';
  proj uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000p1';
  ws_a uuid;
  ws_b uuid;
  hist_before int;
  hist_after int;
  person_ok jsonb;
  risk_ok jsonb;
  todo_ok jsonb;
  todo2 jsonb;
  err text;
  n_person int;
  n_know int;
  n_risk int;
  n_todo int;
  n_receipt int;
  n_same_title int;
  leaked int;
BEGIN
  SELECT workspace_id INTO ws_a FROM public.workspace_members WHERE user_id = uid_a LIMIT 1;
  SELECT workspace_id INTO ws_b FROM public.workspace_members WHERE user_id = uid_b LIMIT 1;
  IF ws_a IS NULL OR ws_b IS NULL THEN
    PERFORM pg_temp.note('live-setup', false, 'workspace membership missing after seed');
    RETURN;
  END IF;

  -- Functions must not write History.
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN (
      'persist_person_responsibility',
      'persist_risk_with_knowledge',
      'persist_todo_create_with_receipt',
      'persist_milestone_create_with_receipt'
    )
    AND prosrc ILIKE '%history_events%'
  ) THEN
    PERFORM pg_temp.note('history-outside-tx', false, 'persist_* function body mentions history_events');
  ELSE
    PERFORM pg_temp.note('history-outside-tx', true, 'persist_* functions do not write history_events');
  END IF;

  SELECT count(*) INTO hist_before FROM public.history_events;

  -- 3. Person + responsibility success
  PERFORM pg_temp.claim(uid_a);
  person_ok := public.persist_person_responsibility(
    ws_a,
    proj,
    jsonb_build_object(
      'id', 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000n1',
      'name', 'Nadia Qureshi',
      'role', 'UAT'
    ),
    ARRAY[]::uuid[],
    jsonb_build_object(
      'section', 'people',
      'body', 'Nadia Qureshi — UAT',
      'kind', 'responsibility',
      'lifecycle', 'current'
    )
  );
  SELECT count(*) INTO n_person FROM public.stakeholders
    WHERE project_id = proj AND name = 'Nadia Qureshi';
  SELECT count(*) INTO n_know FROM public.knowledge_items
    WHERE project_id = proj AND body = 'Nadia Qureshi — UAT';
  PERFORM pg_temp.note(
    'person-commit',
    n_person = 1 AND n_know = 1 AND person_ok ? 'person_id',
    format('stakeholders=%s knowledge=%s rpc=%s', n_person, n_know, person_ok)
  );

  -- 4. Person second-stage failure rolls both back
  DROP TRIGGER IF EXISTS hulk_fail_knowledge ON public.knowledge_items;
  CREATE TRIGGER hulk_fail_knowledge
  BEFORE INSERT ON public.knowledge_items
  FOR EACH ROW
  WHEN (NEW.body = 'HULK-FAIL-PERSON')
  EXECUTE FUNCTION public.hulk_dbq_fail_insert();

  err := NULL;
  BEGIN
    PERFORM pg_temp.claim(uid_a);
    PERFORM public.persist_person_responsibility(
      ws_a,
      proj,
      jsonb_build_object(
        'id', 'aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000n2',
        'name', 'HULK-FAIL-PERSON-NAME',
        'role', 'UAT'
      ),
      ARRAY[]::uuid[],
      jsonb_build_object(
        'section', 'people',
        'body', 'HULK-FAIL-PERSON',
        'kind', 'responsibility',
        'lifecycle', 'current'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
  END;
  DROP TRIGGER IF EXISTS hulk_fail_knowledge ON public.knowledge_items;
  SELECT count(*) INTO n_person FROM public.stakeholders
    WHERE project_id = proj AND name = 'HULK-FAIL-PERSON-NAME';
  SELECT count(*) INTO n_know FROM public.knowledge_items
    WHERE project_id = proj AND body = 'HULK-FAIL-PERSON';
  PERFORM pg_temp.note(
    'person-rollback',
    err IS NOT NULL AND n_person = 0 AND n_know = 0,
    format('err=%s leftover person=%s knowledge=%s', err, n_person, n_know)
  );

  -- 5. Risk + knowledge success
  PERFORM pg_temp.claim(uid_a);
  risk_ok := public.persist_risk_with_knowledge(
    ws_a,
    proj,
    jsonb_build_object(
      'section', 'risks',
      'body', 'HULK-DBQ-RISK-OK',
      'lifecycle', 'current'
    ),
    jsonb_build_object(
      'title', 'HULK-DBQ-RISK-OK',
      'status', 'open',
      'source', 'capture'
    ),
    NULL
  );
  SELECT count(*) INTO n_know FROM public.knowledge_items
    WHERE project_id = proj AND body = 'HULK-DBQ-RISK-OK';
  SELECT count(*) INTO n_risk FROM public.risks
    WHERE project_id = proj AND title = 'HULK-DBQ-RISK-OK';
  PERFORM pg_temp.note(
    'risk-commit',
    n_know = 1 AND n_risk = 1,
    format('knowledge=%s risks=%s rpc=%s', n_know, n_risk, risk_ok)
  );

  -- 6. Risk second-stage failure rolls both back
  DROP TRIGGER IF EXISTS hulk_fail_risks ON public.risks;
  CREATE TRIGGER hulk_fail_risks
  BEFORE INSERT ON public.risks
  FOR EACH ROW
  WHEN (NEW.title = 'HULK-FAIL-RISK')
  EXECUTE FUNCTION public.hulk_dbq_fail_insert();

  err := NULL;
  BEGIN
    PERFORM pg_temp.claim(uid_a);
    PERFORM public.persist_risk_with_knowledge(
      ws_a,
      proj,
      jsonb_build_object(
        'section', 'risks',
        'body', 'HULK-FAIL-RISK',
        'lifecycle', 'current'
      ),
      jsonb_build_object(
        'title', 'HULK-FAIL-RISK',
        'status', 'open',
        'source', 'capture'
      ),
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
  END;
  DROP TRIGGER IF EXISTS hulk_fail_risks ON public.risks;
  SELECT count(*) INTO n_know FROM public.knowledge_items
    WHERE project_id = proj AND body = 'HULK-FAIL-RISK';
  SELECT count(*) INTO n_risk FROM public.risks
    WHERE project_id = proj AND title = 'HULK-FAIL-RISK';
  PERFORM pg_temp.note(
    'risk-rollback',
    err IS NOT NULL AND n_know = 0 AND n_risk = 0,
    format('err=%s leftover knowledge=%s risks=%s', err, n_know, n_risk)
  );

  -- 7. Authoritative create + receipt
  PERFORM pg_temp.claim(uid_a);
  todo_ok := public.persist_todo_create_with_receipt(
    ws_a,
    proj,
    jsonb_build_object('title', 'HULK-DBQ-TODO-OK', 'done', false, 'kind', 'ACTION'),
    jsonb_build_object('operation_id', 'op-hulk-todo-ok', 'entity_type', 'todo')
  );
  SELECT count(*) INTO n_todo FROM public.todos
    WHERE project_id = proj AND title = 'HULK-DBQ-TODO-OK';
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts
    WHERE project_id = proj AND operation_id = 'op-hulk-todo-ok';
  PERFORM pg_temp.note(
    'receipt-commit',
    n_todo = 1 AND n_receipt = 1,
    format('todos=%s receipts=%s rpc=%s', n_todo, n_receipt, todo_ok)
  );

  -- 8. Receipt failure rolls truth write back
  DROP TRIGGER IF EXISTS hulk_fail_receipt ON public.capture_apply_receipts;
  CREATE TRIGGER hulk_fail_receipt
  BEFORE INSERT ON public.capture_apply_receipts
  FOR EACH ROW
  WHEN (NEW.operation_id = 'op-hulk-fail-receipt')
  EXECUTE FUNCTION public.hulk_dbq_fail_insert();

  err := NULL;
  BEGIN
    PERFORM pg_temp.claim(uid_a);
    PERFORM public.persist_todo_create_with_receipt(
      ws_a,
      proj,
      jsonb_build_object('title', 'HULK-FAIL-RECEIPT-TODO', 'done', false, 'kind', 'ACTION'),
      jsonb_build_object('operation_id', 'op-hulk-fail-receipt', 'entity_type', 'todo')
    );
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
  END;
  DROP TRIGGER IF EXISTS hulk_fail_receipt ON public.capture_apply_receipts;
  SELECT count(*) INTO n_todo FROM public.todos
    WHERE project_id = proj AND title = 'HULK-FAIL-RECEIPT-TODO';
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts
    WHERE operation_id = 'op-hulk-fail-receipt';
  PERFORM pg_temp.note(
    'receipt-rollback',
    err IS NOT NULL AND n_todo = 0 AND n_receipt = 0,
    format('err=%s leftover todos=%s receipts=%s', err, n_todo, n_receipt)
  );

  -- 9. Same operation_id cannot duplicate
  err := NULL;
  BEGIN
    PERFORM pg_temp.claim(uid_a);
    PERFORM public.persist_todo_create_with_receipt(
      ws_a,
      proj,
      jsonb_build_object('title', 'HULK-DBQ-TODO-DUP', 'done', false, 'kind', 'ACTION'),
      jsonb_build_object('operation_id', 'op-hulk-todo-ok', 'entity_type', 'todo')
    );
  EXCEPTION WHEN unique_violation THEN
    err := 'unique_violation';
  WHEN OTHERS THEN
    err := SQLERRM;
  END;
  SELECT count(*) INTO n_todo FROM public.todos
    WHERE project_id = proj AND title IN ('HULK-DBQ-TODO-OK', 'HULK-DBQ-TODO-DUP');
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts
    WHERE project_id = proj AND operation_id = 'op-hulk-todo-ok';
  PERFORM pg_temp.note(
    'duplicate-operation-id',
    err IS NOT NULL AND n_todo = 1 AND n_receipt = 1,
    format('err=%s todos=%s receipts=%s', err, n_todo, n_receipt)
  );

  -- Distinct operation ids, same human title
  PERFORM pg_temp.claim(uid_a);
  PERFORM public.persist_todo_create_with_receipt(
    ws_a,
    proj,
    jsonb_build_object('title', 'HULK-DBQ-SHARED-TITLE', 'done', false, 'kind', 'ACTION'),
    jsonb_build_object('operation_id', 'op-hulk-title-a', 'entity_type', 'todo')
  );
  PERFORM public.persist_todo_create_with_receipt(
    ws_a,
    proj,
    jsonb_build_object('title', 'HULK-DBQ-SHARED-TITLE', 'done', false, 'kind', 'ACTION'),
    jsonb_build_object('operation_id', 'op-hulk-title-b', 'entity_type', 'todo')
  );
  SELECT count(*) INTO n_same_title FROM public.todos
    WHERE project_id = proj AND title = 'HULK-DBQ-SHARED-TITLE';
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts
    WHERE project_id = proj AND operation_id IN ('op-hulk-title-a', 'op-hulk-title-b');
  PERFORM pg_temp.note(
    'distinct-ops-same-title',
    n_same_title = 2 AND n_receipt = 2,
    format('todos=%s receipts=%s', n_same_title, n_receipt)
  );

  -- 11. Workspace scoping: B cannot write into A's workspace
  err := NULL;
  BEGIN
    PERFORM pg_temp.claim(uid_b);
    PERFORM public.persist_todo_create_with_receipt(
      ws_a,
      proj,
      jsonb_build_object('title', 'HULK-LEAK-TO-A', 'done', false, 'kind', 'ACTION'),
      jsonb_build_object('operation_id', 'op-hulk-leak', 'entity_type', 'todo')
    );
  EXCEPTION WHEN OTHERS THEN
    err := SQLERRM;
  END;
  SELECT count(*) INTO leaked FROM public.todos WHERE title = 'HULK-LEAK-TO-A';
  PERFORM pg_temp.note(
    'workspace-scoping',
    err IS NOT NULL AND leaked = 0,
    format('err=%s leaked=%s', err, leaked)
  );

  -- 10. Project delete cascades receipts (todos SET NULL)
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  SELECT count(*) INTO n_receipt FROM public.capture_apply_receipts WHERE project_id = proj;
  SELECT count(*) INTO leaked FROM public.capture_apply_receipts
    WHERE operation_id IN ('op-hulk-todo-ok', 'op-hulk-title-a', 'op-hulk-title-b');
  PERFORM pg_temp.note(
    'project-delete-cascade',
    n_receipt = 0 AND leaked = 0,
    format('receipts remaining for project/ops=%s/%s', n_receipt, leaked)
  );

  SELECT count(*) INTO hist_after FROM public.history_events;
  PERFORM pg_temp.note(
    'history-count-unchanged',
    hist_after = hist_before,
    format('history_events %s → %s', hist_before, hist_after)
  );
END $$;

DROP FUNCTION IF EXISTS public.hulk_dbq_fail_insert();

SELECT json_agg(json_build_object('id', id, 'result', result, 'detail', detail) ORDER BY id)
FROM hulk_dbq;
