---
name: Generated API type freshness
description: Keep generated API client declarations aligned with the canonical OpenAPI contract.
---

When a frontend typecheck reports that an API response field is missing, first compare the current OpenAPI contract with the generated client declarations. Regenerate the client and library declarations before changing an API contract or adding handwritten types.

**Why:** The contract already included settings and status fields used by the app, but the leaf package still compiled against stale generated declarations.

**How to apply:** If the canonical contract contains the property and generated output disagrees, run the workspace API codegen command and its library check; do not make a database or API-default change just to silence the stale type error.
