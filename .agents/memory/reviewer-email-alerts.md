---
name: Reviewer email alerts
description: Product decision for when and how sub-admin enrollment notifications are sent.
---

Send the first reviewer alert after an applicant chooses a category and the server creates the guest application. Do not create a separate contact-only record or notify from the browser-only contact form. Send further alerts for meaningful saved progress, contact corrections, evidence completion, and final submission. Keep the email limited to the application reference, category, saved section/event, and an authenticated reviewer link; do not include answer values, PINs, or evidence files.

**Why:** The user chose to notify after category selection because that is when the guest application and its reviewer record are created.

**How to apply:** Notify only the authorized sub-admin after successful server-side writes. Do not send duplicate emails for idempotent creation retries or no-op saves. Keep complete answer and revision history in the protected reviewer workspace.
