---
name: Reviewer email alerts
description: Product decision for when and how sub-admin enrollment notifications are sent.
---

Send the first reviewer alert after an applicant chooses a category and the server creates the guest application. Do not create a separate contact-only record or notify from the browser-only contact form. Send further alerts for meaningful saved progress, contact corrections, evidence completion, and final submission. Keep the email limited to the application reference, category, saved section/event, and an authenticated reviewer link; do not include answer values, PINs, or evidence files.

When a reviewer opens an alert while signed out, preserve the requested reviewer page through sign-in. Allow only the reviewer queue, guest follow-up page, and UUID application-detail paths as return destinations; the normal role gate must still authorize the page after sign-in.

**Why:** The user chose to notify after category selection because that is when the guest application and its reviewer record are created.

**Why:** The user asked that in-app sub-admin review continue to work from notification links; staff who need to sign in should return to the intended record without weakening role checks.

**How to apply:** Notify only the authorized sub-admin after successful server-side writes. Do not send duplicate emails for idempotent creation retries or no-op saves. Keep complete answer and revision history in the protected reviewer workspace. Restrict post-login return paths to known reviewer routes and enforce authorization in the UI and API.
