# Enrollment schema migration

`0001_reference_code_enrollment.sql` is an additive, idempotent PostgreSQL
migration. It creates `portal_settings` when absent and adds nullable
`reference_code` columns to the two enrollment tables. It does not select a
database, apply itself, or modify legacy PIN columns or their values.

This workspace's existing `@workspace/db` `push` script runs
`drizzle-kit push`, which reconciles the full Drizzle schema. Do not use that
script for this transition: the legacy PIN columns are intentionally no longer
mapped by the application, and schema reconciliation could drop them before a
separate cleanup plan is approved.

Apply the SQL only after independently confirming that the `DATABASE_URL`
target is the intended Railway PostgreSQL database and that the environment
change is approved. Do not point it at the separate Supabase project. A manual
application can use `psql` with the verified connection in the operator's
environment; do not copy the connection string into source or logs.

## Rollback

Rollback the application to the prior build if needed. The prior build's legacy
PIN columns remain in place, and the additive `reference_code` columns and
`portal_settings` table can remain unused without blocking that rollback.
Do not drop the settings table or new columns as part of an automatic rollback:
they may contain configuration or applicant metadata by then. Any later schema
cleanup requires a fresh backup, confirmation that no active build reads the
new columns, and a separately reviewed migration. No legacy PIN values are
read, returned, or changed by this migration or the current application.

`0002_applicant_access_codes.sql` is a historical, additive migration. Its
legacy access-code hash columns and lockout table remain in databases where
that migration was applied, but they are deliberately absent from the runtime
Drizzle schema. This prevents default `.select().from(applicationTable)`
queries from fetching legacy hashes, and no runtime route reads or writes the
lockout table. The migration SQL remains for historical compatibility; do not
rerun it or use `drizzle-kit push`, which could drop the intentionally unmapped
legacy objects. Existing guest `access_key_hash` values remain mapped because
they store the current private tracking-key hash and are required for guest
authorization. For old guest records without a tracking-key hash, recovery
requires the applicant to sign in with the same verified Clerk email; it adds a
new tracking-key hash without reading or changing any legacy access-code hash.

The historical lockout table has row-level security enabled, with no policies
for ordinary roles, and explicit privileges revoked from `PUBLIC` and, when
present, `anon` and `authenticated`. Do not remove this table or its columns
until a separate, reviewed migration confirms no deployed version or rollback
path needs them. No database migration or production mutation is authorized by
the tracking-key implementation request.

`0003_provider_invitation_code_lengths.sql` adds per-provider length settings
and a server-only audit table. It is transactional and idempotent for the
expected schema, verifies required column names/types/nullability before adding
constraints, enables row-level security, and revokes `PUBLIC`, `anon`, and
`authenticated` privileges. The migration runner must own the target tables;
the runtime `DATABASE_URL` role must be the owner or have the required
`SELECT`, `INSERT`, and `UPDATE` privileges. Apply only after verifying the
intended non-production database and approval. This additive schema change does
not rewrite existing rows or Invitation Code values. A restorable backup is
required before the separate data-changing backfill, not for this DDL.

`0004_invitation_code_reveal_audit.sql` adds nullable ciphertext columns for
Invitation Codes and a reviewer-reveal audit table. It is transactional,
idempotent for the expected schema, checks existing column types/nullability,
enables RLS, and revokes `PUBLIC`, `anon`, and `authenticated` privileges on
the audit table. It does not drop legacy `reference_code` columns or application
rows. The migration runner must own the tables and the runtime role must have
the required `SELECT`, `UPDATE`, and audit `INSERT` privileges. New application
writes use authenticated AES-256-GCM ciphertext. Legacy plaintext remains
until the separate operator-run backfill completes.

Before backfill, verify that `0004` is applied to the intended database; both
application tables have `reference_code` and nullable `invitation_code_ciphertext`
text columns; `guest_preapplication_revisions.changes` is JSONB; the runtime
role can select/update those tables; and the same stable `SESSION_SECRET` is
configured for every app instance and retained for future decryptions. Take
and validate a restorable backup, stop or quiesce concurrent edits during the
run, and first review the dry-run counts. The script checks schema/privilege
preconditions and never prints code values. Its dry-run is the default and
reports counts only:

```sh
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/scripts/backfill-legacy-invitation-codes.ts
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/scripts/backfill-legacy-invitation-codes.ts \
  --apply \
  --confirm-database="<verified-current_database>" \
  --confirm-server="<verified-inet_server_addr>" \
  --confirm-user="<verified-current_user>"
```

Apply `0004_invitation_code_reveal_audit.sql` separately before backfill. The
`--apply` operation is per-batch transactional, preserves application rows, and
is safe to rerun; conflicting ciphertext/plaintext pairs abort their batch. It
also redacts Invitation Code values from revision history, which is
intentionally not reversible after commit. Do not remove the old plaintext
columns automatically; leave them nullable for rollback compatibility. If an
older build is restored, the data remains in the database, but that build may
not understand ciphertext values. No migration or backfill runs automatically.

There is no tracking-key backfill: existing guest `access_key_hash` values
already contain hashes and remain usable. Records without a key use the
verified-Clerk-email recovery path, which generates a new key only after an
explicit applicant action.

`0005_application_reviewer_assignments.sql` adds nullable assignment columns
without rewriting existing records. It requires both
application tables and must be applied by a role permitted to alter them; the
runtime role must be able to update each table. PostgreSQL takes a brief
`ACCESS EXCLUSIVE` metadata lock for each `ALTER TABLE`; schedule the migration
when application traffic is low, and do not run it if either table is already
under a long-running transaction. There are no new table-scan indexes.
Existing `reviewer_user_id` decision history is not copied into the assignment
columns. Roll back the app
by stopping use of the new endpoints; leave these additive columns/indexes in
place to preserve assignment history and avoid destructive rollback.

`0006_applicant_form_content_supabase.sql` creates the separate
`public.applicant_form_content` singleton table in Supabase for applicant-facing
form copy. It is additive and transactional, does not touch application tables,
enables RLS, revokes access from `PUBLIC`, `anon`, and `authenticated`, and
grants only `SELECT`, `INSERT`, and `UPDATE` to Supabase `service_role`. The
application runtime pins its form-content REST adapter to the exact host
`uxmuqrzapklifcmpxclr.supabase.co`; it never falls back to `DATABASE_URL`.

Before applying, independently verify the active connection host is
`uxmuqrzapklifcmpxclr.supabase.co` for project `uxmuqrzapklifcmpxclr`
(`ms-accout-production`, `ap-south-1`), confirm a recent restorable backup, and
inspect the existing table schema/privileges. This workspace currently cannot
prove that connection target or apply the migration, so do not run this SQL
until the production Supabase connection is available and verified. The
migration itself validates the expected columns, primary key, checks, and
`service_role`; it aborts transactionally if a pre-existing object is
incompatible. The initial row contains empty JSON and is inserted only when
missing.

Rollback by deploying the previous application build and leaving this additive
table in place. Do not automatically drop it: it may contain administrator
content. A future removal requires a separately reviewed migration, backup, and
confirmation that no deployed version reads the table. No migration or database
write is run automatically by the application code-generation or build steps.
