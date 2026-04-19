---
description: How to read and write global app state using AppProvider and useApp
---

- All global app state (form inputs, calculation results, pricing, history) lives in `AppProvider` (`src/lib/context.tsx`). Do not create parallel global state with Zustand, Redux, or additional contexts.
- Access global state via the `useApp()` hook — never import the context object directly.
- Local component state (`useState`) is fine for UI-only state: open/closed dialogs, active tabs, hover states.
- Do not store derived values in context. Compute them inline from existing state.
- When adding a new global field: add to the context interface, add default value to the provider, expose setter if needed. Follow the pattern of existing fields exactly.

## Data flow for a calculation

```
User fills form (Index.tsx)
  → inputs written to AppContext via useApp()
  → "Calculate" triggers calculation functions (src/lib/calculations.ts)
  → results written to AppContext
  → Results.tsx reads from AppContext and renders
  → On save: saveEstimate() writes to Firestore and appends to history in context
```
