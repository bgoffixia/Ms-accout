---
name: Optional enrollment sections
description: Keep the enrollment wizard's completion logic consistent with applicant-facing optional-section copy.
---

When a wizard section is described as optional, the final submission gate must treat it as complete when left blank.

**Why:** A browser journey exposed that the bank-details screen said it was optional, while the readiness check still required bank name and account holder, preventing applicants from submitting.

**How to apply:** When changing section copy, schema validation, or completion logic, verify the same optional/required behavior is reflected in the final submission readiness check.
