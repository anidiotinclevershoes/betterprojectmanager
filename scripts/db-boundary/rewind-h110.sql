-- Test-only: rewind PR #110 objects so we can re-apply the official files
-- against a disposable local DB that already ran supabase start.
-- Drop by catalog OID so guessed signatures cannot leave the functions behind.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'persist_risk_with_knowledge',
        'persist_todo_create_with_receipt',
        'persist_milestone_create_with_receipt',
        'persist_person_responsibility'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.persist_risk_with_knowledge(uuid, uuid, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_todo_create_with_receipt(uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_milestone_create_with_receipt(uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_person_responsibility(uuid, uuid, jsonb, uuid[], jsonb);

DROP TABLE IF EXISTS public.capture_apply_receipts CASCADE;
