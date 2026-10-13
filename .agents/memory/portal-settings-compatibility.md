---
name: Portal settings compatibility
description: Backward-compatibility rules for persisted applicant portal settings.
---

When adding portal settings, treat omitted new fields as legacy data rather than malformed configuration. Keep existing screen-copy scopes as fallbacks when introducing more specific applicant pages, and use safe defaults for new optional rules.

**Why:** Saved portal settings predate newer guest-applicant pages and required-field rules; old records must continue to work without an admin resaving them.

**How to apply:** Normalize absent configuration on reads and writes, preserve older copy keys as fallbacks, and test a settings record that lacks the new fields.
