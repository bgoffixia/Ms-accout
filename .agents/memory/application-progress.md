---
name: Applicant progress visibility
description: The enrollment workflow must preserve applicant progress and limit reviewer access to authorized staff.
---

Persist application answers and progress on the server as applicants save steps. Preserve first-screen contact name, email, and phone in the linked submitted review record, and make guest answers available only to key-authenticated applicants and the authorized enrollment reviewer; keep staff review role restrictions intact.

**Why:** The user asked that every applicant's steps and contact details be saved for the authorized sub-admin reviewer through review and approval.

**How to apply:** Keep ownership or private-key checks on save and read routes, include in-progress applications in the authorized review view, carry canonical guest contact details into the final reviewer record, and never return raw PINs or unmasked bank account numbers to applicants or the guest follow-up list.
