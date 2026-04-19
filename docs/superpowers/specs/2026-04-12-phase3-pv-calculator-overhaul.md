# Phase 3 — PV Calculator Overhaul Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Context

Phase 2 implemented the ASME thickness engine, nozzle BOM, filter plates, and orientation-dependent supports. This phase addresses a broad set of feedback from engineering review:

- Material type was fragmented across cards — moved to one global selection
- Plate thickness was still manually entered, defeating the purpose of the ASME engine
- Several form inputs that should be auto-derived were exposed to the user unnecessarily
- Results page order didn't match fabrication workflow
- Costing was incomplete (SA106 Gr. B parts not priced, flanges not listed)
- Phase 4 (rubber lining) needs to be architecturally accommodated

The goal is to make the form feel like an engineering tool that does the hard work for you — the user provides intent, the system derives dimensions and recommends thicknesses.

---

## Implementation Strategy

Three sequential phases, each testable independently:

| Phase | Scope |
|---|---|
| 1 | Engine & types — no UI changes, all logic |
| 2 | Form UI — Index.tsx only |
| 3 | Results, Invoice & Settings |

---

## Phase 1 — Engine & Types

### Material Type System

`MaterialType` becomes `'SA516 Gr 70' | 'SS304' | 'SS316'`.

- `SS316L` is removed
- `ssGrade` field removed from `VesselInputs` — grade is embedded in the material type
- SA106 Gr. B is used internally by the calculation engine for non-pressure parts (nozzle necks, leg supports, saddles, leg base plates). It is never exposed as a user selection.

### Interface Changes (types.ts)

**VesselInputs**
- Remove `ssGrade`
- Remove `fluidDensity` (hardcoded to 1000 kg/m³ internally — conservative assumption)
- Remove `liquidHeight` (backend assumes liquid height = shell length for vertical vessels — worst-case conservative)
- Add `globalNozzleStandard: FlangeStandard` (applies to all nozzle/manhole rows)
- Add `filterPlateThickness: number` (default: 22.30mm for SA516 Gr 70, 22mm for SS grades)

**NozzleSpec**
- Remove `standard` (now global via `globalNozzleStandard`)
- Add `neckLength: number` (default: 150mm for nozzle, 300mm for manhole — auto-set when Type changes, user can override, minimum 0)

**LegInputs**
- Replace `pipeOD: number` + `pipeThickness: number` with `diameter: number` (inches, maps to nominal pipe size)
- Add `quantity: number` (default: 4, minimum: 4)
- Remove wall thickness — auto-derived from ASME B36.10M lookup

**SaddleInputs**
- Simplify to `quantity: number` only (default: 2, minimum: 2)
- All other fields (contact angle, width, distance A) are auto-derived from vessel geometry per Zick analysis

**DishEndInputs**
- Remove `material` field — inherits from `VesselInputs.materialType`

### New Lookup Tables (types.ts)

**`SA106_PIPE_SCHEDULE`**
Maps nominal pipe diameter in inches to `{ od_mm, wall_mm, weight_per_m }` using ASME B36.10M standard dimensions (Schedule 40 / standard weight). Covers 2" through 24".

**`FLANGE_FASTENER_DATA`**
Maps standard+size to `{ bolt_count, bolt_diameter_mm, nut_height_mm, washer_thickness_mm, flange_thickness_mm }`. Covers:
- B16.5 Class 150, 24" (20 bolts, 1¼" studs)
- PN10 DN600 (20 bolts, M24)
- PN16 DN600 (20 bolts, M27)

For nozzles (non-manhole), bolt/nut/washer counts are derived by looking up the nozzle size in the same table. Sizes not in the lookup return null — shown as "refer to standard" in results.

### Calculation Engine Changes (calculations.ts)

**`getASMEAllowableStress()`**
Update material name keys to match new `MaterialType` enum values.

**`calculateLiquidHead()`**
Remove `fluidDensity` parameter. Use 1000 kg/m³ internally. For vertical vessels, liquid height = shell length (passed from `VesselInputs.shellLength`). For horizontal vessels, liquid head = 0.

**`calculateLegs()`**
Look up OD and wall thickness from `SA106_PIPE_SCHEDULE` by `diameter` (inches). Calculate:
- Pipe weight per leg = π × (OD − t) × t × 7850 kg/m³ × length
- Base plate weight per leg = (OD × 1.1)² × 0.012m × 7850 kg/m³
- Total SA106 weight = (pipe weight + base plate weight) × quantity
- Cost = total weight × SA106 RM/kg

**`calculateZickSaddle()`**
Auto-derive inputs from vessel geometry before running Zick analysis:
- Contact angle: 120° (standard)
- Saddle width b: 0.5 × vessel OD (approximate standard)
- Distance A: 0.2 × shell length (standard rule of thumb)
No user inputs required. Quantity applied as multiplier on weight and cost.

**`calculateFilterPlates()`**
Accept `plateThickness: number` parameter instead of hardcoded values. All other logic unchanged.

