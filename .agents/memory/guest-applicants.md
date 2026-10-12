---
name: Guest applicant path
description: Product requirements for account-free enrollment, evidence collection, and email verification.
---

Applicants can complete all enrollment details, the category PIN, and required private identity evidence/video without creating an account. The first screen collects only full name and email, then continues to a separate category-selection screen. Clerk email verification of that same contact email is required only for final submission and account linking; failure to verify must leave the saved draft and evidence available to authorized reviewers.

**Why:** The user asked applicants to complete the enrollment and evidence before Clerk OTP verification, while ensuring verification failure does not block saving other details to authorized review.

**How to apply:** Save each guest step and private evidence server-side before routing to Clerk. Link only a verified primary email matching the contact email; keep drafts reviewer-visible if verification fails. Protect resume access with the private tracking key, never store PIN plaintext, and do not add category, phone, or evidence fields to the first contact screen.
