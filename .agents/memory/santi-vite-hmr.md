---
name: SANTI Vite Fast Refresh
description: Keep React component modules compatible with Vite Fast Refresh in the SANTI artifact.
---

Keep static demo configuration and other non-component exports in a separate module from React components that Vite hot-reloads.

**Why:** Vite's React plugin invalidates component modules that also export incompatible non-component values; this can force a page reload during updates and appear as a runtime crash.

**How to apply:** When adding SANTI module definitions or similar static data, put the data in its own file and import it into the component.
