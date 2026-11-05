---
name: Workspace email sender
description: Outbound staff email provider and safe retry behavior.
---

Use the connected Google Workspace Gmail mailbox as the sender for staff alerts and one-off mail. Derive the From address from the authenticated mailbox profile rather than allowing arbitrary sender identities. Gmail sends are non-idempotent: use a stable Message-ID and check the Sent folder before retrying an uncertain send; do not automatically retry send requests.

**Why:** The user asked for staff mail to come directly from the connected Workspace account, and Gmail can accept a send even when the caller loses its response.

**How to apply:** Keep the sender tied to the connected mailbox in mail settings and send paths. Before retrying a possibly accepted Gmail send, search Sent using its stable RFC Message-ID.
