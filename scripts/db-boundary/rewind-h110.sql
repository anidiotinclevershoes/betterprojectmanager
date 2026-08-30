-- Test-only: rewind PR #110 objects so we can re-apply the official files
-- against a disposable local DB that already ran supabase start.
-- Does not ship as a production migration.

DROP FUNCTION IF EXISTS public.persist_risk_with_knowledge(uuid, uuid, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_todo_create_with_receipt(uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_milestone_create_with_receipt(uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.persist_person_responsibility(uuid, uuid, jsonb, uuid[], jsonb);
DROP TABLE IF EXISTS public.capture_apply_receipts CASCADE;
