---
description: Dev commands, environment setup, and common development tasks
---

## Commands

| Task | Command |
|---|---|
| Start dev server (port 8080) | `npm run dev` |
| Production build | `npm run build` |
| Preview production build | `npm run preview` |
| Lint | `npm run lint` |
| Unit tests | `npm run test` |
| Unit tests (watch) | `npm run test:watch` |

## Adding a new vessel input field

1. Add the field to the `VesselInputs` interface in `src/lib/types.ts`
2. Add it to the default state in `AppProvider` (`src/lib/context.tsx`)
3. Add the form input to `src/pages/Index.tsx`
4. Pass it into the calculation functions in `src/lib/calculations.ts` as needed
5. Display the result in `src/pages/Results.tsx`
6. If it should be saved to history, include it in the `saveEstimate()` call in `src/lib/firestore.ts`

## Adding a new pricing field

1. Add the field to the `PricingData` interface in `src/lib/types.ts`
2. Add a default value in the `fetchPricing()` fallback in `src/lib/firestore.ts`
3. Add the `config/pricing` Firestore document field
4. Add it to the settings UI in `src/pages/SettingsPage.tsx`
5. Use it in the cost calculation in `src/lib/calculations.ts`
