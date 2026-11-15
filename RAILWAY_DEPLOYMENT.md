# Railway production deployment

This repository can run as one Railway web service: the Express API serves the
built Vite frontend, and a separate Railway-managed PostgreSQL service provides
the database. The root `Dockerfile` builds both workspace packages.

## 1. Create Railway services

1. Create a Railway project.
2. Add a PostgreSQL service.
3. Add a service from GitHub and connect `bgoffixia/Ms-accout`, branch `main`.
4. Keep the repository root as the service root so the root Dockerfile and
   pnpm workspace are available.
5. Generate a public domain for the application service.

Railway detects the root `Dockerfile`. New commits on the connected branch
trigger deployments automatically.

## 2. Connect PostgreSQL

In the application service's Variables tab, add a reference variable:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Replace `Postgres` with the exact name of the PostgreSQL service in Railway.
Do not paste database credentials into Git.

## 3. Configure application secrets

Set the production values required by the integrations enabled in the source:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL` (reference the Railway PostgreSQL service)
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (service-account JSON with least-privilege
  access to the configured Cloud Storage buckets)
- `PUBLIC_OBJECT_SEARCH_PATHS` (comma-separated bucket object prefixes)
- `PRIVATE_OBJECT_DIR` (private bucket object prefix)

The API's object-storage integration now uses Google Cloud Storage's native
V4 signed URLs and Google Application Default Credentials instead of Replit's
local credential/signing sidecar. The service account must have permission to
read/write the relevant objects and create signed URLs. If using
`GOOGLE_APPLICATION_CREDENTIALS` instead of the JSON variable, provide the
credentials file through a secure mounted secret.

Review the API source for any additional provider-specific environment
variables used by email, SMS, payment, webhook, or administrative integrations.
Set only the production credentials for services that are actually enabled.
Never put server secrets in `VITE_*` variables or commit them to Git.

## 4. Database schema

The workspace database package provides:

```sh
pnpm --filter @workspace/db push
```

Run this once against the new production database after reviewing the schema
changes and confirming the target database is empty or backed up. It is not
configured as an automatic pre-deploy command because schema pushes can alter
existing production tables.

## 5. Runtime behavior

- The API listens on Railway's injected `PORT` and binds to `0.0.0.0`.
- The frontend is served from the same origin as the API.
- The Railway health check uses `/api/healthz`.
- Frontend API requests should remain relative to `/api`.
- The service starts the existing guest-evidence cleanup worker after startup.

## 6. Production verification checklist

Before inviting real applicants:

- Confirm the Railway build and deployment are healthy.
- Confirm `/api/healthz` returns `{"status":"ok"}`.
- Apply and verify the Drizzle schema.
- Verify Clerk production keys, allowed origins, and webhook settings.
- Verify Google Cloud Storage upload, download, signed URL, and ACL behavior.
- Verify email/SMS/payment integrations and callbacks where enabled.
- Test enrollment, applicant login, staff/admin access, evidence uploads, and
  application review flows using non-production test accounts.
- Enable database backups and test a restore procedure.

A Railway deployment does not create third-party credentials, configure Clerk
domains, provision Google Cloud Storage buckets, or migrate an existing
database automatically.
