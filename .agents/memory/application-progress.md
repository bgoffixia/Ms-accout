---
name: Applicant progress visibility
description: The enrollment workflow must preserve applicant progress and limit reviewer access to authorized staff.
---

Persist application answers and progress on the server as applicants save steps. Make guest answers available only to key-authenticated applicants and the authorized enrollment reviewer; keep staff review role restrictions intact.

**Why:** The user asked that every applicant's steps be saved for the authorized admin/reviewer.

**How to apply:** Keep ownership or private-key checks on save and read routes, include in-progress applications in the authorized review view, and never return unmasked bank account numbers to applicants or the guest follow-up list.
