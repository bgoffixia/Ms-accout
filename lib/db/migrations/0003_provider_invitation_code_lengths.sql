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
