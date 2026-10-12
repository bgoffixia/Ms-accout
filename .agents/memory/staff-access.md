---
name: Staff access
description: Allowlisted staff self-registration and role-specific access boundaries.
---

Two specifically authorized accounts may self-register through the staff route only after server-side allowlist and verified-email checks. The Admin role manages portal settings and staff users but cannot review enrollment; the Sub-admin role can review enrollment but cannot change settings or staff users. Other staff accounts remain invitation-only, with roles assigned from server-controlled invitation metadata. Never treat a hidden URL as authorization.

**Why:** The user assigned separate management and enrollment-review responsibilities to the two allowlisted self-signup accounts.

**How to apply:** Keep the allowlist and role mapping on the server, require verified primary email before role assignment, enforce these restrictions in API routes as well as navigation, and keep all other staff role assignment invitation-only.
