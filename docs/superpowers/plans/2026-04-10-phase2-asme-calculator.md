# Phase 2 — ASME Pressure Vessel Engineering Calculator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ASME Section VIII Div.1 thickness calculation, filter plates, nozzle/manhole BOM with fasteners, and orientation-dependent supports (pipe legs vs Zick saddle analysis) to the existing PV costing calculator.

**Architecture:** New types and constants go into `src/lib/types.ts`; all new calculation functions go into `src/lib/calculations.ts` alongside the existing shell optimizer; context, form (`Index.tsx`), and results (`Results.tsx`) are extended incrementally. Existing Phase 1 logic is untouched.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, Vitest (run with `npm run test`).

---

## File Map

| File | What changes |
|---|---|
| `src/lib/types.ts` | New types + constants; extend `VesselInputs`; extend `CalculationResults` |
| `src/lib/calculations.ts` | 8 new calculation functions |
| `src/lib/context.tsx` | Extend defaults + `runCalculation` wiring |
| `src/pages/Index.tsx` | 3 new form cards |
| `src/pages/Results.tsx` | 4 new result sections + disclaimer |
| `src/test/asme.test.ts` | New unit test file |

---

## Task 1 — Extend `types.ts` with new types and constants

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new union types and interfaces after the existing `DiameterType` line**

Open `src/lib/types.ts`. After `export type DiameterType = 'ID' | 'OD';` (line 5), add:

```typescript
export type VesselOrientation = 'vertical' | 'horizontal';
export type FlangeStandard = 'B16.5' | 'PN10' | 'PN16';
export type FlangeType = 'slip_on_rf' | 'weld_neck';
export type NozzleItemType = 'nozzle' | 'manhole';

export interface NozzleSpec {
  type: NozzleItemType;
  standard: FlangeStandard;
  size: string;        // e.g. '24"' for B16.5 manholes, 'DN600' for PN, 'NPS 4' for nozzles
  flangeType: FlangeType;
  quantity: number;
}

export interface LegInputs {
  pipeOD: number;        // mm
  pipeThickness: number; // mm
  legLength: number;     // mm
}

export interface SaddleInputs {
  angle: number;      // degrees, default 120
  width: number;      // mm (b), saddle width along vessel axis
  distanceA: number;  // mm (A), distance from tangent line to saddle centreline
}
```

- [ ] **Step 2: Extend `VesselInputs` interface**

In the `VesselInputs` interface (after `quantity`), add:

```typescript
  // Phase 2 — ASME design inputs
  orientation: VesselOrientation;
  jointEfficiency: number;              // 0.70 | 0.85 | 1.00
  corrosionAllowance: number;           // mm
  fluidDensity: number;                 // kg/m³, default 1000 (water)
  liquidHeight: number;                 // mm, vertical only
  totalDesignPressureOverride: number;  // 0 = use auto-calculated; >0 = manual override in kPa
  filterPlateCount: number;             // 0 = none
  nozzles: NozzleSpec[];
  legInputs: LegInputs;
  saddleInputs: SaddleInputs;
```

- [ ] **Step 3: Add new result interfaces before `CalculationResults`**

After `DishEndResults` interface, add:

```typescript
export interface ASMEThicknessResult {
  totalDesignPressureMPa: number;
  liquidHeadMPa: number;
  allowableStressMPa: number;
  // Shell (UG-27)
  shellTminMm: number;
  shellNominalMm: number;
  shellThinWallWarning: boolean;
  // Head (UG-32)
  headTminMm: number;
  headTformedMm: number;   // after 10% forming thinning allowance
  headNominalMm: number;
}

export interface FilterPlateResult {
  count: number;
  diameterMm: number;
  thicknessMm: number;
  weightPerPlateKg: number;
  totalWeightKg: number;
  totalCost: number;
}

export interface ManholeFastenerSet {
  boltCount: number;
  boltSpec: string;   // e.g. '1¼" × 170 mm' or 'M27 × 95 mm'
  nutCount: number;
  washerCount: number;
}

export interface NozzleBOMItem {
  spec: NozzleSpec;
  fasteners: ManholeFastenerSet | null;  // null for plain nozzles
}

export interface LegSupportResult {
  pipeOD: number;
  pipeThickness: number;
  legLength: number;
  basePlateSizeMm: number;   // square side length
  weightPerLegKg: number;
  basePlateWeightKg: number;
  totalWeightKg: number;     // 4 legs + 4 base plates
  totalCost: number;
}

export interface ZickResult {
  QN: number;             // load per saddle (N)
  M1Nm: number;           // bending moment at saddle (N·m)
  M2Nm: number;           // bending moment at midspan (N·m)
  sigma1MPa: number;      // longitudinal bending at saddle
  sigma2MPa: number;      // longitudinal bending at midspan
  allowableMPa: number;   // S (from material + temp)
  sigma1Pass: boolean;
  sigma2Pass: boolean;
  saddleWeightKg: number; // 2× saddles
  totalSaddleCost: number;
}

export interface SupportResult {
  type: 'legs' | 'saddles';
  legs?: LegSupportResult;
  saddles?: ZickResult;
}
```

- [ ] **Step 4: Extend `CalculationResults` interface**

In `CalculationResults`, add after `dishEnd?`:

```typescript
  asmeThickness?: ASMEThicknessResult;
  filterPlates?: FilterPlateResult;
  nozzleBOM?: NozzleBOMItem[];
  support?: SupportResult;
```

- [ ] **Step 5: Add allowable stress tables and manhole fastener data as exported constants**

After `SS_DENSITY`:

```typescript
// ─── ASME Section II Part D — Allowable stress tables [tempC, MPa] ───
// Linear interpolation is used between points. Valid range: 20–400 °C.
export const ALLOWABLE_STRESS_SA516_GR70: [number, number][] = [
  [20,138],[50,138],[100,138],[150,138],[200,131],[250,125],[300,118],[350,110],[400,100],
];
export const ALLOWABLE_STRESS_SS304: [number, number][] = [
  [20,138],[50,138],[100,127],[150,120],[200,114],[250,110],[300,106],[350,103],[400,99],
];
export const ALLOWABLE_STRESS_SS316: [number, number][] = [
  [20,138],[50,138],[100,127],[150,122],[200,117],[250,113],[300,110],[350,106],[400,103],
];

// ─── Manhole fastener data ───
// Key: '<standard>_<size>' e.g. 'B16.5_24' | 'PN10_DN600' | 'PN16_DN600'
export interface ManholeFastenerData {
  boltCount: number;
  boltSpec: string;
  nutCount: number;
  washerCount: number;
}

export const MANHOLE_FASTENERS: Record<string, ManholeFastenerData> = {
  'B16.5_24': { boltCount: 20, boltSpec: '1¼" × 170 mm (ASTM A193 B7)', nutCount: 20, washerCount: 40 },
  'PN10_DN600': { boltCount: 20, boltSpec: 'M27 × 95 mm (Grade 8.8)', nutCount: 20, washerCount: 40 },
  'PN16_DN600': { boltCount: 20, boltSpec: 'M33 × 115 mm (Grade 8.8)', nutCount: 20, washerCount: 40 },
};
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no type errors. If `VesselInputs` new fields cause errors in existing code (context.tsx `defaultInputs`), that's fine — it will be fixed in Task 3.

---

## Task 2 — Write ASME calculation functions (TDD)

**Files:**
- Create: `src/test/asme.test.ts`
- Modify: `src/lib/calculations.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/asme.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getASMEAllowableStress,
  calculateLiquidHead,
  calculateUG27Shell,
  calculateUG32Head,
} from '@/lib/calculations';

