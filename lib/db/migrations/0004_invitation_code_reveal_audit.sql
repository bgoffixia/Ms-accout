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
