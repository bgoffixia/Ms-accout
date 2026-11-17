-- Per-provider numeric Invitation Code length configuration and audit history.
-- Existing applicant values are intentionally not rewritten or invalidated.
BEGIN;

CREATE TABLE IF NOT EXISTS public.provider_invitation_code_settings (
  provider_id text PRIMARY KEY,
  required_length integer NOT NULL DEFAULT 8,
  updated_by_user_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_invitation_code_settings_provider_check
    CHECK (provider_id IN ('category-1', 'category-2', 'category-3', 'category-4')),
  CONSTRAINT provider_invitation_code_settings_length_check
    CHECK (required_length BETWEEN 4 AND 12)
);

CREATE TABLE IF NOT EXISTS public.provider_invitation_code_setting_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL,
  provider_id text NOT NULL,
  previous_length integer NOT NULL,
  new_length integer NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_invitation_code_setting_audit_provider_check
    CHECK (provider_id IN ('category-1', 'category-2', 'category-3', 'category-4')),
  CONSTRAINT provider_invitation_code_setting_audit_previous_length_check
    CHECK (previous_length BETWEEN 4 AND 12),
  CONSTRAINT provider_invitation_code_setting_audit_new_length_check
    CHECK (new_length BETWEEN 4 AND 12)
);

-- CREATE TABLE IF NOT EXISTS is a no-op for an existing object, so verify that
-- its required column contract is present before modifying it.
DO $preconditions$
DECLARE
  required_column record;
BEGIN
  FOR required_column IN
    SELECT * FROM (VALUES
      ('provider_invitation_code_settings', 'provider_id', 'text', 'NO'),
      ('provider_invitation_code_settings', 'required_length', 'integer', 'NO'),
      ('provider_invitation_code_settings', 'updated_by_user_id', 'text', 'YES'),
      ('provider_invitation_code_settings', 'updated_at', 'timestamp with time zone', 'NO'),
      ('provider_invitation_code_setting_audit', 'id', 'uuid', 'NO'),
      ('provider_invitation_code_setting_audit', 'actor_user_id', 'text', 'NO'),
      ('provider_invitation_code_setting_audit', 'provider_id', 'text', 'NO'),
      ('provider_invitation_code_setting_audit', 'previous_length', 'integer', 'NO'),
      ('provider_invitation_code_setting_audit', 'new_length', 'integer', 'NO'),
      ('provider_invitation_code_setting_audit', 'changed_at', 'timestamp with time zone', 'NO')
    ) AS required(table_name, column_name, data_type, is_nullable)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = required_column.table_name
        AND column_name = required_column.column_name
        AND data_type = required_column.data_type
        AND is_nullable = required_column.is_nullable
    ) THEN
      RAISE EXCEPTION 'Migration precondition failed: public.%.% must be % and nullable=%',
        required_column.table_name,
        required_column.column_name,
        required_column.data_type,
        required_column.is_nullable;
    END IF;
  END LOOP;
END
$preconditions$;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'provider_invitation_code_settings_provider_check'
      AND conrelid = 'public.provider_invitation_code_settings'::regclass
  ) THEN
    ALTER TABLE public.provider_invitation_code_settings
      ADD CONSTRAINT provider_invitation_code_settings_provider_check
      CHECK (provider_id IN ('category-1', 'category-2', 'category-3', 'category-4'));
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'provider_invitation_code_settings_length_check'
      AND conrelid = 'public.provider_invitation_code_settings'::regclass
  ) THEN
    ALTER TABLE public.provider_invitation_code_settings
      ADD CONSTRAINT provider_invitation_code_settings_length_check
      CHECK (required_length BETWEEN 4 AND 12);
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'provider_invitation_code_setting_audit_provider_check'
      AND conrelid = 'public.provider_invitation_code_setting_audit'::regclass
  ) THEN
    ALTER TABLE public.provider_invitation_code_setting_audit
      ADD CONSTRAINT provider_invitation_code_setting_audit_provider_check
      CHECK (provider_id IN ('category-1', 'category-2', 'category-3', 'category-4'));
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'provider_invitation_code_setting_audit_previous_length_check'
      AND conrelid = 'public.provider_invitation_code_setting_audit'::regclass
  ) THEN
    ALTER TABLE public.provider_invitation_code_setting_audit
      ADD CONSTRAINT provider_invitation_code_setting_audit_previous_length_check
      CHECK (previous_length BETWEEN 4 AND 12);
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'provider_invitation_code_setting_audit_new_length_check'
      AND conrelid = 'public.provider_invitation_code_setting_audit'::regclass
  ) THEN
    ALTER TABLE public.provider_invitation_code_setting_audit
      ADD CONSTRAINT provider_invitation_code_setting_audit_new_length_check
      CHECK (new_length BETWEEN 4 AND 12);
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS provider_invitation_code_setting_audit_provider_changed_idx
  ON public.provider_invitation_code_setting_audit (provider_id, changed_at);

ALTER TABLE public.provider_invitation_code_settings
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_invitation_code_setting_audit
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.provider_invitation_code_settings,
           public.provider_invitation_code_setting_audit
  FROM PUBLIC;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.provider_invitation_code_settings, public.provider_invitation_code_setting_audit FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.provider_invitation_code_settings, public.provider_invitation_code_setting_audit FROM authenticated';
  END IF;
END
$migration$;

COMMIT;
