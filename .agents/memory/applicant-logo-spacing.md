---
name: Applicant logo spacing
description: Reserve form space according to configured logo size in reference-style entry layouts.
---

Reference-style category entry screens position logos and form content independently. When administrators can change the logo size, the form start must account for the logo’s rendered height and leave a clear gap before the first field.

**Why:** Mobile browser checks found logos overlapping inputs when static top percentages no longer matched the selected logo size.

**How to apply:** For reference-style layouts, calculate the form start from the logo position, viewport-constrained rendered height, and a gap. Verify the logo does not overlap fields, actions, or PIN keypads at narrow viewport sizes.
