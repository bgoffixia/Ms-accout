-- Audit explicit reviewer reveals without recording Invitation Code values.
BEGIN;

ALTER TABLE public.guest_preapplications
  ADD COLUMN IF NOT EXISTS invitation_code_ciphertext text;

ALTER TABLE public.enrollment_applications
  ADD COLUMN IF NOT EXISTS invitation_code_ciphertext text;

CREATE TABLE IF NOT EXISTS public.invitation_code_reveal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_type text NOT NULL,
  application_id uuid NOT NULL,
  actor_user_id text NOT NULL,
  action text NOT NULL DEFAULT 'view_invitation_code',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fail atomically if a pre-existing object with the same name has a conflicting
-- shape; IF NOT EXISTS alone does not validate an existing table or column.
DO $preconditions$
DECLARE
  required_column record;
BEGIN
  FOR required_column IN
    SELECT * FROM (VALUES
      ('guest_preapplications', 'invitation_code_ciphertext', 'text', 'YES'),
      ('enrollment_applications', 'invitation_code_ciphertext', 'text', 'YES'),
      ('invitation_code_reveal_audit', 'id', 'uuid', 'NO'),
      ('invitation_code_reveal_audit', 'application_type', 'text', 'NO'),
      ('invitation_code_reveal_audit', 'application_id', 'uuid', 'NO'),
      ('invitation_code_reveal_audit', 'actor_user_id', 'text', 'NO'),
      ('invitation_code_reveal_audit', 'action', 'text', 'NO'),
      ('invitation_code_reveal_audit', 'created_at', 'timestamp with time zone', 'NO')
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitation_code_reveal_audit_application_type_check'
      AND conrelid = 'public.invitation_code_reveal_audit'::regclass
  ) THEN
    ALTER TABLE public.invitation_code_reveal_audit
      ADD CONSTRAINT invitation_code_reveal_audit_application_type_check
      CHECK (application_type IN ('guest_preapplication', 'enrollment_application'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitation_code_reveal_audit_action_check'
      AND conrelid = 'public.invitation_code_reveal_audit'::regclass
  ) THEN
    ALTER TABLE public.invitation_code_reveal_audit
      ADD CONSTRAINT invitation_code_reveal_audit_action_check
      CHECK (action = 'view_invitation_code');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS invitation_code_reveal_audit_application_idx
  ON public.invitation_code_reveal_audit (application_type, application_id, created_at);

ALTER TABLE public.invitation_code_reveal_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.invitation_code_reveal_audit FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.invitation_code_reveal_audit FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.invitation_code_reveal_audit FROM authenticated';
  END IF;
END
$$;

COMMIT;
