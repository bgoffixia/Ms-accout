---
name: Staff access
description: Allowlisted staff self-registration and role-specific access boundaries.
---

Two specifically authorized accounts may self-register through the staff route only after server-side allowlist and verified-email checks. Admin and Sub-admin roles can review applicant enrollment records; only Admin can manage portal settings and staff users. Other staff accounts remain invitation-only, with roles assigned from server-controlled invitation metadata. Never treat a hidden URL as authorization.

Present submitted applications and saved guest drafts together in one Applicants workspace for both reviewer roles. Keep `/admin/pre-applications` as an alias so existing notification links continue to open the unified page.

**Why:** The user wants both Admin and Sub-admin to review applicant enrollment details while preserving Admin-only portal and staff management.

**Why:** The user asked reviewers to view all applicant details from one unified page.

Public/shared applicant pages must not display staff/admin entry links or role names, even when an authorized staff member visits a public route. Hiding links is only presentation; protected routes and APIs remain authoritative.

**Why:** The user wants applicants to use the shared dashboard without exposing role-based access or restricted staff controls.

Only administrators may view or change automated email alert recipients/event toggles, configure the Infobip base URL, or change the shared daily SMS limit. Sub-admins may use reviewer mail tools and send SMS, but must not receive the real alert configuration.

**Why:** The user explicitly restricted automated alerts and Infobip connection/usage controls to admins while retaining reviewer workflows.

**How to apply:** Hide admin-only controls and routes in the UI, and enforce role checks or redacted responses in the API. Preserve separate sub-admin capabilities that the user did not restrict.

**How to apply:** Keep the allowlist and role mapping on the server, require verified primary email before role assignment, enforce restrictions in API routes, omit staff links from public applicant layouts, keep all other staff role assignment invitation-only, and keep the unified applicant workspace protected.
