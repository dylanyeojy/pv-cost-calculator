# Phase 3 — PV Calculator Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note:** This plan is written in plain language by design. Reference the design spec at `docs/superpowers/specs/2026-04-12-phase3-pv-calculator-overhaul.md` for full context and rationale.

**Goal:** Overhaul the PV costing calculator to unify material selection, auto-derive plate thicknesses from ASME calculations, simplify support inputs, add manhole neck nesting, and restructure the Results page and Invoice.

**Architecture:** Three sequential phases — engine & types first (no UI changes), then the form UI, then Results/Invoice/Settings. Each phase is independently testable. Phase 1 is the foundation; Phases 2 and 3 depend on it.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Hook Form + Zod, Vitest (unit tests via `npm run test`), Firebase Auth + Firestore.

**Design Spec:** `docs/superpowers/specs/2026-04-12-phase3-pv-calculator-overhaul.md`

---

## Pre-Work

- [ ] Read the full design spec before starting
- [ ] Run `npm run test` to confirm all existing tests pass before touching anything
- [ ] Run `npm run build` to confirm a clean build baseline

---

## Phase 1 — Engine & Types

All changes in this phase are in `src/lib/types.ts`, `src/lib/calculations.ts`, `src/lib/context.tsx`, and `src/lib/firestore.ts`. No UI changes. Run `npm run test` after each task to catch regressions early.

---

### Task 1.1 — Update `MaterialType` and remove `ssGrade`

**Files:** `src/lib/types.ts`

- [ ] Change the `MaterialType` union from `'carbon_steel' | 'stainless_steel'` to `'SA516 Gr 70' | 'SS304' | 'SS316'`
- [ ] Remove the `SSGrade` type (`SS304 | SS316 | SS316L`) entirely — it is no longer needed
- [ ] Remove the `ssGrade` field from the `VesselInputs` interface
- [ ] Update the `ASME_ALLOWABLE_STRESS` lookup table: rename the keys to match the new `MaterialType` values (`'SA516 Gr 70'`, `'SS304'`, `'SS316'`). Remove the `SS316L` entry.
- [ ] Update the `CS_DENSITY` and `SS_DENSITY` constants — no rename needed, but verify they are still used correctly now that `carbon_steel` is renamed
- [ ] Run `npm run test` — expect TypeScript compile errors in other files; fix them as you go (calculations.ts will have references to old material names)

---

### Task 1.2 — Simplify `VesselInputs`

**Files:** `src/lib/types.ts`

- [ ] Remove `fluidDensity` from `VesselInputs` — the backend will hardcode 1000 kg/m³ (water, conservative)
- [ ] Remove `liquidHeight` from `VesselInputs` — the backend will use `shellLength` as the liquid height for vertical vessels (worst-case conservative assumption)
- [ ] Add `globalNozzleStandard: FlangeStandard` to `VesselInputs` — this is the single standard (B16.5 / PN10 / PN16) that applies to all nozzle and manhole rows
- [ ] Add `filterPlateThickness: number` to `VesselInputs` — defaults will be set in context.tsx later

---

### Task 1.3 — Update `NozzleSpec`

**Files:** `src/lib/types.ts`

- [ ] Remove the `standard` field from the `NozzleSpec` interface — standard is now global via `VesselInputs.globalNozzleStandard`
- [ ] Add `neckLength: number` to `NozzleSpec` — this is the cylinder height of the nozzle or manhole neck in mm (150mm default for nozzles, 300mm default for manholes — defaults are set in the form, not here)

---

### Task 1.4 — Update `LegInputs` and `SaddleInputs`

**Files:** `src/lib/types.ts`

