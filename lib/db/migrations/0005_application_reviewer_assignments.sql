-- Add an explicit reviewer assignment to each application without changing
-- existing records or the prior reviewer/decision history. These nullable
-- columns are only accessed by application primary key; no table scan index is
-- needed, avoiding an unnecessary write lock on large enrollment tables.
BEGIN;

DO $preconditions$
BEGIN
  IF to_regclass('public.enrollment_applications') IS NULL THEN
    RAISE EXCEPTION 'Migration precondition failed: public.enrollment_applications does not exist';
  END IF;
  IF to_regclass('public.guest_preapplications') IS NULL THEN
    RAISE EXCEPTION 'Migration precondition failed: public.guest_preapplications does not exist';
  END IF;
END
$preconditions$;

ALTER TABLE public.enrollment_applications
  ADD COLUMN IF NOT EXISTS assigned_reviewer_user_id text;

ALTER TABLE public.guest_preapplications
  ADD COLUMN IF NOT EXISTS assigned_reviewer_user_id text;

DO $preconditions$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollment_applications'
      AND column_name = 'assigned_reviewer_user_id'
      AND data_type = 'text'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Migration precondition failed: public.enrollment_applications.assigned_reviewer_user_id must be nullable text';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guest_preapplications'
      AND column_name = 'assigned_reviewer_user_id'
      AND data_type = 'text'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Migration precondition failed: public.guest_preapplications.assigned_reviewer_user_id must be nullable text';
  END IF;
END
$preconditions$;

COMMIT;
