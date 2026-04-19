---
description: TypeScript conventions, path aliases, and type discipline for this codebase
---

- Use the `@/*` path alias for all internal imports (e.g. `import { useApp } from "@/lib/context"`). Do not use `../../` relative paths across directory boundaries.
- All shared types and interfaces belong in `src/lib/types.ts`. Do not define types inline in page or component files.
- Strict null checks are disabled (`strictNullChecks: false`). Do not rely on this — still guard against `null` and `undefined` explicitly, especially when reading from Firestore.
- `noImplicitAny` is also off. Still annotate function parameters and return types for any function in `src/lib/` — these are the most critical to keep typed.
- Zod validation schemas are co-located with their form component, not in `types.ts`.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and aliases.
