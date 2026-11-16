-- Additive enrollment metadata migration.
-- Deliberately retain legacy PIN columns and values for now: application code
-- no longer maps, reads, writes, or returns them. A separately reviewed cleanup
-- migration is required before any legacy secret data is scrubbed or dropped.
BEGIN;

CREATE TABLE IF NOT EXISTS portal_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by_user_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guest_preapplications
  ADD COLUMN IF NOT EXISTS reference_code text;

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS reference_code text;

COMMIT;
