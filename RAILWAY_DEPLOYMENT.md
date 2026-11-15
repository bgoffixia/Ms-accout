# Railway production deployment

This repository runs as one Railway web service: the Express API serves the
built Vite frontend, Railway PostgreSQL provides the application database, and
Supabase Storage stores uploaded evidence and email-branding files.

## 1. Railway services

- Connect \`bgoffixia/Ms-accout\`, branch \`main\`, to the Railway \`m-soft-app\` service.
- Keep the repository root as the service root so the root Dockerfile and pnpm
  workspace are available.
- Railway detects the root \`Dockerfile\`; new commits on \`main\` trigger deployments.
- The application listens on Railway's injected \`PORT\` and binds to \`0.0.0.0\`.
- The Railway health check uses \`/api/healthz\`.

## 2. Railway PostgreSQL

The application database remains Railway PostgreSQL. In the app service's
Variables tab, keep:

\`\`\`
DATABASE_URL=\${{Postgres.DATABASE_URL}}
\`\`\`

Replace \`Postgres\` with the exact name of the Railway PostgreSQL service if it
has been renamed. Do not commit database credentials.

## 3. Supabase Storage

The selected Supabase project is \`ms-accout-production\` in \`ap-south-1\`.

Set these variables on Railway's \`m-soft-app\` service:

- \`SUPABASE_URL=https://uxmuqrzapklifcmpxclr.supabase.co\`
- \`SUPABASE_SERVICE_ROLE_KEY\` — the server-only Supabase \`service_role\` key.
  Add it through Railway's Variables UI; never commit it or expose it in
  frontend \`VITE_*\` variables.
- \`DEFAULT_OBJECT_STORAGE_BUCKET_ID=msoft-private\`
- \`PRIVATE_OBJECT_DIR=msoft-private/objects\`

The API creates the \`msoft-private\` bucket on the first upload if it does not
exist. The bucket is private, with a 200 MB file-size limit and the evidence
MIME types used by the enrollment workflow. Downloads remain server-mediated
through the existing reviewer/guest authorization routes.

The service-role key bypasses Storage RLS. It is used only by the trusted
Railway API server. Do not put it in the browser, client bundles, or source
control.

## 4. Authentication and other integrations

Set the production credentials required by the integrations enabled in source:

- \`CLERK_PUBLISHABLE_KEY\`
- \`CLERK_SECRET_KEY\`
- \`DATABASE_URL\` (Railway PostgreSQL reference)
- \`SUPABASE_URL\`
- \`SUPABASE_SERVICE_ROLE_KEY\`
- \`DEFAULT_OBJECT_STORAGE_BUCKET_ID\`
- \`PRIVATE_OBJECT_DIR\`

Review the API source for any additional provider-specific environment
variables used by email, SMS, payment, webhook, or administrative integrations.
Set only production credentials for services actually enabled.

## 5. Database schema

The workspace database package provides:

\`\`\`sh
pnpm --filter @workspace/db push
\`\`\`

Run this once against the new Railway PostgreSQL database after reviewing the
schema changes and confirming the target database is empty or backed up. Do
not point this command at the Supabase Storage project: application records
remain in Railway PostgreSQL.

## 6. Existing Google Cloud objects

Switching the storage adapter does not copy objects from an existing Google
Cloud Storage bucket. If the previous bucket contains files referenced by
application records, copy those objects into the matching paths in
\`msoft-private\` before retiring the old bucket. The database object paths are
kept in the \`/objects/...\` format so new uploads and downloads continue using
the existing application routes.

## 7. Production verification checklist

Before inviting real applicants:

- Confirm the Railway build and deployment are healthy.
- Confirm \`/api/healthz\` returns \`{"status":"ok"}\`.
- Apply and verify the Drizzle schema on Railway PostgreSQL.
- Verify Clerk production keys, allowed origins, and webhook settings.
- Verify Supabase private-bucket creation, signed upload, file metadata,
  evidence signature checks, downloads, and cleanup.
- Verify email/SMS/payment integrations and callbacks where enabled.
- Test enrollment, applicant login, staff/admin access, evidence uploads, and
  application review flows using non-production test accounts.
- Enable Railway database backups and test a restore procedure.

A Railway deployment does not create third-party credentials, configure Clerk
domains, or migrate existing Google Cloud Storage objects automatically.
