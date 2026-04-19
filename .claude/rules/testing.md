---
description: Vitest unit tests and Playwright E2E test conventions
---

- Unit tests (Vitest) go in `src/test/`. Name files `*.test.ts` or `*.test.tsx`.
- E2E tests (Playwright) are configured via `playwright.config.ts`. Run with `npm test`.
- Calculation functions are the highest-value unit test targets. Prioritize testing `calculations.ts` and `dishEndCalculations.ts` — a wrong number here affects cost outputs directly.
- Do not mock Firebase at the module level. Mock at the `firestore.ts` boundary — components and hooks should only ever call `firestore.ts` functions, so mocking those is sufficient.
- When adding a new calculation function, add at least one unit test with a manually verified expected output.