- [ ] Replace `LegInputs` fields `pipeOD: number` and `pipeThickness: number` with a single `diameter: number` field representing the nominal pipe diameter in inches (this is the NPS — Nominal Pipe Size — standard used in ASME B36.10M)
- [ ] Add `quantity: number` to `LegInputs` — default and minimum value of 4, enforced in the form
- [ ] Add `length: number` to `LegInputs` — the leg length in mm (was previously in the interface; verify it exists and if not, add it)
- [ ] Simplify `SaddleInputs` to contain only `quantity: number` — remove `angle`, `width` (b), and `distanceA` fields entirely. These will be auto-derived in `calculateZickSaddle()`

---

### Task 1.5 — Remove `material` from `DishEndInputs`

**Files:** `src/lib/types.ts`

- [ ] Remove the `material` field from `DishEndInputs` — the dish end inherits material from `VesselInputs.materialType`
- [ ] Verify that `DishEndInputs.plateThickness` still exists — it should, since it will now be auto-populated from the ASME calculation but still stored in state (user can override)

---

### Task 1.6 — Add `SA106_PIPE_SCHEDULE` lookup table

**Files:** `src/lib/types.ts`

- [ ] Add a constant `SA106_PIPE_SCHEDULE` as a lookup object mapping nominal pipe diameter in inches (as a number) to `{ od_mm, wall_mm, weight_per_m }` using ASME B36.10M Schedule 40 (standard weight) dimensions
- [ ] Cover sizes: 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24 inches
- [ ] Source values from the ASME B36.10M standard (same data shown in the SA106 Gr. B table screenshot provided). Key values to verify: 4" OD = 114.3mm, wall = 6.02mm; 8" OD = 219.1mm, wall = 8.18mm; 12" OD = 323.9mm, wall = 9.53mm

---

### Task 1.7 — Add `FLANGE_FASTENER_DATA` lookup table

**Files:** `src/lib/types.ts`

- [ ] Add a constant `FLANGE_FASTENER_DATA` mapping a key string (format: `"B16.5-24"`, `"PN10-DN600"`, `"PN16-DN600"`) to `{ bolt_count, bolt_diameter_mm, nut_height_mm, washer_thickness_mm, flange_thickness_mm }`
- [ ] Values for B16.5 Class 150, 24": 20 bolts, 31.75mm (1¼") bolt diameter, flange thickness ~63.5mm
- [ ] Values for PN10 DN600: 20 bolts, M24 (24mm), flange thickness ~32mm
- [ ] Values for PN16 DN600: 20 bolts, M27 (27mm), flange thickness ~40mm
- [ ] Nut height approximation: 0.875 × bolt diameter. Washer thickness: 4mm.
- [ ] For nozzle sizes not in this table, return `null` — the results will show "refer to standard" for those rows

---

### Task 1.8 — Update `getASMEAllowableStress()`

**Files:** `src/lib/calculations.ts`

- [ ] Update all material key lookups in `getASMEAllowableStress()` to use the new `MaterialType` values: `'SA516 Gr 70'`, `'SS304'`, `'SS316'`
- [ ] Remove the `SS316L` case
- [ ] Run `npm run test` — the ASME test suite (`src/test/asme.test.ts`) should still pass with updated key names

---

### Task 1.9 — Update `calculateLiquidHead()`

**Files:** `src/lib/calculations.ts`

- [ ] Remove the `fluidDensity` parameter — hardcode 1000 kg/m³ inside the function
- [ ] Update the function signature and all call sites
- [ ] For vertical vessels, the caller (context.tsx `runCalculation`) will pass `shellLength` as the liquid height argument — the function itself does not need to know about orientation, it just receives the height value
- [ ] Run `npm run test`

---

### Task 1.10 — Update `calculateLegs()`

**Files:** `src/lib/calculations.ts`

