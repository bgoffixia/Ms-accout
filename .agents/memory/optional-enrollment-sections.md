---
name: Optional enrollment sections
description: Keep the enrollment wizard's completion logic consistent with applicant-facing optional-section copy.
---

When a wizard section is described as optional, the final submission gate must treat it as complete when left blank. For next of kin, collect name, relationship, phone, and optional email only; do not request address, city, or region in the applicant workflow.

**Why:** A browser journey exposed that the bank-details screen said it was optional, while the readiness check still required bank name and account holder, preventing applicants from submitting. The user also limited next-of-kin information to identity and contact details to avoid unnecessary location collection.

**How to apply:** When changing section copy, schema validation, or completion logic, verify the same optional/required behavior is reflected in the final submission readiness check. Keep the next-of-kin form, applicant preview, staff field settings, and server validation aligned with the name, relationship, and contact-only scope.
