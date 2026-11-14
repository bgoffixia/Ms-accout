# Supabase PostgreSQL on Vercel

This repository uses PostgreSQL through Drizzle ORM. Supabase is the PostgreSQL host; the application continues to use the existing Drizzle schema and query layer.

## Fresh database policy

Create a **new, empty Supabase project/database** for this deployment. The initial migration creates the tables and indexes currently declared in `lib/db/src/schema`. It does not import records from the former database, and it does not drop or modify the former database. Do not run this initial migration against a database that contains production data.

## 1. Create the Supabase project

1. Create a project in the Supabase dashboard and choose a region close to the majority of your users and Vercel functions.
2. Set a strong database password and store it in a password manager.
3. Wait for the database to finish provisioning.
4. In **Project Settings → Database → Connection string**, select the URI format.

## 2. Configure connection strings

Set these server-side environment variables:

| Variable | Purpose | Supabase connection |
| --- | --- | --- |
| `DATABASE_URL` | Vercel application runtime | Transaction Pooler (port `6543`) |
| `DIRECT_DATABASE_URL` | Drizzle schema migrations | Direct connection (port `5432`) or Session Pooler |

Use the exact URI shown by Supabase for your project and replace its password placeholder. Keep `sslmode=require` enabled. If your network does not support IPv6, use the Supabase Session/Transaction Pooler URI rather than the direct database hostname.

Never commit real connection strings. Never expose either variable with a `VITE_` prefix or to browser code. Add both variables to Vercel **Project → Settings → Environment Variables** for Production and Preview as appropriate, then redeploy after saving them.

The runtime pool is intentionally small on Vercel (one connection per warm function instance) to reduce connection exhaustion under serverless scaling. Local/non-Vercel processes use a pool maximum of ten.

## 3. Apply the initial schema

From the repository root, install dependencies and run the committed initial migration against the new, empty database:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db migrate
```

The migration command reads `DIRECT_DATABASE_URL` first. Confirm that the migration completes before deploying the application. Do not use `push-force` against a production database.

For future schema changes:
1. Update the Drizzle models under `lib/db/src/schema`.
2. Generate and review a migration with `pnpm --filter @workspace/db generate`.
3. Commit the generated SQL and migration metadata.
4. Apply it to staging first, then production with `pnpm --filter @workspace/db migrate`.

## 4. Vercel deployment

1. Import `bgoffixia/Ms-accout` into Vercel.
2. Use `main` as the production branch after the deployment PR is merged. Use `vercel/deployment` only for the deployment branch workflow.
3. Keep the repository's `vercel.json` build/install settings.
4. Add `DATABASE_URL` to Vercel server-side environment variables. Add `DIRECT_DATABASE_URL` only if migrations are intentionally run from a trusted deployment/CI environment; it is not needed by application requests.
5. Deploy and verify the API health endpoint and an application flow that reads/writes the database.

## 5. Verification checklist

- [ ] New Supabase project is empty before the initial migration.
- [ ] `DIRECT_DATABASE_URL` connects to the intended new project.
- [ ] `pnpm --filter @workspace/db migrate` completes successfully.
- [ ] Supabase shows the expected tables, enums, indexes, and `drizzle` migration history.
- [ ] Vercel Production has the Transaction Pooler URI as `DATABASE_URL`.
- [ ] Vercel build and deployment succeed.
- [ ] Authenticated and guest enrollment flows can read/write the database.
- [ ] No database password or service credential appears in Git history or browser bundles.

## Scope and external services

This change configures PostgreSQL only. Clerk authentication, Google Cloud object storage, email/SMS providers, and their existing environment variables remain separate integrations and must each be configured with production credentials before their features are used. Supabase Storage is not implicitly enabled by this database setup.