- [ ] Change the function to accept the new `LegInputs` shape: `{ diameter, length, quantity }` instead of `{ pipeOD, pipeThickness, legLength }`
- [ ] Look up the pipe OD and wall thickness from `SA106_PIPE_SCHEDULE` using `diameter` (inches). If the diameter is not found in the table, the function should return `null` or a sensible error state
- [ ] Calculate pipe weight per leg: `π × (OD - wall) × wall × SA106_DENSITY × length` (use 7850 kg/m³ for SA106 Gr. B density, same as CS)
- [ ] Calculate base plate weight per leg: `(OD × 1.1)² × 0.012m × 7850` (square plate, 12mm thick, side = OD × 1.1)
- [ ] Apply `quantity` multiplier to total weight and cost
- [ ] Base plate count = leg quantity (one per leg)
- [ ] Add `nps` (the looked-up NPS string) and `od_mm`, `wall_mm` to the returned `LegSupportResult` so the Results page can display them
- [ ] Run `npm run test`

---

### Task 1.11 — Update `calculateZickSaddle()`

**Files:** `src/lib/calculations.ts`

- [ ] Remove the `SaddleInputs.angle`, `SaddleInputs.width`, `SaddleInputs.distanceA` parameters from the function — derive them internally:
  - Contact angle: fixed at 120°
  - Saddle width `b`: 0.5 × vessel OD
  - Distance A: 0.2 × shell length
- [ ] Accept `quantity: number` from `SaddleInputs.quantity` and apply it as a multiplier to total weight and cost
- [ ] The Zick stress analysis (M1, M2, σ1, σ2 calculations) remains unchanged — only the source of the input values changes
- [ ] Update the returned result type to include the derived values (`derivedAngle`, `derivedWidth`, `derivedDistanceA`) so the Results page can show them as read-only transparency values
- [ ] Run `npm run test`

---

### Task 1.12 — Update `calculateFilterPlates()`

**Files:** `src/lib/calculations.ts`

- [ ] Add a `plateThickness: number` parameter to `calculateFilterPlates()` instead of the current hardcoded 22.3mm / 22mm logic
- [ ] All callers (context.tsx) will pass `inputs.filterPlateThickness` as this argument
- [ ] Run `npm run test`

---

### Task 1.13 — Update `calculateNozzleBOM()`

**Files:** `src/lib/calculations.ts`

- [ ] Update the function to accept the updated `NozzleSpec[]` shape (no `standard` per row, has `neckLength`)
- [ ] Accept `globalNozzleStandard: FlangeStandard` as a parameter
- [ ] Accept `rubberLiningThickness: number = 0` as a parameter (Phase 4 hook — no behaviour change now, but the bolt length formula uses it: `bolt_length += 2 × rubberLiningThickness`)
- [ ] For each row, look up fastener data from `FLANGE_FASTENER_DATA` using `globalNozzleStandard` + `size`. If not found, return `null` for bolt fields.
- [ ] Calculate bolt length: `2 × flange_thickness + 3 + 2 × nut_height + 2 × washer_thickness + 2 × rubberLiningThickness` (all in mm; 3mm is compressed gasket)
- [ ] Calculate nozzle neck weight for each row using `SA106_PIPE_SCHEDULE`: find the pipe size matching the nozzle size (convert from inches), then `π × (OD - wall) × wall × 7850 × (neckLength / 1000)`. Multiply by `quantity`.
- [ ] Calculate neck cost: neck weight × SA106 RM/kg (passed in from pricing)
- [ ] This applies to both manholes and normal nozzles — both get neck weight and cost
- [ ] Update `NozzleBOMItem` type in `types.ts` to include: `boltLength`, `neckWeightKg`, `neckCostRM`, `boltCount`, `nutCount`, `washerCount`, `boltDiameterMm`
- [ ] Run `npm run test`

---

### Task 1.14 — Add `calculateManholeNeckBlanks()`

**Files:** `src/lib/calculations.ts`

