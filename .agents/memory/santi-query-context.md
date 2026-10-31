---
name: SANTI React Query context
description: Ensure generated API hooks and SANTI components share one TanStack Query context.
---

Keep a single `QueryClientProvider` above the SANTI app root and deduplicate `@tanstack/react-query` in Vite.

**Why:** The generated API client imports TanStack Query independently; separate module instances can make hooks fail to see the provider even when the component tree appears wrapped.

**How to apply:** When wiring API hooks or changing the SANTI entrypoint, verify the root provider, Vite dedupe setting, and runtime dependency declaration together.
