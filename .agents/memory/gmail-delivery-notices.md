---
name: Gmail delivery notices
description: Limits and handling rules for delivery and bounce results from Workspace email.
---

Gmail's API send response confirms acceptance by Gmail, not delivery to the recipient. Update activity to delivered or bounced only from an explicit delivery-status notice matched to the stable RFC Message-ID; never infer delivery from a sent-folder entry or the absence of a bounce. Positive DSNs depend on the receiving mail server and are not guaranteed.

**Why:** Workspace API sends do not provide a guaranteed delivery callback, and many recipient servers do not return positive DSNs.

**How to apply:** For guaranteed positive delivery reporting, use a sender that supplies supported delivery webhooks or another explicit recipient-server signal.
