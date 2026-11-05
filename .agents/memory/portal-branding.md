---
name: Portal branding
description: Product name and wording conventions for the enrollment portal.
---

Use the exact product brand “M-soft Account Protection” with the subtitle “Bank Grade Security System” across applicant-facing branding, browser metadata, artifact naming, and staff email defaults. Use “Account Provider” in applicant and staff display copy instead of “Category”; retain the existing category IDs, routes, and data fields. Retain “Security Verification” wording where it describes the applicant’s workflow or status rather than the brand.

Keep the public hero description fixed to “Stay safe. Stay secure. Complete your security verification to strengthen your account protection.” Ignore older saved admin values for the hero and landing-description fields.

**Why:** The user set the product brand, subtitle, and “Account Provider” display terminology, and explicitly asked that the exact development hero copy override production’s saved admin description. Existing enrollment records and API contracts still use category IDs and field names.

**How to apply:** Update visible labels and old built-in defaults together, while preserving internal IDs/contracts, functional status labels, and admin-customized email text that is not an old built-in default. Keep the hero description read-only in settings.
