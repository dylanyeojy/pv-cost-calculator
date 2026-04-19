# Phase 2 — ASME Pressure Vessel Engineering Calculator

**Date:** 2026-04-10
**Status:** Approved — ready for implementation

---

## Context

The current app (Phase 1) is a fabrication costing tool — it optimizes how to cut and weld steel plates for a vessel's shell and dish ends. It does not do any engineering/code-based design.

Phase 2 adds the engineering layer: ASME Section VIII Division 1 thickness design from first principles, orientation-dependent supports (legs vs saddles with Zick analysis), nozzle/manhole BOM with bolting, and filter plates.

**Source spec:** `PV Calculator.txt` (client requirements from Dylan's dad)

---

## Phase 1 Baseline (what the app already does)

**Inputs:** Material (CS/SS), plate thickness (from fixed list), OD/ID, shell length, dish end config (head type, SF, qty), quantity.

**Engine:** Optimizes shell plate layouts (minimizes cost/wastage across 5 ranked configs); optimizes dish end blank nesting.

**Outputs:** Top 5 shell options with weld/cost breakdown; top 5 nesting options; sticky invoice panel; printable PDF.

**Note:** `designPressure` and `designTemperature` already exist in `VesselInputs` (types.ts) but are never calculated against — Phase 2 activates them.

---

## Phase 2 Scope

### 2A — Orientation + ASME Thickness Calculator

**New inputs:**
- Vessel orientation: `vertical | horizontal`
- Design pressure (kPa)
- Design temperature (°C)
- Corrosion allowance CA (mm)
- Joint efficiency E: `0.70 | 0.85 | 1.00` (dropdown with labels: None / Spot / Full radiography)
- Fluid density ρ (kg/m³) — default 1000, user-editable
- Liquid height (mm) — vertical vessels only
- Total design pressure — auto-calculated (top pressure + liquid head), manual override allowed

**Shell — ASME UG-27:**
```
t_min = P·R / (S·E − 0.6·P)
```
where R = inside radius (m), P in MPa, S from allowable stress table at design temp.
Add CA → snap up to next standard plate thickness.

**Heads — ASME UG-32:**

| Head type | Formula |
|---|---|
| Ellipsoidal | `t = P·D / (2·S·E − 0.2·P)` |
| Torispherical | `t = 0.885·P·L / (S·E − 0.1·P)` where L = crown radius = ID |
| Hemispherical | `t = P·L / (2·S·E − 0.2·P)` where L = inside radius |

For heads, apply **forming tolerance** before adding CA:
```
t_formed = t_min / (1 − 0.10)    // 10% thinning during forming
t_final = t_formed + CA
```
Then snap up to next standard plate thickness.

**Validation:**
- Thin-shell warning: if t_min ≥ R/2 → display warning, do not block
- UG-16 check: t_nominal ≥ 1.6mm (never fails in practice with available plates)
- Temperature out of range (< 20°C or > 400°C) → show error, block calculation

**Allowable stress tables** — ASME Section II Part D (linear interpolation between points):

| Temp (°C) | SA-516 Gr.70 | SA-240 Tp.304 | SA-240 Tp.316 |
|---|---|---|---|
| 20 | 138 | 138 | 138 |
| 50 | 138 | 138 | 138 |
| 100 | 138 | 127 | 127 |
| 150 | 138 | 120 | 122 |
| 200 | 131 | 114 | 117 |
| 250 | 125 | 110 | 113 |
| 300 | 118 | 106 | 110 |
| 350 | 110 | 103 | 106 |
| 400 | 100 | 99 | 103 |

All values in MPa.

**Output:** Calculated min thickness, forming-adjusted thickness (heads), recommended nominal thickness, allowable stress used. Recommended thickness auto-populates the plate thickness input.

---

### 2B — Filter Plates

- Input: count (0 = none)
- Auto: diameter = vessel ID; thickness = 22.3mm (CS) or 22mm (SS)
- Output: weight per plate, total weight, material cost at plate price/kg

---

### 2C — Nozzles & Manholes

Add/remove rows, each with:
- Type: Nozzle or Manhole
- Standard: ASME B16.5 | PN10 | PN16
- Size: NPS (B16.5) or DN (PN)
- Pressure class: 150# (B16.5) or PN10/PN16
- Flange face: Slip-On Raised Face | Weld Neck
- Quantity

**Manhole fastener sets (auto-generated for blind flanges):**

| Manhole | Bolts | Nuts | Washers |
|---|---|---|---|
| 24" 150# (ASME B16.5) | 20 × 1¼" (31.75mm) × 170mm | 20 | 40 |
| DN600 PN10 | 20 × M27 × 95mm | 20 | 40 |
| DN600 PN16 | 20 × M33 × 115mm | 20 | 40 |

Output: BOM table with item, standard, size, qty, fastener set. Labeled "for costing/procurement only."

---

### 2D — Supports

**Vertical vessels — 4 pipe legs:**
- Inputs: leg pipe OD (mm), wall thickness (mm), leg length (mm)
- Auto: base plate = square with side = leg OD × 1.1
- Output: pipe weight per leg, base plate dimensions and weight, 4× total, material cost

**Horizontal vessels — 2 saddles (Zick analysis):**
- Inputs: saddle angle θ (default 120°), saddle width b (mm), distance from tangent to saddle centre A (mm)
- Vessel weight W = total vessel weight (shell + dish ends + contents estimate)

Zick stress checks:
```
H = vessel head depth
Q = W/2 (load per saddle)
M1 = Q·A · [1 − (1 − A/L + (R²−H²)/(2AL)) / (1 + 4H/3L)]
M2 = QL/4 · [1 + 2(R²−H²)/L² − 4A/L]
V  = Q(L−2A) / (L + 4H/3)
σ1 = M1 / (π·R²·t)         (bending at saddle)
σ2 = M2 / (π·R²·t)         (bending at midspan)
σ3_check vs 1.5·S_allowable  (circumferential at horn)
```

Saddle plate geometry (for material estimate):
- Base plate: b × (OD + 200mm), 18mm thick
- Web plate: b × saddle_height, 18mm thick
- 6 rib plates: 150mm × saddle_height, 18mm thick each

Output: Stress check table (pass/fail), saddle geometry, material weight × 2 saddles, cost.

---

## Disclaimer (to appear on Results page)

> ASME thickness calculations and support estimates are for **fabrication costing purposes only**. Nozzle reinforcement (UG-37), external pressure (UG-28), and seismic/wind loads are not calculated. Results are not a substitute for a code-certified engineering design.

---

## Implementation Architecture

### Files to modify:

| File | Changes |
|---|---|
| `src/lib/types.ts` | Add `orientation`, `jointEfficiency`, `corrosionAllowance`, `fluidDensity`, `liquidHeight`, `totalDesignPressureOverride`, `filterPlateCount`, `nozzles[]`, `legInputs`, `saddleInputs` to `VesselInputs`; add `ASMEResults`, `NozzleSpec`, `LegInputs`, `SaddleInputs`, `SupportResults` types; add allowable stress table constants |
| `src/lib/calculations.ts` | Add `getASMEAllowableStress()`, `calculateLiquidHead()`, `calculateUG27Shell()`, `calculateUG32Head()`, `calculateFilterPlates()`, `calculateLegs()`, `calculateZickSaddle()` |
| `src/lib/context.tsx` | Wire new inputs/outputs into AppProvider; add defaults |
| `src/pages/Index.tsx` | Add form sections: Orientation, Design Parameters, Liquid Head, Filter Plates, Nozzles/Manholes, Supports |
| `src/pages/Results.tsx` | Add ASME Thickness card, Filter Plates line, Nozzle BOM table, Support summary card, disclaimer banner |
| `src/lib/firestore.ts` | Include new fields in `saveEstimate()` |

### New unit tests (`src/test/asme.test.ts`):

1. SA-516 Gr.70 @ 1000 kPa, ID=1000mm, E=1.0, CA=3mm → shell t_nominal = 8mm
2. Ellipsoidal head same inputs → t_nominal = 8mm
3. Forming tolerance: t_min=5mm head → t_formed = 5/0.9 = 5.56mm → t_final = 8.56mm → nominal 9.6mm (CS)
4. Stress interpolation: SA-516 @ 175°C → 134.5 MPa (between 138 @ 150°C and 131 @ 200°C)
5. Manhole BOM: 24" 150# → 20 bolts, 20 nuts, 40 washers
6. Zick: known published test case → M1, M2 within 1% of hand calc

---

## Review Notes (from GPT cross-check, 2026-04-10)

Items confirmed correct: UG-27 formula, UG-32 ellipsoidal, torispherical, hemispherical formulas, thickness snapping logic, liquid head concept, overall architecture.

Items added after review: forming tolerance (client explicitly requested), linear stress interpolation (was planned but now explicit), fluid density as user input, thin-shell validity warning, UG-16 check.

Items explicitly out of scope: UG-37 nozzle reinforcement, UG-28 external pressure, seismic/wind loads, leg buckling. Disclaimer on results page addresses these.
