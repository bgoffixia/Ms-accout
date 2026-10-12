---
name: Guest applicant path
description: Product requirements for account-free enrollment, evidence collection, and email verification.
---

Applicants can complete all enrollment details, the category PIN, and required private identity evidence/video without creating an account. The first screen collects only full name and email, then continues to a separate category-selection screen. Clerk email verification of that same contact email is required for final submission and account linking; failure or postponement must leave the saved draft and evidence available to authorized reviewers.

Applicants may advance through enrollment steps with incomplete fields. After Clerk verification, partial applications may be submitted if the category PIN is present; missing details, evidence, or declaration must remain visible as outstanding requirements. Save every step and correction for authorized reviewers, retaining prior entries so they can compare changes. Verified applicants should see their status, verification progress, and applicant-facing reviewer follow-up, while internal notes remain private. Never include raw PINs in reviewer history or store them in plaintext.

**Why:** The user asked applicants to complete enrollment without losing work to failed or postponed OTP, permit incomplete submission after verification while requiring the PIN, and let reviewers see corrections and verified applicants track progress.

**How to apply:** Save each guest step and private evidence server-side before and during Clerk verification. Link only a verified primary email matching the contact email; keep drafts reviewer-visible if verification fails. Protect resume access with the private tracking key, preserve safe prior values for reviewer comparison, and keep internal reviewer notes private. Require the category PIN for submission without requiring other application fields, evidence, or declaration to be complete. Never store raw PINs. Do not add category, phone, or evidence fields to the first contact screen.
