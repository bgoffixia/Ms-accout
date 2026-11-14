# Vercel deployment

This repository is a pnpm monorepo. The root Vercel project deploys the Vite
enrollment portal as static assets and exposes the Express API as a Vercel
Node.js Function.

## Vercel project settings

- Repository: `bgoffixia/Ms-accout`
- Production branch: `main` (or merge the deployment branch first)
- Root Directory: `./`
- Framework Preset: Other
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @workspace/enrollment-portal build`
- Output Directory: `artifacts/enrollment-portal/dist/public`
- Include files outside the Root Directory: enabled (if shown)

The checked-in `vercel.json` contains these build settings.

## Environment variables

Add the application's required secrets in Vercel Project Settings → Environment
Variables. At minimum, review the existing application configuration and set
the production values for Clerk, database, payment, messaging, storage, and
other integrations actually enabled in this deployment. Do not commit secrets
or copy values from local/Replit configuration into Git.

Set frontend variables with the exact `VITE_` names referenced by the client
source. Set server-only variables without the `VITE_` prefix. Never expose
secret keys through `VITE_` variables.

The Vite build uses `BASE_PATH=/` and a build-time port fallback when Vercel
does not provide Replit's `BASE_PATH` and `PORT` variables.

## API and SPA routing

- `api/[...path].ts` exports the existing Express app as a Vercel function.
- Requests under `/api/*` are handled by the Express router.
- Other paths fall back to the SPA's `index.html`.

Configure the frontend to call the API using same-origin relative `/api` URLs
(or the production API origin if you later split the services).

## Important production checks

1. Confirm the Vercel Node.js runtime supports all dependencies used by the API.
2. Provision a production PostgreSQL database and apply the repository's Drizzle
   migrations/schema procedure before directing production traffic.
3. Configure Clerk production domain, allowed origins, webhook URLs, and proxy
   settings for the deployed hostname.
4. Verify payment and messaging provider callback URLs and production credentials.
5. Test authentication, database-backed flows, uploads, webhooks, and API routes
   in a Vercel preview before promoting to production.

Vercel deployment does not automatically provision external services or migrate
the database. Scheduled cleanup jobs and long-running/background work also need
to be moved to a Vercel-compatible scheduled function or external worker if they
are required in production.
