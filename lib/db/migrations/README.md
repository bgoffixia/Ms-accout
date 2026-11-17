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
columns and lockout table remain represented in the Drizzle schema solely to
avoid destructive drift against databases where that migration was applied.
The current application no longer reads or writes applicant access-code hashes
or the lockout table; neither this migration nor a schema push should be run
again for the private tracking-key implementation. Existing guest
`access_key_hash` values remain intact and continue to authorize guest access.
For old guest records without a tracking-key hash, recovery requires the
applicant to sign in with the same verified Clerk email; recovery adds a new
tracking-key hash without exposing or changing the legacy access-code hash.

The historical lockout table has row-level security enabled, with no policies
for ordinary roles, and explicit privileges revoked from `PUBLIC` and, when
present, `anon` and `authenticated`. Do not remove this table or its columns
until a separate, reviewed migration confirms no deployed version or rollback
path needs them. No database migration or production mutation is authorized by
the tracking-key implementation request.