describe('getASMEAllowableStress', () => {
  it('returns 138 MPa for SA-516 Gr.70 at 20°C', () => {
    expect(getASMEAllowableStress('carbon_steel', undefined, 20)).toBe(138);
  });

  it('linearly interpolates SA-516 Gr.70 at 175°C → 134.5 MPa', () => {
    // Between 150°C (138) and 200°C (131): 138 + (175-150)/(200-150) * (131-138) = 134.5
    expect(getASMEAllowableStress('carbon_steel', undefined, 175)).toBeCloseTo(134.5, 1);
  });

  it('returns 100 MPa for SA-516 Gr.70 at 400°C', () => {
    expect(getASMEAllowableStress('carbon_steel', undefined, 400)).toBe(100);
  });

  it('returns 138 MPa for SS304 at 20°C', () => {
    expect(getASMEAllowableStress('stainless_steel', 'SS304', 20)).toBe(138);
  });

  it('returns 127 MPa for SS304 at 100°C', () => {
    expect(getASMEAllowableStress('stainless_steel', 'SS304', 100)).toBe(127);
  });

  it('returns 138 MPa for SS316L at 20°C (uses SS316 table)', () => {
    expect(getASMEAllowableStress('stainless_steel', 'SS316L', 20)).toBe(138);
  });

  it('throws for temperature below 20°C', () => {
    expect(() => getASMEAllowableStress('carbon_steel', undefined, 10)).toThrow();
  });

  it('throws for temperature above 400°C', () => {
    expect(() => getASMEAllowableStress('carbon_steel', undefined, 450)).toThrow();
  });
});

describe('calculateLiquidHead', () => {
  it('returns 0.02943 MPa for 3000mm of water', () => {
    // 1000 kg/m³ × 9.81 × 3m = 29430 Pa = 0.02943 MPa
    expect(calculateLiquidHead(3000, 1000)).toBeCloseTo(0.02943, 4);
  });

  it('returns 0 for 0 height', () => {
    expect(calculateLiquidHead(0, 1000)).toBe(0);
  });
});

describe('calculateUG27Shell', () => {
  it('returns t_min ≈ 3.64mm and nominal 8mm for CS vessel at 1 MPa', () => {
    // P=1 MPa, R=500mm, S=138 MPa, E=1.0, CA=3mm
    // t = 1×500/(138×1 - 0.6×1) = 500/137.4 = 3.638mm
    // t+CA = 6.638mm → snap to 8mm (CS)
    const result = calculateUG27Shell(1.0, 500, 138, 1.0, 3, 'carbon_steel');
    expect(result.tMinMm).toBeCloseTo(3.638, 2);
    expect(result.nominalMm).toBe(8.0);
    expect(result.thinWallWarning).toBe(false);
  });

  it('uses SS thickness list for stainless_steel', () => {
    // P=1 MPa, R=500mm, S=138 MPa, E=1.0, CA=2mm
    // t_min=3.638mm, +CA=5.638mm → next SS thickness ≥ 5.638 is 6mm
    const result = calculateUG27Shell(1.0, 500, 138, 1.0, 2, 'stainless_steel');
    expect(result.nominalMm).toBe(6);
  });

  it('sets thinWallWarning when t_min >= R/2', () => {
    // Extreme case: P=100 MPa, R=50mm, S=138 MPa, E=1.0, CA=0
    // t = 100×50/(138-60) = 5000/78 = 64.1mm; R/2=25mm → warning
    const result = calculateUG27Shell(100, 50, 138, 1.0, 0, 'carbon_steel');
    expect(result.thinWallWarning).toBe(true);
  });
});