- [ ] Add a new exported function `calculateManholeNeckBlanks(nozzles, globalStandard, vesselOD_mm)` that returns an array of `{ width_mm, height_mm, quantity, label }` — one entry per manhole row
- [ ] For each row where `type === 'manhole'`:
  - Look up the neck OD from `SA106_PIPE_SCHEDULE` by the row's size (in inches) → this gives `neck_OD_mm`
  - Calculate saddle cut depth: `R_vessel - √(R_vessel² - r_neck²)` where `R_vessel = vesselOD_mm / 2` and `r_neck = neck_OD_mm / 2`
  - Width: `π × neck_OD_mm`
  - Height: `neckLength + saddle_cut_depth`
  - Label: e.g. `"Manhole Neck 24" × 2"` for display in the Shell Plate Options breakdown
- [ ] This function is called in context.tsx before the shell nesting optimiser runs, so the neck blank rectangles can be pooled with the shell course pieces

---

### Task 1.15 — Update shell nesting to pool manhole neck blanks

**Files:** `src/lib/calculations.ts`, `src/lib/types.ts`

- [ ] Update the `optimizeShell()` function (or the nesting function it calls) to accept an optional `additionalPieces: Array<{ width_mm, height_mm, quantity, label }>` parameter
- [ ] These pieces are added to the same pool as the shell course rectangles when determining how many plates to purchase and how to lay them out
- [ ] Update `ShellOption` (or `NestingOption`) in `types.ts` to track which pieces in the breakdown are shell courses vs. neck blanks — add a `pieceType: 'shell_course' | 'neck_blank'` field to the per-piece breakdown so Results can separate them visually
- [ ] The wastage %, total plate count, and cost reflect the combined pool
- [ ] Run `npm run test`

---

### Task 1.16 — Add `liveASMEPreview()` pure function

**Files:** `src/lib/calculations.ts`

- [ ] Add a new exported pure function `liveASMEPreview(params)` with inputs: `{ materialType, designPressureKPa, liquidHeadKPa, designTempC, jointEfficiency, corrosionAllowanceMm, diameterMm, diameterType, headType }`
- [ ] Returns: `{ allowableStressMPa, shellTminMm, headTminMm, recommendedShellNominalMm, recommendedHeadNominalMm }` — any field that cannot be computed due to missing/invalid inputs returns `null`
- [ ] This function reuses the existing `getASMEAllowableStress()`, `calculateUG27Shell()`, and `calculateUG32Head()` functions internally — no logic duplication
- [ ] `corrosionAllowanceMm` is already factored into the UG-27/UG-32 formulas, so the returned `t_min` values already include it
- [ ] Write a unit test for this function in `src/test/asme.test.ts` using a known manual case: e.g. SA516 Gr 70, 1000 kPa, 150°C, E=0.85, CA=3mm, ID=1000mm → verify the shell and head t_min values match hand-calculated results
- [ ] Run `npm run test`

---

### Task 1.17 — Update `context.tsx` defaults and `runCalculation()`

**Files:** `src/lib/context.tsx`

- [ ] Update default `VesselInputs` in `AppProvider`:
  - `materialType`: `'SA516 Gr 70'`
  - Remove `ssGrade`, `fluidDensity`, `liquidHeight`
  - Add `globalNozzleStandard`: `'B16.5'`
  - Add `filterPlateThickness`: `22.30` (will be overridden to 22.00 when SS material is selected — see form logic in Phase 2)
  - `jointEfficiency`: `0.85`
- [ ] Update default `DishEndInputs`: remove `material` field
- [ ] Update default `LegInputs`: `{ diameter: 4, length: 1500, quantity: 4 }`
- [ ] Update default `SaddleInputs`: `{ quantity: 2 }`
- [ ] Update default `NozzleSpec` items to not include `standard`, and to include `neckLength` (150 for nozzle, 300 for manhole)
- [ ] In `runCalculation()`:
  - Pass `shellLength` as liquid height to `calculateLiquidHead()` for vertical vessels; pass 0 for horizontal
  - Remove `fluidDensity` from the `calculateLiquidHead()` call
  - Pass `inputs.filterPlateThickness` to `calculateFilterPlates()`
  - Pass `inputs.globalNozzleStandard` to `calculateNozzleBOM()`
  - Call `calculateManholeNeckBlanks()` and pass the result to the shell nesting function
  - Pass `inputs.legInputs` (new shape) to `calculateLegs()`
  - Pass `inputs.saddleInputs.quantity` to `calculateZickSaddle()` along with vessel geometry for auto-derived fields

