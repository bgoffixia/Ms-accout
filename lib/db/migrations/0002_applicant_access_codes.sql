-- Applicant-owned application access codes.
-- Codes are stored only as salted one-way KDF hashes. This migration does not
-- modify legacy provider-PIN columns or existing application records.
BEGIN;

ALTER TABLE guest_preapplications
  ADD COLUMN IF NOT EXISTS applicant_access_code_hash text;

-- Keep historical guest keys available only for the explicit upgrade flow.
-- New guest records no longer receive legacy tracking-key hashes.
ALTER TABLE guest_preapplications
  ALTER COLUMN access_key_hash DROP NOT NULL;

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS applicant_access_code_hash text;

CREATE TABLE IF NOT EXISTS applicant_access_code_attempts (
  reference_key text NOT NULL,
  ip_key text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_access_code_attempts_pk
    PRIMARY KEY (reference_key, ip_key),
  CONSTRAINT applicant_access_code_attempts_failed_attempts_check
    CHECK (failed_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS applicant_access_code_attempts_updated_idx
  ON applicant_access_code_attempts (updated_at);

COMMIT;