describe('calculateUG32Head', () => {
  it('ellipsoidal: t_min ≈ 3.62mm, t_formed ≈ 4.03mm, nominal 8mm (CS)', () => {
    // P=1 MPa, D=1000mm, S=138 MPa, E=1.0, CA=3mm
    // t = 1×1000/(2×138×1 - 0.2×1) = 1000/275.8 = 3.625mm
    // t_formed = 3.625/0.9 = 4.028mm
    // t_formed + CA = 7.028mm → snap to 8mm
    const result = calculateUG32Head(1.0, 1000, 'ellipsoidal', 138, 1.0, 3, 'carbon_steel');
    expect(result.tMinMm).toBeCloseTo(3.625, 2);
    expect(result.tFormedMm).toBeCloseTo(4.028, 2);
    expect(result.nominalMm).toBe(8.0);
  });

  it('torispherical: uses L=D (crown radius = ID)', () => {
    // t = 0.885×1×1000/(138×1 - 0.1×1) = 885/137.9 = 6.417mm
    // t_formed = 6.417/0.9 = 7.130mm; +CA 3mm = 10.130mm → snap 12.7mm CS
    const result = calculateUG32Head(1.0, 1000, 'torispherical', 138, 1.0, 3, 'carbon_steel');
    expect(result.tMinMm).toBeCloseTo(6.417, 2);
    expect(result.nominalMm).toBe(12.70);
  });

  it('hemispherical: uses L=D/2', () => {
    // t = 1×500/(2×138×1 - 0.2×1) = 500/275.8 = 1.813mm
    // t_formed = 1.813/0.9 = 2.014mm; +CA 3mm = 5.014mm → 6.4mm CS
    const result = calculateUG32Head(1.0, 1000, 'hemispherical', 138, 1.0, 3, 'carbon_steel');
    expect(result.tMinMm).toBeCloseTo(1.813, 2);
    expect(result.nominalMm).toBe(6.40);
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
npm run test -- asme.test.ts 2>&1 | tail -20
```

Expected: errors like `getASMEAllowableStress is not exported from '@/lib/calculations'`.

- [ ] **Step 3: Implement the four functions in `calculations.ts`**

Add the following imports at the top of `src/lib/calculations.ts` (extend the existing import line):

```typescript
import {
  VesselInputs, PlateSize, PricingData, AdvancedSettings, DEFAULT_ADVANCED,
  CS_PLATE_SIZES, SS_PLATE_SIZES, CS_DENSITY, SS_DENSITY,
  ShellOption, CourseDetail, CalculationResults,
  MaterialType, SSGrade, HeadType,
  CS_THICKNESSES, SS_THICKNESSES,
  ALLOWABLE_STRESS_SA516_GR70, ALLOWABLE_STRESS_SS304, ALLOWABLE_STRESS_SS316,
  ASMEThicknessResult,
} from './types';
```

Then add at the bottom of `calculations.ts`, before `formatCurrency`:

```typescript
// ─── ASME Section II Part D — Allowable stress lookup ───

export function getASMEAllowableStress(
  materialType: MaterialType,
  ssGrade: SSGrade | undefined,
  tempC: number,
): number {
  if (tempC < 20 || tempC > 400) {
    throw new Error(`Design temperature ${tempC}°C is outside the supported range (20–400°C).`);
  }
  let table: [number, number][];
  if (materialType === 'carbon_steel') {
    table = ALLOWABLE_STRESS_SA516_GR70;
  } else if (ssGrade === 'SS304') {
    table = ALLOWABLE_STRESS_SS304;
  } else {
    // SS316 and SS316L both use the SS316 table
    table = ALLOWABLE_STRESS_SS316;
  }
  // Linear interpolation
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, s0] = table[i];
    const [t1, s1] = table[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      return s0 + (s1 - s0) * (tempC - t0) / (t1 - t0);
    }
  }
  // Exact match at last entry
  return table[table.length - 1][1];
}

// ─── Liquid head pressure ───

export function calculateLiquidHead(liquidHeightMm: number, fluidDensityKgM3: number): number {
  // Returns pressure in MPa
  return (fluidDensityKgM3 * 9.81 * (liquidHeightMm / 1000)) / 1e6;
}

// ─── UG-27: Cylindrical shell under internal pressure ───

function getNextNominalThickness(tMm: number, materialType: MaterialType): number {
  const list = materialType === 'carbon_steel' ? CS_THICKNESSES : SS_THICKNESSES;
  const next = list.find(t => t >= tMm);
  return next ?? list[list.length - 1];
}

export function calculateUG27Shell(
  P_MPa: number,
  R_mm: number,
  S_MPa: number,
  E: number,
  CA_mm: number,
  materialType: MaterialType,
): { tMinMm: number; nominalMm: number; thinWallWarning: boolean } {
  const tMin = (P_MPa * R_mm) / (S_MPa * E - 0.6 * P_MPa);
  const tRequired = tMin + CA_mm;
  const nominal = getNextNominalThickness(tRequired, materialType);
  const thinWallWarning = tMin >= R_mm / 2;
  return { tMinMm: tMin, nominalMm: nominal, thinWallWarning };
}

// ─── UG-32: Formed heads under internal pressure ───
// Forming tolerance: 10% thinning applied before adding CA.

export function calculateUG32Head(
  P_MPa: number,
  D_mm: number,        // inside diameter
  headType: HeadType,
  S_MPa: number,
  E: number,
  CA_mm: number,
  materialType: MaterialType,
): { tMinMm: number; tFormedMm: number; nominalMm: number } {
  let tMin: number;
  if (headType === 'ellipsoidal') {
    tMin = (P_MPa * D_mm) / (2 * S_MPa * E - 0.2 * P_MPa);
  } else if (headType === 'torispherical') {
    const L = D_mm; // crown radius = inside diameter for standard ASME F&D head
    tMin = (0.885 * P_MPa * L) / (S_MPa * E - 0.1 * P_MPa);
  } else if (headType === 'hemispherical') {
    const L = D_mm / 2;
    tMin = (P_MPa * L) / (2 * S_MPa * E - 0.2 * P_MPa);
  } else {
    // Flat head: approximate per UG-34, K=0.33 for welded flat head
    tMin = D_mm * Math.sqrt(0.33 * P_MPa / S_MPa);
  }
  const tFormed = tMin / (1 - 0.10); // 10% forming thinning allowance
  const tRequired = tFormed + CA_mm;
  const nominal = getNextNominalThickness(tRequired, materialType);
  return { tMinMm: tMin, tFormedMm: tFormed, nominalMm: nominal };
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npm run test -- asme.test.ts 2>&1 | tail -20
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/calculations.ts src/test/asme.test.ts
git commit -m "feat: add ASME UG-27/UG-32 thickness calculation functions and stress tables"
```

---

## Task 3 — Filter plates and nozzle BOM calculations (TDD)

**Files:**
- Modify: `src/test/asme.test.ts`
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/types.ts` (imports only)

- [ ] **Step 1: Add failing tests to `asme.test.ts`**

Append to `src/test/asme.test.ts`:

```typescript
import {
  getASMEAllowableStress,
  calculateLiquidHead,
  calculateUG27Shell,
  calculateUG32Head,
  calculateFilterPlates,
  calculateNozzleBOM,
} from '@/lib/calculations';
import { NozzleSpec, FilterPlateResult, NozzleBOMItem } from '@/lib/types';

describe('calculateFilterPlates', () => {
  it('calculates weight and cost for 2 CS filter plates, ID=1000mm', () => {
    // Area = π × (0.5)² = 0.7854 m²
    // Weight per plate = 0.7854 × (22.3/1000) × 7850 = 137.4 kg
    const result = calculateFilterPlates(2, 1000, 'carbon_steel', 4.50);
    expect(result.count).toBe(2);
    expect(result.diameterMm).toBe(1000);
    expect(result.thicknessMm).toBe(22.3);
    expect(result.weightPerPlateKg).toBeCloseTo(137.4, 0);
    expect(result.totalWeightKg).toBeCloseTo(274.8, 0);
    expect(result.totalCost).toBeCloseTo(274.8 * 2 * 4.50, 0);
  });

  it('uses 22mm thickness for stainless steel', () => {
    const result = calculateFilterPlates(1, 800, 'stainless_steel', 12.00);
    expect(result.thicknessMm).toBe(22);
  });

  it('returns zero-cost result for count=0', () => {
    const result = calculateFilterPlates(0, 1000, 'carbon_steel', 4.50);
    expect(result.totalWeightKg).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe('calculateNozzleBOM', () => {
  it('returns fastener set for 1× B16.5 24" manhole', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'manhole', standard: 'B16.5', size: '24"',
      flangeType: 'slip_on_rf', quantity: 1,
    }];
    const bom = calculateNozzleBOM(nozzles);
    expect(bom).toHaveLength(1);
    expect(bom[0].fasteners).not.toBeNull();
    expect(bom[0].fasteners!.boltCount).toBe(20);
    expect(bom[0].fasteners!.nutCount).toBe(20);
    expect(bom[0].fasteners!.washerCount).toBe(40);
  });

  it('multiplies fastener set by quantity for 2× manholes', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'manhole', standard: 'PN16', size: 'DN600',
      flangeType: 'weld_neck', quantity: 2,
    }];
    const bom = calculateNozzleBOM(nozzles);
    expect(bom[0].fasteners!.boltCount).toBe(40);   // 20 × 2
    expect(bom[0].fasteners!.washerCount).toBe(80);  // 40 × 2
  });

  it('returns null fasteners for a plain nozzle', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', standard: 'B16.5', size: 'NPS 4',
      flangeType: 'weld_neck', quantity: 3,
    }];
    const bom = calculateNozzleBOM(nozzles);
    expect(bom[0].fasteners).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm run test -- asme.test.ts 2>&1 | grep -E 'FAIL|calculateFilterPlates|calculateNozzleBOM'
```

Expected: errors about missing exports.

- [ ] **Step 3: Implement the two functions in `calculations.ts`**

Update the import from `types.ts` to also include the new types:

```typescript
import {
  VesselInputs, PlateSize, PricingData, AdvancedSettings, DEFAULT_ADVANCED,
  CS_PLATE_SIZES, SS_PLATE_SIZES, CS_DENSITY, SS_DENSITY,
  ShellOption, CourseDetail, CalculationResults,
  MaterialType, SSGrade, HeadType,
  CS_THICKNESSES, SS_THICKNESSES,
  ALLOWABLE_STRESS_SA516_GR70, ALLOWABLE_STRESS_SS304, ALLOWABLE_STRESS_SS316,
  ASMEThicknessResult, FilterPlateResult, NozzleSpec, NozzleBOMItem,
  MANHOLE_FASTENERS,
} from './types';
```

Then add after `calculateUG32Head`:

```typescript
// ─── Filter plates ───

export function calculateFilterPlates(
  count: number,
  idMm: number,
  materialType: MaterialType,
  pricePerKg: number,
): FilterPlateResult {
  if (count === 0) {
    return { count: 0, diameterMm: idMm, thicknessMm: 0, weightPerPlateKg: 0, totalWeightKg: 0, totalCost: 0 };
  }
  const thicknessMm = materialType === 'carbon_steel' ? 22.3 : 22;
  const density = materialType === 'carbon_steel' ? CS_DENSITY : SS_DENSITY;
  const radiusM = (idMm / 1000) / 2;
  const areaM2 = Math.PI * radiusM * radiusM;
  const weightPerPlate = areaM2 * (thicknessMm / 1000) * density;
  const totalWeight = weightPerPlate * count;
  return {
    count,
    diameterMm: idMm,
    thicknessMm,
    weightPerPlateKg: weightPerPlate,
    totalWeightKg: totalWeight,
    totalCost: totalWeight * pricePerKg,
  };
}

// ─── Nozzle / Manhole BOM ───

export function calculateNozzleBOM(nozzles: NozzleSpec[]): NozzleBOMItem[] {
  return nozzles.map(spec => {
    if (spec.type !== 'manhole') {
      return { spec, fasteners: null };
    }
    // Determine fastener key
    let key: string;
    if (spec.standard === 'B16.5') {
      key = 'B16.5_24';
    } else if (spec.standard === 'PN10') {
      key = 'PN10_DN600';
    } else {
      key = 'PN16_DN600';
    }
    const base = MANHOLE_FASTENERS[key];
    return {
      spec,
      fasteners: {
        boltCount: base.boltCount * spec.quantity,
        boltSpec: base.boltSpec,
        nutCount: base.nutCount * spec.quantity,
        washerCount: base.washerCount * spec.quantity,
      },
    };
  });
}
```

- [ ] **Step 4: Run all tests — all should pass**

```bash
npm run test -- asme.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.ts src/lib/types.ts src/test/asme.test.ts
git commit -m "feat: add filter plate and nozzle BOM calculation functions"
```

---

## Task 4 — Leg support and Zick saddle calculations (TDD)

**Files:**
- Modify: `src/test/asme.test.ts`
- Modify: `src/lib/calculations.ts`

- [ ] **Step 1: Add failing tests for leg and Zick calculations**

Append to `src/test/asme.test.ts`:

```typescript
import {
  getASMEAllowableStress, calculateLiquidHead, calculateUG27Shell, calculateUG32Head,
  calculateFilterPlates, calculateNozzleBOM, calculateLegs, calculateZickSaddle,
} from '@/lib/calculations';
import { LegInputs, SaddleInputs } from '@/lib/types';

describe('calculateLegs', () => {
  it('calculates 4 CS legs: OD=168.3mm, t=7.11mm, L=600mm', () => {
    // Pipe volume per leg = π × ((OD/2)² - (ID/2)²) × L
    // OD=0.1683m, t=0.00711m, ID=0.1541m, L=0.6m
    // area = π×((0.08415)²-(0.07705)²) = π×(0.007081-0.005937) = 0.003593 m²
    // volume = 0.003593 × 0.6 = 0.002156 m³
    // weight = 0.002156 × 7850 = 16.92 kg per leg
    const legInputs: LegInputs = { pipeOD: 168.3, pipeThickness: 7.11, legLength: 600 };
    const result = calculateLegs(legInputs, 'carbon_steel', 4.50);
    expect(result.weightPerLegKg).toBeCloseTo(16.92, 0);
    expect(result.basePlateSizeMm).toBeCloseTo(168.3 * 1.1, 1);  // 185.1mm
    // base plate: 185.1mm × 185.1mm × 12mm (default), density 7850
    // weight = (0.1851)² × 0.012 × 7850 = 3.226 kg
    expect(result.basePlateWeightKg).toBeCloseTo(3.226, 0);
    expect(result.totalWeightKg).toBeCloseTo((16.92 + 3.226) * 4, 0);
  });
});

describe('calculateZickSaddle', () => {
  it('computes M1, M2 for a simple test case', () => {
    // Vessel: L=10000mm, OD=1219mm, t=8mm, H(head)=250mm
    // W=50000N (empty vessel weight), A=1000mm, b=300mm, angle=120°
    // Q = W/2 = 25000 N
    // R = (1219 - 8) / 2 = 605.5mm = 0.6055m
    // H = 0.250m (given or estimated as ID/4 = (1219-16)/4 ≈ 300mm — use 250 for test)
    // M1 = Q*A*[1 - (1-A/L+(R²-H²)/(2AL)) / (1+4H/(3L))]
    // M2 = Q*L/4 * [(1+2(R²-H²)/L²) / (1+4H/(3L)) - 4A/L]
    const saddleInputs: SaddleInputs = { angle: 120, width: 300, distanceA: 1000 };
    const result = calculateZickSaddle(
      { L: 10000, OD: 1219, t: 8, H: 250 },
      saddleInputs,
      50000,
      138,
      'carbon_steel',
      4.50,
    );
    // Q = 25000 N
    expect(result.QN).toBe(25000);
    // Verify M1 > 0 and M2 > 0 (both positive for typical geometry)
    expect(result.M1Nm).toBeGreaterThan(0);
    expect(result.M2Nm).toBeGreaterThan(0);
    // sigma1 = M1/(π × Rm² × t) — should be < allowable 138 MPa for this light loading
    expect(result.sigma1MPa).toBeLessThan(138);
    expect(result.sigma2MPa).toBeLessThan(138);
    expect(result.sigma1Pass).toBe(true);
    expect(result.sigma2Pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm run test -- asme.test.ts 2>&1 | grep -E 'FAIL|calculateLegs|calculateZickSaddle'
```

Expected: errors about missing exports.

- [ ] **Step 3: Implement `calculateLegs` and `calculateZickSaddle` in `calculations.ts`**

Update the import to also bring in `LegInputs`, `SaddleInputs`, `LegSupportResult`, `ZickResult`:

```typescript
import {
  VesselInputs, PlateSize, PricingData, AdvancedSettings, DEFAULT_ADVANCED,
  CS_PLATE_SIZES, SS_PLATE_SIZES, CS_DENSITY, SS_DENSITY,
  ShellOption, CourseDetail, CalculationResults,
  MaterialType, SSGrade, HeadType,
  CS_THICKNESSES, SS_THICKNESSES,
  ALLOWABLE_STRESS_SA516_GR70, ALLOWABLE_STRESS_SS304, ALLOWABLE_STRESS_SS316,
  ASMEThicknessResult, FilterPlateResult, NozzleSpec, NozzleBOMItem,
  MANHOLE_FASTENERS, LegInputs, SaddleInputs, LegSupportResult, ZickResult,
} from './types';
```

Add after `calculateNozzleBOM`:

```typescript
// ─── Vertical vessel — pipe leg supports ───

export function calculateLegs(
  legInputs: LegInputs,
  materialType: MaterialType,
  pricePerKg: number,
): LegSupportResult {
  const density = materialType === 'carbon_steel' ? CS_DENSITY : SS_DENSITY;
  const { pipeOD, pipeThickness, legLength } = legInputs;
  const OD_m = pipeOD / 1000;
  const ID_m = (pipeOD - 2 * pipeThickness) / 1000;
  const L_m = legLength / 1000;
  const crossSectionM2 = Math.PI / 4 * (OD_m * OD_m - ID_m * ID_m);
  const weightPerLeg = crossSectionM2 * L_m * density;

  const basePlateSizeMm = pipeOD * 1.1;
  const basePlateThicknessMm = 12; // standard base plate thickness
  const baseSide_m = basePlateSizeMm / 1000;
  const basePlateWeight = baseSide_m * baseSide_m * (basePlateThicknessMm / 1000) * density;

  const totalWeight = (weightPerLeg + basePlateWeight) * 4;
  return {
    pipeOD,
    pipeThickness,
    legLength,
    basePlateSizeMm,
    weightPerLegKg: weightPerLeg,
    basePlateWeightKg: basePlateWeight,
    totalWeightKg: totalWeight,
    totalCost: totalWeight * pricePerKg,
  };
}

// ─── Horizontal vessel — Zick saddle analysis ───

interface ZickVesselGeometry {
  L: number;   // tangent-to-tangent shell length (mm)
  OD: number;  // outer diameter (mm)
  t: number;   // shell plate thickness (mm)
  H: number;   // dish end depth (mm) — use ID/4 for 2:1 ellipsoidal
}

export function calculateZickSaddle(
  vessel: ZickVesselGeometry,
  saddleInputs: SaddleInputs,
  totalVesselWeightN: number,
  S_MPa: number,
  materialType: MaterialType,
  pricePerKg: number,
): ZickResult {
  const density = materialType === 'carbon_steel' ? CS_DENSITY : SS_DENSITY;
  const { L, OD, t, H } = vessel;
  const { width: b, distanceA: A } = saddleInputs;

  // Convert to metres for stress calculations
  const L_m = L / 1000;
  const H_m = H / 1000;
  const A_m = A / 1000;
  const Rm_m = (OD - t) / 2 / 1000; // mean shell radius
  const t_m = t / 1000;

  const Q = totalVesselWeightN / 2; // load per saddle

  const denom = 1 + (4 * H_m) / (3 * L_m);

  // Longitudinal bending moment at saddle (N·m)
  const M1_num = 1 - A_m / L_m + (Rm_m * Rm_m - H_m * H_m) / (2 * A_m * L_m);
  const M1 = Q * A_m * (1 - M1_num / denom);

  // Longitudinal bending moment at midspan (N·m)
  const M2_term1 = (1 + 2 * (Rm_m * Rm_m - H_m * H_m) / (L_m * L_m)) / denom;
  const M2 = (Q * L_m / 4) * (M2_term1 - 4 * A_m / L_m);

  // Section modulus of thin cylindrical shell: Z = π × Rm² × t
  const Z_m3 = Math.PI * Rm_m * Rm_m * t_m;

  const sigma1 = Math.abs(M1) / Z_m3 / 1e6; // MPa
  const sigma2 = Math.abs(M2) / Z_m3 / 1e6; // MPa

  // Saddle plate geometry — for material estimate (2 saddles)
  const saddleHeightMm = OD * 0.2; // rule-of-thumb: 20% of OD
  const plateTmm = 18;
  const basePlateArea_m2 = (b / 1000) * ((OD + 200) / 1000);
  const webPlateArea_m2 = (b / 1000) * (saddleHeightMm / 1000);
  const ribPlateArea_m2 = (150 / 1000) * (saddleHeightMm / 1000);
  const plateTm = plateTmm / 1000;
  const saddleWeight1 = (basePlateArea_m2 + webPlateArea_m2 + 6 * ribPlateArea_m2) * plateTm * density;
  const totalSaddleWeight = saddleWeight1 * 2;

  return {
    QN: Q,
    M1Nm: M1,
    M2Nm: M2,
    sigma1MPa: sigma1,
    sigma2MPa: sigma2,
    allowableMPa: S_MPa,
    sigma1Pass: sigma1 <= S_MPa,
    sigma2Pass: sigma2 <= S_MPa,
    saddleWeightKg: totalSaddleWeight,
    totalSaddleCost: totalSaddleWeight * pricePerKg,
  };
}
```

- [ ] **Step 4: Run all tests — all should pass**

```bash
npm run test -- asme.test.ts 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.ts src/test/asme.test.ts
git commit -m "feat: add leg support and Zick saddle calculations"
```

---

## Task 5 — Wire new inputs and calculations into context

**Files:**
- Modify: `src/lib/context.tsx`

- [ ] **Step 1: Extend `defaultInputs` in `context.tsx`**

In `context.tsx`, update the `defaultInputs` object to include the new Phase 2 fields:

```typescript
const defaultInputs: VesselInputs = {
  projectName: '',
  tagNumber: '',
  designPressure: 0,
  designTemperature: 20,
  diameterType: 'OD',
  diameter: 0,
  shellLength: 0,
  plateThickness: 6.40,
  materialType: 'carbon_steel' as MaterialType,
  ssGrade: 'SS304' as SSGrade,
  rubberLining: false,
  quantity: 1,
  // Phase 2 defaults
  orientation: 'vertical',
  jointEfficiency: 1.0,
  corrosionAllowance: 3,
  fluidDensity: 1000,
  liquidHeight: 0,
  totalDesignPressureOverride: 0,
  filterPlateCount: 0,
  nozzles: [],
  legInputs: { pipeOD: 114.3, pipeThickness: 6.02, legLength: 600 },
  saddleInputs: { angle: 120, width: 300, distanceA: 500 },
};
```

- [ ] **Step 2: Import new functions into context**

At the top of `context.tsx`, update the calculations import:

```typescript
import { calculateAll, getASMEAllowableStress, calculateLiquidHead, calculateUG27Shell, calculateUG32Head, calculateFilterPlates, calculateNozzleBOM, calculateLegs, calculateZickSaddle } from './calculations';
```

Also update the types import to include new types:

```typescript
import {
  VesselInputs, CalculationResults, PricingData, DEFAULT_PRICING, AdvancedSettings,
  DEFAULT_ADVANCED, HistoryEntry, MaterialType, SSGrade, DishEndInputs, HeadType,
  SupportResult, ZickVesselGeometry,
} from './types';
```

Wait — `ZickVesselGeometry` is a local interface inside calculations.ts, not exported from types. Don't import it from types. Instead, the Zick call in context will construct the geometry object inline.

- [ ] **Step 3: Extend `runCalculation` to compute Phase 2 results**

In `context.tsx`, inside `runCalculation`, after the dish end block and before `setResults(calc)`, add:

```typescript
    // ─── Phase 2: ASME thickness ───
    const { id } = calc;
    if (inputs.designPressure > 0 && inputs.designTemperature >= 20 && inputs.designTemperature <= 400) {
      try {
        const S = getASMEAllowableStress(inputs.materialType, inputs.ssGrade, inputs.designTemperature);
        const P_top_MPa = inputs.designPressure / 1000; // kPa → MPa
        const liquidMPa = inputs.orientation === 'vertical'
          ? calculateLiquidHead(inputs.liquidHeight, inputs.fluidDensity)
          : 0;
        const P_total = inputs.totalDesignPressureOverride > 0
          ? inputs.totalDesignPressureOverride / 1000
          : P_top_MPa + liquidMPa;
        const R_mm = id / 2;
        const shellResult = calculateUG27Shell(P_total, R_mm, S, inputs.jointEfficiency, inputs.corrosionAllowance, inputs.materialType);
        const headResult = calc.dishEnd
          ? calculateUG32Head(P_total, id, calc.dishEnd.inputs.headType, S, inputs.jointEfficiency, inputs.corrosionAllowance, inputs.materialType)
          : calculateUG32Head(P_total, id, 'ellipsoidal', S, inputs.jointEfficiency, inputs.corrosionAllowance, inputs.materialType);
        calc.asmeThickness = {
          totalDesignPressureMPa: P_total,
          liquidHeadMPa: liquidMPa,
          allowableStressMPa: S,
          shellTminMm: shellResult.tMinMm,
          shellNominalMm: shellResult.nominalMm,
          shellThinWallWarning: shellResult.thinWallWarning,
          headTminMm: headResult.tMinMm,
          headTformedMm: headResult.tFormedMm,
          headNominalMm: headResult.nominalMm,
        };
      } catch {
        // Out-of-range temperature — skip ASME result silently (form validation catches it)
      }
    }

    // ─── Phase 2: Filter plates ───
    if (inputs.filterPlateCount > 0) {
      const pricePerKg = inputs.materialType === 'carbon_steel' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
      calc.filterPlates = calculateFilterPlates(inputs.filterPlateCount, id, inputs.materialType, pricePerKg);
      calc.grandTotal += calc.filterPlates.totalCost;
    }

    // ─── Phase 2: Nozzle BOM ───
    if (inputs.nozzles.length > 0) {
      calc.nozzleBOM = calculateNozzleBOM(inputs.nozzles);
    }

    // ─── Phase 2: Supports ───
    const pricePerKg = inputs.materialType === 'carbon_steel' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
    if (inputs.orientation === 'vertical') {
      const legs = calculateLegs(inputs.legInputs, inputs.materialType, pricePerKg);
      calc.support = { type: 'legs', legs };
      calc.grandTotal += legs.totalCost;
    } else {
      // Horizontal: Zick — need total vessel weight
      const shellWeightN = calc.shellOptions[0]
        ? (calc.shellOptions[0].totalWeight ?? 0) * 9.81
        : 0;
      const headWeightN = calc.dishEnd ? calc.dishEnd.totalWeightKg * 9.81 : 0;
      const totalWeightN = shellWeightN + headWeightN;
      if (totalWeightN > 0 && calc.asmeThickness) {
        const H_mm = id / 4; // 2:1 ellipsoidal approximation
        const saddles = calculateZickSaddle(
          { L: inputs.shellLength, OD: calc.od, t: inputs.plateThickness, H: H_mm },
          inputs.saddleInputs,
          totalWeightN,
          calc.asmeThickness.allowableStressMPa,
          inputs.materialType,
          pricePerKg,
        );
        calc.support = { type: 'saddles', saddles };
        calc.grandTotal += saddles.totalSaddleCost;
      }
    }
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | grep -E 'error TS|Error'
```

Expected: no errors. If there are type errors from the new VesselInputs fields, ensure `defaultInputs` includes all required fields.

- [ ] **Step 5: Commit**

```bash
git add src/lib/context.tsx
git commit -m "feat: wire Phase 2 ASME calculations into runCalculation"
```

---

## Task 6 — Add Orientation & Design Parameters form card

**Files:**
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Add new imports to `Index.tsx`**

The existing imports already cover `Select`, `Label`, `Input`, `Card`, etc. Add to the `@/lib/types` import:

```typescript
import {
  CS_THICKNESSES,
  SS_THICKNESSES,
  HeadType,
  StraightFace,
  VesselOrientation,
} from "@/lib/types";
```

- [ ] **Step 2: Add the "Orientation & Design" card after the Vessel Identity card**

In `Index.tsx`, after the closing `</Card>` of the Vessel Identity card (Card 1), insert:

```tsx
{/* Card — Orientation & Design Parameters */}
<Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold flex items-center gap-2">
      <Ruler className="h-4 w-4 text-primary" />
      Orientation & Design Parameters
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    {/* Orientation toggle */}
    <div className="space-y-2">
      <Label>Vessel Orientation</Label>
      <Select
        value={inputs.orientation}
        onValueChange={(v) => update("orientation", v as VesselOrientation)}
      >
        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="vertical">Vertical (standing upright)</SelectItem>
          <SelectItem value="horizontal">Horizontal (saddle-supported)</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Design Pressure */}
      <div className="space-y-2">
        <Label>Design Pressure (kPa)</Label>
        <Input
          type="number"
          min={0}
          value={inputs.designPressure || ""}
          onChange={(e) => update("designPressure", parseFloat(e.target.value) || 0)}
          placeholder="e.g. 1000"
          className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
        />
      </div>
      {/* Design Temperature */}
      <div className="space-y-2">
        <Label>Design Temperature (°C)</Label>
        <Input
          type="number"
          min={20}
          max={400}
          value={inputs.designTemperature || ""}
          onChange={(e) => update("designTemperature", parseFloat(e.target.value) || 20)}
          placeholder="20–400"
          className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
        />
      </div>
      {/* Joint Efficiency */}
      <div className="space-y-2">
        <Label>Joint Efficiency (E)</Label>
        <Select
          value={String(inputs.jointEfficiency)}
          onValueChange={(v) => update("jointEfficiency", parseFloat(v))}
        >
          <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1.00 — Full radiography (RT1/RT2)</SelectItem>
            <SelectItem value="0.85">0.85 — Spot radiography (RT3)</SelectItem>
            <SelectItem value="0.7">0.70 — No radiography (RT4)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Corrosion Allowance */}
      <div className="space-y-2">
        <Label>Corrosion Allowance (mm)</Label>
        <Input
          type="number"
          min={0}
          step={0.5}
          value={inputs.corrosionAllowance ?? ""}
          onChange={(e) => update("corrosionAllowance", parseFloat(e.target.value) || 0)}
          placeholder="e.g. 3"
          className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
        />
      </div>
    </div>

    {/* Liquid head (vertical only) */}
    {inputs.orientation === "vertical" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Fluid Density (kg/m³)</Label>
          <Input
            type="number"
            min={1}
            value={inputs.fluidDensity || ""}
            onChange={(e) => update("fluidDensity", parseFloat(e.target.value) || 1000)}
            placeholder="1000 (water)"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label>Liquid Height in Vessel (mm)</Label>
          <Input
            type="number"
            min={0}
            value={inputs.liquidHeight || ""}
            onChange={(e) => update("liquidHeight", parseFloat(e.target.value) || 0)}
            placeholder="e.g. 3000"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Total Design Pressure Override (kPa)</Label>
          <Input
            type="number"
            min={0}
            value={inputs.totalDesignPressureOverride || ""}
            onChange={(e) => update("totalDesignPressureOverride", parseFloat(e.target.value) || 0)}
            placeholder="0 = auto (top pressure + liquid head)"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Leave 0 to auto-calculate. Enter a value to override.</p>
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 3: Verify app renders without errors**

```bash
npm run dev
```

Open `http://localhost:8080`. Confirm the new card appears between Vessel Identity and Shell Vessel. Verify the liquid head fields show/hide when switching orientation.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat: add Orientation and Design Parameters form card"
```

---

## Task 7 — Add Filter Plates, Nozzles, and Support form cards

**Files:**
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Add Filter Plates card after the Dish End card**

After the closing `</Card>` of the Dish End card, insert:

```tsx
{/* Card — Filter Plates */}
<Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold flex items-center gap-2">
      <CircleDot className="h-4 w-4 text-primary" />
      Filter Plates
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    <div className="space-y-2">
      <Label>Number of Filter Plates</Label>
      <p className="text-xs text-muted-foreground">
        Circular plates at vessel ID. CS: 22.3 mm thick · SS: 22 mm thick
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => update("filterPlateCount", Math.max(0, inputs.filterPlateCount - 1))}
          className="h-9 w-9 rounded-lg border border-input flex items-center justify-center hover:bg-secondary"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center font-mono text-sm">{inputs.filterPlateCount}</span>
        <button
          type="button"
          onClick={() => update("filterPlateCount", inputs.filterPlateCount + 1)}
          className="h-9 w-9 rounded-lg border border-input flex items-center justify-center hover:bg-secondary"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 2: Add Nozzles & Manholes card**

Add these imports at the top of `Index.tsx` if not already present:

```tsx
import { Trash2 } from "lucide-react";
import { NozzleSpec, FlangeStandard, FlangeType, NozzleItemType } from "@/lib/types";
```

After the Filter Plates card, insert:

```tsx
{/* Card — Nozzles & Manholes */}
<Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold flex items-center gap-2">
      <CircleDot className="h-4 w-4 text-primary" />
      Nozzles & Manholes
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {inputs.nozzles.map((nozzle, idx) => (
      <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end p-3 rounded-lg bg-secondary/30">
        {/* Type */}
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={nozzle.type}
            onValueChange={(v) => {
              const updated = [...inputs.nozzles];
              updated[idx] = { ...updated[idx], type: v as NozzleItemType };
              update("nozzles", updated);
            }}
          >
            <SelectTrigger className="h-9 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nozzle">Nozzle</SelectItem>
              <SelectItem value="manhole">Manhole</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Standard */}
        <div className="space-y-1">
          <Label className="text-xs">Standard</Label>
          <Select
            value={nozzle.standard}
            onValueChange={(v) => {
              const updated = [...inputs.nozzles];
              updated[idx] = { ...updated[idx], standard: v as FlangeStandard };
              update("nozzles", updated);
            }}
          >
            <SelectTrigger className="h-9 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B16.5">ASME B16.5</SelectItem>
              <SelectItem value="PN10">PN10 (DIN/EN)</SelectItem>
              <SelectItem value="PN16">PN16 (DIN/EN)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Size */}
        <div className="space-y-1">
          <Label className="text-xs">Size</Label>
          <Input
            value={nozzle.size}
            onChange={(e) => {
              const updated = [...inputs.nozzles];
              updated[idx] = { ...updated[idx], size: e.target.value };
              update("nozzles", updated);
            }}
            placeholder={nozzle.type === 'manhole' ? (nozzle.standard === 'B16.5' ? '24"' : 'DN600') : 'NPS 4'}
            className="h-9 bg-background text-sm"
          />
        </div>
        {/* Flange type */}
        <div className="space-y-1">
          <Label className="text-xs">Flange Face</Label>
          <Select
            value={nozzle.flangeType}
            onValueChange={(v) => {
              const updated = [...inputs.nozzles];
              updated[idx] = { ...updated[idx], flangeType: v as FlangeType };
              update("nozzles", updated);
            }}
          >
            <SelectTrigger className="h-9 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slip_on_rf">Slip-On RF</SelectItem>
              <SelectItem value="weld_neck">Weld Neck</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Qty + delete */}
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              min={1}
              value={nozzle.quantity}
              onChange={(e) => {
                const updated = [...inputs.nozzles];
                updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 };
                update("nozzles", updated);
              }}
              className="h-9 bg-background text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => update("nozzles", inputs.nozzles.filter((_, i) => i !== idx))}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    ))}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => update("nozzles", [...inputs.nozzles, { type: 'nozzle', standard: 'B16.5', size: '', flangeType: 'weld_neck', quantity: 1 }])}
    >
      <PlusIcon className="h-4 w-4 mr-2" /> Add Nozzle / Manhole
    </Button>
  </CardContent>
</Card>
```

- [ ] **Step 3: Add Supports card (conditional on orientation)**

After the Nozzles card, insert:

```tsx
{/* Card — Supports */}
<Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold flex items-center gap-2">
      <Ruler className="h-4 w-4 text-primary" />
      {inputs.orientation === "vertical" ? "Leg Supports (4 legs)" : "Saddle Supports (2 saddles)"}
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    {inputs.orientation === "vertical" ? (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label>Leg Pipe OD (mm)</Label>
          <Input
            type="number" min={1}
            value={inputs.legInputs.pipeOD || ""}
            onChange={(e) => update("legInputs", { ...inputs.legInputs, pipeOD: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 168.3"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label>Leg Pipe Wall Thickness (mm)</Label>
          <Input
            type="number" min={1}
            value={inputs.legInputs.pipeThickness || ""}
            onChange={(e) => update("legInputs", { ...inputs.legInputs, pipeThickness: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 7.11"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label>Leg Length (mm)</Label>
          <Input
            type="number" min={1}
            value={inputs.legInputs.legLength || ""}
            onChange={(e) => update("legInputs", { ...inputs.legInputs, legLength: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 600"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground md:col-span-3">
          Base plate auto-sized to 10% larger than pipe OD (square). Base plate thickness: 12 mm.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label>Saddle Contact Angle (°)</Label>
          <Input
            type="number" min={90} max={180}
            value={inputs.saddleInputs.angle || ""}
            onChange={(e) => update("saddleInputs", { ...inputs.saddleInputs, angle: parseFloat(e.target.value) || 120 })}
            placeholder="120"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label>Saddle Width b (mm)</Label>
          <Input
            type="number" min={50}
            value={inputs.saddleInputs.width || ""}
            onChange={(e) => update("saddleInputs", { ...inputs.saddleInputs, width: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 300"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <Label>Distance A — Tangent to Saddle (mm)</Label>
          <Input
            type="number" min={0}
            value={inputs.saddleInputs.distanceA || ""}
            onChange={(e) => update("saddleInputs", { ...inputs.saddleInputs, distanceA: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 500"
            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground md:col-span-3">
          Zick analysis (L.P. Zick, 1951) — longitudinal bending stresses at saddle and midspan.
          Results are estimation only; FEA required for code-certified designs.
        </p>
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: Verify app renders all new cards without console errors**

```bash
npm run dev
```

Check that: orientation card shows, switching vertical↔horizontal changes support card title and fields, nozzle add/remove rows work, filter plate ±buttons work.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat: add Filter Plates, Nozzles, and Supports form cards"
```

---

## Task 8 — Add Phase 2 results to Results page

**Files:**
- Modify: `src/pages/Results.tsx`

First, read the file to understand the current structure. The existing Results page has a dark header card, shell options section, dish end section, and a sticky invoice panel on the right. We'll add new cards in the left column and new line items in the invoice panel.

- [ ] **Step 1: Add the ASME Thickness summary card**

In `Results.tsx`, find the dark header card (it shows project name, OD, ID etc.). After its closing `</Card>`, add:

```tsx
{/* ASME Thickness Results */}
{results.asmeThickness && (
  <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold">ASME Section VIII Div.1 — Required Thickness</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <p className="text-muted-foreground text-xs">Total Design Pressure</p>
          <p className="font-semibold">{(results.asmeThickness.totalDesignPressureMPa * 1000).toFixed(1)} kPa</p>
          {results.asmeThickness.liquidHeadMPa > 0 && (
            <p className="text-xs text-muted-foreground">incl. {(results.asmeThickness.liquidHeadMPa * 1000).toFixed(1)} kPa liquid head</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Allowable Stress (S)</p>
          <p className="font-semibold">{results.asmeThickness.allowableStressMPa.toFixed(1)} MPa</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left pb-2">Component</th>
            <th className="text-right pb-2">t_min (mm)</th>
            <th className="text-right pb-2">t_formed (mm)</th>
            <th className="text-right pb-2">Recommended Nominal</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50">
            <td className="py-2">Shell (UG-27)</td>
            <td className="text-right">{results.asmeThickness.shellTminMm.toFixed(2)}</td>
            <td className="text-right text-muted-foreground">—</td>
            <td className="text-right font-semibold text-primary">{results.asmeThickness.shellNominalMm} mm</td>
          </tr>
          <tr>
            <td className="py-2">Head (UG-32)</td>
            <td className="text-right">{results.asmeThickness.headTminMm.toFixed(2)}</td>
            <td className="text-right">{results.asmeThickness.headTformedMm.toFixed(2)}</td>
            <td className="text-right font-semibold text-primary">{results.asmeThickness.headNominalMm} mm</td>
          </tr>
        </tbody>
      </table>
      {results.asmeThickness.shellThinWallWarning && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          ⚠ Thick-wall condition detected (t ≥ R/2). Manual engineering review required.
        </p>
      )}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 2: Add Filter Plates card**

After the ASME card (still inside the left column), add:

```tsx
{/* Filter Plates */}
{results.filterPlates && results.filterPlates.count > 0 && (
  <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold">Filter Plates</CardTitle>
    </CardHeader>
    <CardContent>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left pb-2">Qty</th>
            <th className="text-right pb-2">Diameter</th>
            <th className="text-right pb-2">Thickness</th>
            <th className="text-right pb-2">Weight each</th>
            <th className="text-right pb-2">Total weight</th>
            <th className="text-right pb-2">Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-2">{results.filterPlates.count}</td>
            <td className="text-right">{results.filterPlates.diameterMm} mm</td>
            <td className="text-right">{results.filterPlates.thicknessMm} mm</td>
            <td className="text-right">{results.filterPlates.weightPerPlateKg.toFixed(1)} kg</td>
            <td className="text-right">{results.filterPlates.totalWeightKg.toFixed(1)} kg</td>
            <td className="text-right font-semibold">{formatCurrency(results.filterPlates.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Add Nozzle BOM card**

```tsx
{/* Nozzle / Manhole BOM */}
{results.nozzleBOM && results.nozzleBOM.length > 0 && (
  <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold">Nozzles & Manholes — Bill of Materials</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground mb-3">
        Fastener quantities shown are per blind flange (manholes only). Nozzle reinforcement per UG-37 not included.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left pb-2">Type</th>
            <th className="text-left pb-2">Standard / Size</th>
            <th className="text-left pb-2">Face</th>
            <th className="text-right pb-2">Qty</th>
            <th className="text-left pb-2">Bolts</th>
            <th className="text-right pb-2">Nuts</th>
            <th className="text-right pb-2">Washers</th>
          </tr>
        </thead>
        <tbody>
          {results.nozzleBOM.map((item, idx) => (
            <tr key={idx} className="border-b border-border/50">
              <td className="py-2 capitalize">{item.spec.type}</td>
              <td>{item.spec.standard} {item.spec.size}</td>
              <td className="text-xs">{item.spec.flangeType === 'slip_on_rf' ? 'SO-RF' : 'WN'}</td>
              <td className="text-right">{item.spec.quantity}</td>
              {item.fasteners ? (
                <>
                  <td className="text-xs">{item.fasteners.boltCount}× {item.fasteners.boltSpec}</td>
                  <td className="text-right">{item.fasteners.nutCount}</td>
                  <td className="text-right">{item.fasteners.washerCount}</td>
                </>
              ) : (
                <td className="text-xs text-muted-foreground" colSpan={3}>— (nozzle, no blind flange)</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: Add Support Results card**

```tsx
{/* Support Results */}
{results.support && (
  <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold">
        {results.support.type === 'legs' ? 'Leg Supports (4 × pipe legs)' : 'Saddle Supports — Zick Analysis'}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {results.support.type === 'legs' && results.support.legs && (() => {
        const l = results.support.legs;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Pipe OD</p><p className="font-semibold">{l.pipeOD} mm</p></div>
            <div><p className="text-xs text-muted-foreground">Wall Thickness</p><p className="font-semibold">{l.pipeThickness} mm</p></div>
            <div><p className="text-xs text-muted-foreground">Leg Length</p><p className="font-semibold">{l.legLength} mm</p></div>
            <div><p className="text-xs text-muted-foreground">Base Plate (square)</p><p className="font-semibold">{l.basePlateSizeMm.toFixed(0)} × {l.basePlateSizeMm.toFixed(0)} mm</p></div>
            <div><p className="text-xs text-muted-foreground">Weight per leg</p><p className="font-semibold">{l.weightPerLegKg.toFixed(1)} kg</p></div>
            <div><p className="text-xs text-muted-foreground">Total (4 legs + plates)</p><p className="font-semibold">{l.totalWeightKg.toFixed(1)} kg</p></div>
            <div className="md:col-span-3 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Support Material Cost</p>
              <p className="font-semibold text-primary">{formatCurrency(l.totalCost)}</p>
            </div>
          </div>
        );
      })()}
      {results.support.type === 'saddles' && results.support.saddles && (() => {
        const z = results.support.saddles;
        return (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-2">Stress check</th>
                  <th className="text-right pb-2">Value (MPa)</th>
                  <th className="text-right pb-2">Allowable (MPa)</th>
                  <th className="text-right pb-2">Result</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2">Longitudinal bending at saddle (σ1)</td>
                  <td className="text-right">{z.sigma1MPa.toFixed(2)}</td>
                  <td className="text-right">{z.allowableMPa.toFixed(1)}</td>
                  <td className={`text-right font-semibold ${z.sigma1Pass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {z.sigma1Pass ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Longitudinal bending at midspan (σ2)</td>
                  <td className="text-right">{z.sigma2MPa.toFixed(2)}</td>
                  <td className="text-right">{z.allowableMPa.toFixed(1)}</td>
                  <td className={`text-right font-semibold ${z.sigma2Pass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {z.sigma2Pass ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Load per saddle (Q)</p><p className="font-semibold">{(z.QN / 1000).toFixed(1)} kN</p></div>
              <div><p className="text-xs text-muted-foreground">Saddle steel weight (×2)</p><p className="font-semibold">{z.saddleWeightKg.toFixed(1)} kg</p></div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Saddle Material Cost</p>
              <p className="font-semibold text-primary">{formatCurrency(z.totalSaddleCost)}</p>
            </div>
          </div>
        );
      })()}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5: Add disclaimer banner at the bottom of the left column**

After all result cards, before the closing of the left column div, add:

```tsx
{/* Disclaimer */}
<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-400">
  <strong>Estimation only.</strong> ASME thickness calculations and support estimates are for fabrication costing
  purposes only. Nozzle reinforcement (UG-37), external pressure (UG-28), and seismic/wind loads are not
  calculated. Results are not a substitute for a code-certified engineering design.
</div>
```

- [ ] **Step 6: Verify full results page in browser**

```bash
npm run dev
```

Fill in a complete estimate (pressure=1000 kPa, temp=100°C, E=1.0, CA=3mm, 1000mm OD, 3000mm length, add a manhole, add legs). Run calculation. Confirm ASME card shows correct values and manhole BOM table shows 20 bolts.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Results.tsx
git commit -m "feat: add ASME, filter plates, nozzle BOM, and support result cards to Results page"
```

---

## Task 9 — Final checks

**Files:**
- Run tests and build

- [ ] **Step 1: Run full test suite**

```bash
npm run test 2>&1 | tail -20
```

Expected: all tests pass (including pre-existing `example.test.ts`).

- [ ] **Step 2: Production build check**

```bash
npm run build 2>&1 | grep -E 'error|warning' | head -20
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Manual end-to-end smoke test**

Test case:
- Material: Carbon Steel
- Orientation: Vertical
- Design Pressure: 1000 kPa
- Design Temperature: 100°C
- E: 1.0 (full radiography)
- CA: 3mm
- OD: 1000mm, Shell Length: 3000mm, plate thickness: 8mm (leave as default for now)
- Dish end: ellipsoidal
- Liquid height: 3000mm, density: 1000
- Filter plates: 2
- Add 1 manhole: B16.5, 24", slip-on RF, qty 1
- Legs: OD=168.3mm, t=7.11mm, length=600mm

Expected results:
- ASME shell nominal: 8mm, head nominal: 8mm
- Liquid head: ~29.4 kPa
- Filter plates: ~2×137kg, cost shown
- Manhole BOM: 20 bolts (1¼" × 170mm), 20 nuts, 40 washers
- Legs: 4 × ~17kg pipe + 4 × ~3kg base plates, cost shown
- Disclaimer banner visible

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 2 complete — ASME thickness, filter plates, nozzles BOM, and supports"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 2A — Orientation (vertical/horizontal): Task 6 form + Task 5 context
- [x] 2A — UG-27 shell formula: Task 2
- [x] 2A — UG-32 head formulas (ellipsoidal, torispherical, hemispherical, flat): Task 2
- [x] 2A — Allowable stress tables + interpolation: Task 2 (`getASMEAllowableStress`)
- [x] 2A — Forming tolerance (10%): Task 2 (`calculateUG32Head`)
- [x] 2A — Corrosion allowance: Task 2 (all thickness functions)
- [x] 2A — Joint efficiency E: Task 2 (UG-27, UG-32 take E parameter)
- [x] 2A — Liquid head + density input + manual override: Task 5 context, Task 6 form
- [x] 2A — Thin-wall warning (t ≥ R/2): Task 2, Task 8 results
- [x] 2A — Snap to next standard thickness: Task 2 (`getNextNominalThickness`)
- [x] 2B — Filter plates (count, auto-size, weight, cost): Task 3
- [x] 2C — Nozzle/manhole BOM: Task 3 (`calculateNozzleBOM`)
- [x] 2C — B16.5 24" fastener set: Task 1 constants, Task 3
- [x] 2C — PN10/PN16 DN600 fastener set: Task 1 constants, Task 3
- [x] 2C — Slip-On RF vs Weld Neck selection: Task 7 form
- [x] 2D — Vertical: 4 pipe legs, base plates: Task 4, Task 7 form, Task 8 results
- [x] 2D — Horizontal: 2 saddles, Zick M1/M2 stress check: Task 4, Task 7 form, Task 8 results
- [x] 2D — Saddle material quantity (weight + cost): Task 4
- [x] Disclaimer: Task 8, Step 5
- [x] Tests: Tasks 2–4

**No placeholders found.**

**Type consistency confirmed:** `LegSupportResult`, `ZickResult`, `SupportResult`, `ASMEThicknessResult`, `FilterPlateResult`, `NozzleBOMItem`, `NozzleSpec`, `LegInputs`, `SaddleInputs` all defined in Task 1 and used consistently in Tasks 2–8.