---

### Task 1.18 — Update `firestore.ts` for SA106 pricing

**Files:** `src/lib/firestore.ts`, `src/lib/types.ts`

- [ ] Add `sa106_per_kg: number` to the `PricingData` interface in `types.ts`
- [ ] Add a default value of `0` for `sa106_per_kg` in the `fetchPricing()` fallback object in `firestore.ts`
- [ ] Run `npm run build` to verify no TypeScript errors

---

### Task 1.19 — Phase 1 regression check

- [ ] Run `npm run test` — all tests must pass
- [ ] Run `npm run build` — must compile with no errors
- [ ] Run `npm run dev` and open the app — verify it loads without runtime errors (the UI will look broken/missing fields at this point, that's expected — Phase 2 fixes it)
- [ ] Commit: `feat(engine): update material types, interfaces, lookup tables, and calculation functions`

---

## Phase 2 — Form UI

All changes in this phase are in `src/pages/Index.tsx`. The calculation engine from Phase 1 must be complete before starting here.

---

### Task 2.1 — Update Orientation & Design Parameters card

**Files:** `src/pages/Index.tsx`

- [ ] Add Material Type as the first field in this card. Options: `SA516 Gr 70`, `SS304`, `SS316`. Uses a select/radio component consistent with the rest of the form. Bound to `inputs.materialType`.
- [ ] Change the Vessel Orientation selector labels to just "Vertical" and "Horizontal" — remove the parenthetical descriptions "(standing upright)" and "(saddle)"
- [ ] Rename every label that says "Design Pressure" (or similar) to "Internal Design Pressure"
- [ ] Change the Total Design Pressure Override placeholder text to "Leave blank for auto-calculation"
- [ ] Set the Joint Efficiency default to `0.85` (this is handled via context defaults in Task 1.17, but verify the form dropdown shows 0.85 as the selected value on load)
- [ ] Remove the Fluid Density field entirely
- [ ] Remove the Liquid Height field entirely (both for vertical and horizontal — neither orientation shows it)
- [ ] Add a **Live Thickness Derivation** section below the input fields in this card:
  - This section calls `liveASMEPreview()` with the current form values on every change (debounced 300ms)
  - It reads `inputs.diameter` from the Shell Vessel card state to feed into the preview — the form already has access to all inputs via context
  - Displays four rows: Allowable stress (MPa), Shell t_min → recommended nominal, Head t_min → recommended nominal, Corrosion allowance (mm included in above)
  - Any value that cannot be computed yet shows as `—` (en dash). The layout never changes — no conditional messages.
  - Style it as a muted/secondary info block inside the card, clearly distinct from input fields (e.g. slightly grey background, smaller font, a label like "Thickness derivation (ASME UG-27 / UG-32)")

---

### Task 2.2 — Update Shell Vessel card

**Files:** `src/pages/Index.tsx`

- [ ] Remove the Material Type field from this card — it now lives in the Design Parameters card
- [ ] The Plate Thickness dropdown remains. Pre-select its value to `recommendedShellNominalMm` from the live ASME preview whenever that value changes — but only if the user has not manually overridden it. Track an `isShellThicknessOverridden` local boolean.
- [ ] When the user manually selects a thickness from the dropdown, set `isShellThicknessOverridden = true` and stop auto-updating.
- [ ] When `recommendedShellNominalMm` changes (e.g. user edits design pressure), and the user has NOT overridden, update the dropdown to match.
- [ ] Add a small muted label next to the dropdown that reads "Auto: X mm" showing the current auto-recommended value. This label always shows regardless of whether the user has overridden or not, so they can always compare.

---

### Task 2.3 — Update Dish End card

**Files:** `src/pages/Index.tsx`

- [ ] Remove the Material field from the Dish End card
- [ ] Apply the same auto-populate + override behaviour for Plate Thickness as in Task 2.2, but using `recommendedHeadNominalMm` from the live preview
- [ ] Dish End Quantity: default to `2 × inputs.quantity` (where `inputs.quantity` is the Shell Vessel quantity). When the shell vessel quantity changes, update the dish end quantity automatically — but only if the user has not manually changed it. Track a `isDishEndQtyOverridden` local boolean with the same pattern as the thickness override above.
- [ ] The Straight Face auto-suggest logic and Corner Radius field (flat head only) remain unchanged

---

### Task 2.4 — Update Filter Plates card

**Files:** `src/pages/Index.tsx`

- [ ] Change the quantity input to use the same stepper style (+/− buttons) as the Dish End quantity field
- [ ] Add a **Plate Thickness** dropdown field below the quantity. Use the same standard thickness list as Shell/Dish End. Default: 22.30mm when `materialType === 'SA516 Gr 70'`, 22mm when `materialType === 'SS304'` or `'SS316'`. When the material type changes in the Design Parameters card, update this default if the user has not manually overridden it (same override tracking pattern).
- [ ] Bind the dropdown value to `inputs.filterPlateThickness`

---

### Task 2.5 — Update Nozzles & Manholes card

**Files:** `src/pages/Index.tsx`

- [ ] Add a **Standard** selector at the very top of the Nozzles & Manholes card (above the rows). Options: B16.5, PN10, PN16. Bound to `inputs.globalNozzleStandard`. This replaces the per-row standard selector.
- [ ] Fix the gap/padding issue in the PN10 and PN16 option labels so the full word fits without being cut off
- [ ] Remove the per-row Standard column from each nozzle row
- [ ] Add a **Length (mm)** column to each row, positioned after Size (in). Bound to `nozzle.neckLength`.
- [ ] When the Type field in a row changes to "Nozzle", auto-set the Length to 150. When it changes to "Manhole", auto-set to 300. The user can edit the Length field freely after that. Minimum value: 0.

---

### Task 2.6 — Update Leg Supports card

**Files:** `src/pages/Index.tsx`

- [ ] Replace the "Leg Pipe OD (mm)" input with a **Diameter (inches)** input. This maps to `legInputs.diameter`. Use a select dropdown or number input — a select dropdown with common pipe sizes (2, 3, 4, 6, 8, 10, 12 inches) is recommended for accuracy.
- [ ] Remove the "Leg Pipe Wall Thickness (mm)" input entirely
- [ ] Ensure the "Length (mm)" field is present and bound to `legInputs.length`
- [ ] Add a **Quantity** stepper (same style as Dish End/Shell Vessel) bound to `legInputs.quantity`. Default: 4. Minimum: 4. The stepper should not allow going below 4.
- [ ] Below the input fields, add a read-only calculated display: "Wall thickness: X mm · OD: Y mm" — derived from `SA106_PIPE_SCHEDULE[legInputs.diameter]`. Updates live as the diameter changes. If the diameter isn't found in the table, show "—".

---

### Task 2.7 — Update Saddle card

**Files:** `src/pages/Index.tsx`

- [ ] Remove the Saddle Contact Angle, Saddle Width b (mm), and Distance A fields entirely
- [ ] Add a **Quantity** stepper (same style as Dish End) bound to `saddleInputs.quantity`. Default: 2. Minimum: 2.
- [ ] Add a muted note below the quantity: "Saddle dimensions (contact angle, width, distance A) are derived from vessel geometry per Zick analysis."
- [ ] This card is only shown when `inputs.orientation === 'horizontal'`

---

### Task 2.8 — Phase 2 regression check

- [ ] Run `npm run dev` and open the app
- [ ] Test vertical orientation: verify the live thickness derivation updates as you change material, pressure, temperature, joint efficiency, diameter. Verify fluid density and liquid height fields are gone.
- [ ] Test that Shell Vessel plate thickness auto-updates, shows "Auto: X mm", and stops auto-updating after a manual override
- [ ] Test that Dish End quantity defaults to 2× shell quantity and tracks it
- [ ] Test that changing material to SS304 updates the filter plate thickness default to 22mm
- [ ] Test that changing nozzle type to "Manhole" sets length to 300, "Nozzle" sets to 150
- [ ] Test horizontal orientation: verify only saddle card shows (no legs), saddle card shows only quantity with note
- [ ] Run `npm run build` — no errors
- [ ] Commit: `feat(form): reorganise Design Parameters card, auto-derive plate thickness, simplify support inputs`

---

## Phase 3 — Results, Invoice & Settings

All changes in this phase are in `src/pages/Results.tsx`, `src/pages/SettingsPage.tsx`. Phase 1 and 2 must be complete before starting here.

---

### Task 3.1 — Update Project Details header card

**Files:** `src/pages/Results.tsx`

- [ ] Add **Orientation** as the first row in the Project Details header card (e.g. "Vertical" or "Horizontal")
- [ ] Add a fourth row containing: **Filter Plates** (Yes / No), **Manholes** (qty), **Nozzles** (qty), **[Leg Supports / Saddles]** (qty) — the label and value adapt based on orientation

---

### Task 3.2 — Remove the standalone ASME Thickness card

**Files:** `src/pages/Results.tsx`

- [ ] Remove the ASME Thickness result card from the Results page. This information now lives in the Design Parameters live preview on the form. No replacement needed here.

---

### Task 3.3 — Reorder Results page cards

**Files:** `src/pages/Results.tsx`

- [ ] Reorder the rendered result sections to: Project Details header → Shell Plate Options → Dish End Plate Options → Filter Plate Options (conditional) → Manholes & Nozzles → Leg Supports / Saddle
- [ ] The Filter Plate Options card should render only when `results.filterPlates` is present and `inputs.filterPlateCount > 0`

---

### Task 3.4 — Update Shell Plate Options card

**Files:** `src/pages/Results.tsx`

- [ ] Within each of the 5 selectable Shell Plate option cards, the breakdown table should show two labelled sub-sections:
  - **Shell Vessel** — lists each course: width, pieces nAround, pieces per plate, area
  - **Manhole Necks** — lists each neck blank: width × height (the bounding rectangle), quantity, area. Only shown if there are manholes.
- [ ] The total plate purchase, wastage %, and cost still reflect the combined pool (shell + neck blanks together)
- [ ] Use `pieceType` from the nesting result (added in Task 1.15) to separate the display

---

### Task 3.5 — Add Filter Plate Options card

**Files:** `src/pages/Results.tsx`

- [ ] Create a new result card for Filter Plates that mirrors the structure of the Dish End Plate Options card
- [ ] Show up to 5 nesting options (selectable), each displaying: blank diameter, plate size used, layout, wastage %, total plates needed, material weight, cost
- [ ] Only render this card when filter plate count > 0
- [ ] Wire the selected option's cost into the grand total calculation

---

### Task 3.6 — Update Manholes & Nozzles results card

**Files:** `src/pages/Results.tsx`

- [ ] Restructure the card into two sub-sections: **Manholes** and **Nozzles**

- [ ] **Manholes sub-section** shows per row:
  - Standard (global), size, neck length, quantity
  - Blind flange quantity (= manhole quantity, auto)
  - Bolt count, bolt diameter (mm), bolt length (mm) with a footnote showing the breakdown: `2 × [flange_thickness]mm flange + 3mm gasket + 2 × [nut_height]mm nut + 2 × [washer]mm washer`
  - Nut count, washer count
  - Neck weight (kg) and cost (RM) — SA106 Gr. B
  - Flange line: quantity, standard, size, cost shown as "— (obtain quote)"
  - Bolt/nut/washer cost: not calculated, shown as a note "obtain quote separately"

- [ ] **Nozzles sub-section** shows per row:
  - Standard (global), size, neck length, quantity
  - Neck weight (kg) and cost (RM) — SA106 Gr. B
  - Flange: quantity, size, standard, cost "— (obtain quote)"

---

### Task 3.7 — Update Leg Supports / Saddle results card

**Files:** `src/pages/Results.tsx`

- [ ] **Vertical (Leg Supports):**
  - Show: pipe OD (mm), wall thickness (mm), pipe length (mm), quantity
  - Show: base plate dimensions (OD × 1.1 mm square, 12mm thick), quantity (= leg quantity)
  - Show: total SA106 weight (kg) breakdown (pipe weight + base plate weight) and total cost (RM)

- [ ] **Horizontal (Saddles):**
  - Show: quantity
  - Show derived values as read-only: contact angle (120°), width b (mm), distance A (mm) — with a label indicating these are auto-derived from vessel geometry
  - Show: Zick stress results (σ1, σ2 vs allowable) — retain existing stress table
  - Show: total SA106 weight (kg) and cost (RM)

---

### Task 3.8 — Update sticky invoice panel

**Files:** `src/pages/Results.tsx`

- [ ] Update the sticky right-column invoice to match the new card order and line items:
  1. Shell Plates (material + weld cost)
  2. Dish End Plates (material + weld cost)
  3. Filter Plates (cost, only if present)
  4. Nozzle & Manhole Necks — SA106 weight × RM/kg
  5. Leg Supports / Saddles — SA106 weight × RM/kg
  6. Flanges — "— (obtain quote)" line with total quantity and standards listed
  7. Grand Total (sum of items 1–5 only; flanges excluded)
- [ ] Remove any line items that no longer exist (e.g. old ASME-related cost lines if any)

---

### Task 3.9 — Update print PDF invoice

**Files:** `src/pages/Results.tsx`

- [ ] Apply the same line item structure from Task 3.8 to the print/PDF layout
- [ ] Verify the print layout still looks correct by using browser print preview (Ctrl+P)

---

### Task 3.10 — Add SA106 Gr. B pricing to Settings page

**Files:** `src/pages/SettingsPage.tsx`

- [ ] Add a "SA106 Gr. B (RM/kg)" input field to the pricing table in the Settings page
- [ ] Bound to `pricing.sa106_per_kg`
- [ ] Follow the same form pattern as the existing `cs_plate_per_kg` and `ss_plate_per_kg` fields

---

### Task 3.11 — Phase 3 regression check

- [ ] Run `npm run dev` and run through a full calculation end-to-end:
  - Set material to SA516 Gr 70, vertical, add design pressure, temp, joint efficiency, CA
  - Verify live thickness derivation shows numbers in the form
  - Add a shell vessel, verify plate thickness auto-selects
  - Add dish ends, verify they default to 2× vessel quantity
  - Add filter plates, verify the filter plate options card appears in results
  - Add a manhole (B16.5, 24", 300mm), verify the neck blank appears in Shell Plate Options breakdown
  - Add leg supports, verify read-only OD/wall thickness shows
  - Click Calculate, verify all result cards appear in the correct order
  - Open Settings, set SA106 price, recalculate — verify SA106 costs appear in results and invoice
- [ ] Run `npm run test` — all tests pass
- [ ] Run `npm run build` — no TypeScript errors
- [ ] Commit: `feat(results): reorder cards, add filter plate options, update invoice and settings`

---

## Post-Implementation

- [ ] Run a full end-to-end test with a horizontal vessel to verify saddle card, saddle results, and invoice work correctly for that orientation
- [ ] Verify that changing from SA516 Gr 70 to SS304 mid-form updates: allowable stress in the derivation, recommended plate thicknesses, filter plate thickness default
- [ ] Confirm no `console.log` statements, `alert()` calls, or commented-out code was left in any modified file
- [ ] Run `npm run lint` — no lint errors
