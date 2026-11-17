---
name: Guest applicant path
description: Product requirements for account-free enrollment, evidence collection, and private-key status access.
---

Guest applicants can submit the full enrollment without signing in. Authenticated applicant flows continue to rely on Clerk. The account-provider PIN and applicant access-code systems are retired; Reference Code is non-secret tracking metadata only. A new guest application receives a cryptographically random 256-bit tracking key, shown once, and the server stores only its SHA-256 hash. Require both application reference and tracking key for guest lookup, status, draft edits, email corrections, and evidence operations. The key is not identity proof or general authentication, and must never be sent by email or shown to staff/reviewers.

Within one active applicant session, passing contact details must not send applicants back to that form through browser navigation or repeated start links. They may choose to return to the portal home, and reloading a public guest page should land on the portal home.

Applicants may advance through enrollment steps with incomplete fields. Submit confirms and saves the application without email OTP. Save each step and correction for authorized reviewers, retaining previous entries while keeping credentials and internal notes private. Existing legacy applicant access-code columns and the throttling table remain in the schema for compatibility only; runtime code must not read, write, or expose them. Do not drop or scrub legacy credential data without a separately reviewed, approved migration and rollback plan.

**Why:** The user explicitly replaced the six-digit applicant access code with a high-entropy private tracking key, removed provider PIN collection, kept Clerk for authenticated access, and required a safe legacy recovery path. Existing database rows and old credential columns must not be destructively changed as part of the application-code replacement.

**How to apply:** Generate tracking keys with a cryptographically secure random source, hash them server-side, compare hashes safely, and return plaintext only for initial display or an explicit replacement flow. Replacing a key requires an explicit applicant action plus the same verified Clerk email as the application; it invalidates the old key. Legacy rows with no tracking-key hash can use this same verified-email recovery path. Never silently reset or transfer a key. Keep recovery separate from guest operations that require reference plus key. Preserve reviewer/admin role checks, application records, step history, and private evidence. Reviewers may see submitted application details and evidence, but never PINs, access-code hashes, tracking keys, or plaintext credentials.
