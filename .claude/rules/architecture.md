---
description: File structure, where code belongs, and how layers are separated
---

- Pages live in `src/pages/`. Components live in `src/components/`. Logic lives in `src/lib/`.
- Do not put business logic in page components. Calculation logic belongs in `src/lib/calculations.ts` or `src/lib/dishEndCalculations.ts`.
- Do not put UI layout in `src/lib/`. Keep lib files pure logic or data access.
- New shadcn/ui components go in `src/components/ui/`. Custom app components go directly in `src/components/`.
- New routes must be added to `src/App.tsx` inside the authenticated route wrapper — never outside it.
- All shared types and interfaces belong in `src/lib/types.ts`. Do not define types inline in page or component files.
