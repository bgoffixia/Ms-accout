---
name: Browser test authentication
description: Keep simulated staff authentication confined to isolated browser-test servers.
---

For browser tests of signed-in staff pages, load a test-only Clerk adapter on a dedicated Playwright server and keep the normal browser suite on the real Clerk implementation. Restrict the alias to development mode; never ship a test authentication bypass in production.

**Why:** Guest enrollment browser tests exercise Clerk verification behavior, while staff editor tests need a deterministic admin session without using a real account. Mixing those needs would weaken or destabilize the real auth coverage.

**How to apply:** Run staff-authenticated browser cases with a separate Vite process, dedicated port, and test-only alias. Keep server authorization and persistence covered by API route tests as well.