**`calculateNozzleBOM()`**
Extended to return per-row:
- Bolt length = `2 × flange_thickness + 3mm_gasket + 2 × nut_height + 2 × washer_thickness`
- Architecture: function signature includes `rubberLiningThickness: number = 0` parameter — bolt length formula adds `2 × rubberLiningThickness` when Phase 4 is implemented. No behaviour change now.
- Nozzle neck weight = SA106 pipe weight for given diameter and neck length (from `SA106_PIPE_SCHEDULE` lookup)
- Neck cost = neck weight × SA106 RM/kg
- Both manholes and normal nozzles have neck weight calculated and costed

**New `calculateManholeNeckBlanks()`**
For each manhole row, compute the bounding rectangle of the unrolled saddle-cut neck blank:
- `W = π × OD_neck`
- `H = neckLength + (R_vessel_outer − √(R_vessel_outer² − r_neck_outer²))`
- Returns `Array<{ width_mm, height_mm, quantity }>` — these rectangles are passed into the shell nesting optimiser alongside the shell course pieces

**Shell nesting update**
The shell nesting optimiser (`optimizeShell()`) receives both shell course pieces and manhole neck blanks. The optimiser treats neck blanks as additional rectangular pieces to fit on the same purchased plates. The result tracks whether each piece is a shell course or a neck blank, enabling the Results page to display them separately.

**New `liveASMEPreview()`**
Pure function — no side effects, no context dependency.

Inputs: `{ materialType, designPressureKPa, liquidHeadKPa, designTempC, jointEfficiency, corrosionAllowanceMm, diameterMm, headType }`

Returns: `{ allowableStressMPa, shellTminMm, headTminMm, recommendedShellNominalMm, recommendedHeadNominalMm }`

Returns `null` for any field that cannot be computed (missing inputs). Used by:
- The Design Parameters card (live form preview, debounced 300ms)
- `runCalculation()` internally (no duplication of logic)

---

## Phase 2 — Form UI (Index.tsx)

### Orientation & Design Parameters Card

**Field order:**
1. Material Type (SA516 Gr 70 / SS304 / SS316)
2. Vessel Orientation (Vertical / Horizontal — no bracketed descriptions)
3. Internal Design Pressure (kPa)
4. Design Temperature (°C)
5. Joint Efficiency — default **0.85**
6. Corrosion Allowance (mm)
7. Total Design Pressure Override (kPa) — placeholder: "Leave blank for auto-calculation"

The card is identical for both orientations. Fluid density and liquid height fields are removed entirely.

**Live Thickness Derivation** (shown below the inputs, always visible)

Recalculates ~300ms after any input change using `liveASMEPreview()`. Values show as `—` until the required inputs are available. Layout is stable — no conditional text.

```
Allowable stress (S):     138 MPa   (SA516 Gr 70 @ 150°C)
Shell t_min (UG-27):      8.4 mm    →  Recommended nominal: 9.60 mm
Head t_min (UG-32):       6.1 mm    →  Recommended nominal: 8.00 mm
Corrosion allowance:      3.0 mm    (included in t_min above)
```

Allowable stress populates as soon as material type + temperature are set. Shell/head values populate once pressure and vessel diameter are also set.

### Shell Vessel Card

Material Type field removed. Plate Thickness dropdown pre-selected to `recommendedShellNominalMm` from the live preview. User can override — their selection persists. When overridden, a small muted label shows "Auto: 9.60 mm" beside the dropdown so they know what the system recommends.

### Dish End Card

Material field removed. Plate Thickness pre-selected to `recommendedHeadNominalMm`, same override behaviour as shell. Quantity defaults to `2 × shellVesselQuantity` and updates automatically when shell quantity changes — user can type any value to override.

### Filter Plates Card

Quantity styled identically to Dish End (stepper with +/− buttons, minimum 0). New Plate Thickness dropdown added with values from the standard thickness lists. Defaults: 22.30 mm for SA516 Gr 70, 22 mm for SS304/SS316.

### Nozzles & Manholes Card

A single **Standard** selector at the top of the card (B16.5 / PN10 / PN16) — applies to all rows. PN10/PN16 gap in dropdown labels fixed.

Per-row fields: **Type** | **Size (in)** | **Length (mm)** | **Flange Face** | **Qty**

Length field defaults to 150 mm when Type = nozzle, 300 mm when Type = manhole. Auto-sets on Type change but remains editable. Minimum value: 0.

### Leg Supports Card (vertical only)

Fields: **Diameter (inches)** | **Length (mm)** | **Quantity** (stepper, default/min 4)

Below the inputs, read-only calculated values: "Wall thickness: 8.18 mm · OD: 219.1 mm" — updated whenever diameter changes.

### Saddle Card (horizontal only)

All manual input fields removed. Only a **Quantity** stepper (default/min 2). A muted note: "Saddle dimensions are derived from vessel geometry per Zick analysis."

---

