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
- New Clerk accounts are applicants. Staff access checks Clerk public metadata (`role`); assign an authorized staff role deliberately. There is no first-admin bootstrap flow in the app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
