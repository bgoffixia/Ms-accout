---
name: Workspace email sender
description: Outbound staff email provider and safe retry behavior.
---

Use the connected Google Workspace Gmail mailbox as the only sender for staff alerts and one-off mail; do not reintroduce Resend. Derive the From address from the authenticated mailbox profile rather than allowing arbitrary sender identities. Gmail sends are non-idempotent: use a stable Message-ID and check the Sent folder before retrying an uncertain send; do not automatically retry send requests. The Mail center shows sent/failed attempts only; keep legacy provider-event records hidden and retained unless the user explicitly requests their deletion.

**Why:** The user asked for staff mail to come directly from the connected Workspace account and later requested removing Resend and its Mail center activity; Gmail can accept a send even when the caller loses its response.

**How to apply:** Keep the sender tied to the connected mailbox in mail settings and send paths. Before retrying a possibly accepted Gmail send, search Sent using its stable RFC Message-ID. Do not expose legacy provider delivery events in staff email activity.