## Phase 3 — Results, Invoice & Settings

### Results Page — Card Order

1. Project Details header
2. Shell Plate Options
3. Dish End Plate Options
4. Filter Plate Options *(hidden if filter plate count = 0)*
5. Manholes & Nozzles
6. Leg Supports / Saddle

The standalone ASME Thickness card is removed — that information now lives in the Design Parameters card as the live preview and does not need to be repeated on the Results page.

### Project Details Header Card

Updated fields:
- Row 1: Orientation (Vertical / Horizontal)
- Row 4 (new): Filter Plates (Yes / No) · Manholes (qty) · Nozzles (qty) · [Leg Supports or Saddles] (qty)

### Shell Plate Options Card

Each of the 5 selectable option cards retains its current structure. The breakdown table gains two labelled sub-sections:

**Shell Vessel** — course dimensions, pieces per plate, area per piece, subtotal area

**Manhole Necks** — neck blank dimensions (W × H), quantity, area

Wastage % and total plate purchase reflect the combined pooled nesting. The distinction is shown so fabricators know exactly which pieces to cut for which purpose.

### Dish End Plate Options Card

No structural change. Now uses auto-derived plate thickness rather than user-entered.

### Filter Plate Options Card (new)

Mirrors the Dish End Plate Options card structure — 5 selectable nesting options, each showing blank diameter, plate size used, layout type, wastage %, material weight, and cost. Uses the same nesting algorithm as dish ends. Entirely hidden if filter plate count = 0.

### Manholes & Nozzles Card

**Manholes section:**
- Standard, size, neck length, qty
- Blind flange qty = manhole qty (auto)
- Per manhole: bolt count, bolt diameter, bolt length (with derivation), nut count, washer count
- Bolt length shown as calculated value with footnote breakdown: `2 × flange_thickness + 3mm gasket + 2 × nut_height + 2 × washer_thickness`
- Bolt/nut/washer costs: not calculated — listed for reference only with note "obtain quote"
- Flanges: listed as `[Standard] [Size] × [Qty]` with cost `— (obtain quote)`
- Neck weight and SA106 cost shown

**Nozzles section:**
- Standard, size, neck length, qty
- Neck weight (SA106 Gr. B) and cost shown
- Flange: listed with cost `— (obtain quote)`

### Leg Supports / Saddle Card

**Vertical:**
- Pipe OD, wall thickness (from B36.10M lookup), length, qty
- Base plate: dimensions (OD × 1.1, square), thickness (12mm), qty (= leg qty)
- Total SA106 weight breakdown and cost

**Horizontal:**
- Saddle qty
- Derived values shown read-only: contact angle, width, distance A
- Total SA106 weight and cost

### Invoice — Sticky and Print PDF

Both updated to match new Results card order. Line items:

| # | Item | Cost |
|---|---|---|
| 1 | Shell Plates | RM xxx |
| 2 | Dish End Plates | RM xxx |
| 3 | Filter Plates | RM xxx *(if present)* |
| 4 | Nozzle & Manhole Necks (SA106) | RM xxx |
| 5 | Leg Supports / Saddles (SA106) | RM xxx |
| 6 | Flanges | — (obtain quote) |
| — | **Grand Total** | **RM xxx** |

### Settings Page

One addition to the pricing table:
- **SA106 Gr. B** (RM/kg) — used for nozzle necks, leg supports, saddles, base plates

Flange pricing is intentionally excluded. Flanges vary too much by size/standard/class for a flat rate to be meaningful. The invoice lists them with full specs for the team to quote separately.

---

## Phase 4 Preparation (Rubber Lining / Painting)

The following hooks are built in Phase 1 so Phase 4 requires no architectural rework:

- `calculateNozzleBOM()` accepts `rubberLiningThickness: number = 0` — bolt length formula adds `2 × rubberLiningThickness` automatically when the value is non-zero
- `VesselInputs` retains the existing `rubberLining` boolean field (currently unused) as a placeholder
- Shell thickness calculations use `corrosionAllowanceMm` as the only adjustable factor for now — rubber lining thickness will be a separate additive pass in Phase 4

---

## Files Modified

| File | Change |
|---|---|
| `src/lib/types.ts` | MaterialType enum, remove ssGrade/fluidDensity/liquidHeight, new NozzleSpec/LegInputs/SaddleInputs, new lookup tables |
| `src/lib/calculations.ts` | Update all existing functions, add `calculateManholeNeckBlanks()`, add `liveASMEPreview()`, update shell nesting to pool neck blanks |
| `src/lib/context.tsx` | Update defaults, update `runCalculation()` wiring |
| `src/pages/Index.tsx` | All card changes per Phase 2 |
| `src/pages/Results.tsx` | Card reorder, shell plate distinction, new filter plate card, updated manholes/nozzles/support cards |
| `src/pages/SettingsPage.tsx` | Add SA106 Gr. B pricing field |
| `src/lib/firestore.ts` | Add SA106 Gr. B to PricingData defaults |
