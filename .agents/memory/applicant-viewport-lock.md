---
name: Applicant viewport locking
description: Browser behavior and verification approach for keeping applicant pages within one viewport.
---

Lock the page body to the viewport when the portal must not scroll as a document, and keep scrolling enabled only on intentional content panels. In Chromium, `overflow: hidden` on the root alone can still allow `window.scrollTo` to move the page when descendants extend the root scroll area.

**Why:** A short-screen browser test found that the wizard shell and preview panel fit the viewport while the root document still moved under programmatic scrolling.

**How to apply:** For fixed-viewport applicant flows, verify the document cannot move with a root scroll attempt and that long content remains reachable through its designated inner scroll panel.
