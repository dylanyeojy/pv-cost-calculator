---
description: Rules for Firestore reads, writes, collections, and Firebase config
---

- All Firestore reads/writes go through `src/lib/firestore.ts`. Do not call Firestore directly from components or pages.
- Always wrap Firestore calls in try/catch. Provide sensible fallback values on failure (e.g. default pricing if `fetchPricing()` fails).
- The three Firestore collections are: `estimates` (history), `config/pricing`, and `config/advanced`. Do not add new collections or documents without explicit instruction.
- History is capped at 50 estimates. Enforce this inside `saveEstimate()` in `firestore.ts`, not in the UI layer.
- Firebase config is in `.env` as `VITE_FIREBASE_*` variables. Never hardcode credentials or project IDs in source files.
- Do not import `firebase/firestore` directly in components — only `firestore.ts` should import Firebase internals.
