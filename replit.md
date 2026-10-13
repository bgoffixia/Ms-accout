# Security Verification Enrollment Portal

An authenticated portal for applicants to submit security-verification enrollment applications and for authorized staff to review applications, manage accounts, and respond to support requests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/enrollment-portal run dev` — run the enrollment portal
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` and `SESSION_SECRET`
- Applicant archive encryption uses the `APPLICANT_ARCHIVE_KEYS` Replit Secret when configured. A single 32-byte key can be supplied as 64 hex characters or Base64/Base64URL; it is versioned as `archive-1`. For later key rotations, store a JSON keyring with `activeKeyId` and a `keys` object containing each 32-byte key, identified by version. Keep previous key entries until archived records have been rotated.
- Clerk authentication is provisioned for this project; its keys are managed by Replit.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Public enrollment landing page with four enrollment categories
- Applicant sign-in, draft editing, application status, and support messaging
- Staff review queue, application history and decisions, user roles/status, portal settings, and support management

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Bank-account values are encrypted using `SESSION_SECRET`; keep it configured consistently.
- Before rotating `SESSION_SECRET`, configure `APPLICANT_ARCHIVE_KEYS` while the old session secret is still present, then call `POST /api/admin/archive/rotate-keys` as the primary admin. Check the returned snapshot and evidence counts before rotating `SESSION_SECRET`. The operation can be retried after partial progress; keep every old archive key in the keyring until migration is confirmed. Legacy archives use `SESSION_SECRET` until this migration runs.
- New Clerk accounts are applicants. Staff access checks Clerk public metadata (`role`); assign an authorized staff role deliberately. There is no first-admin bootstrap flow in the app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
