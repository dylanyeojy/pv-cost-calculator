import {
  VesselInputs, PlateSize, PricingData, AdvancedSettings, DEFAULT_ADVANCED,
  CS_PLATE_SIZES, SS_PLATE_SIZES, CS_DENSITY, SS_DENSITY,
  CS_THICKNESSES, SS_THICKNESSES,
  ShellOption, CourseDetail, CalculationResults,
  MaterialType, SSGrade, HeadType,
  ALLOWABLE_STRESS_SA516_GR70, ALLOWABLE_STRESS_SS304, ALLOWABLE_STRESS_SS316,
  FilterPlateResult, NozzleSpec, NozzleBOMItem, MANHOLE_FASTENERS,
  LegInputs, SaddleInputs, LegSupportResult, ZickResult,
} from './types';

// ─── Geometry helpers ───

function shellAreaM2(od: number, length: number): number {
  return Math.PI * (od / 1000) * (length / 1000);
}

// ─── Step 1: Return ALL viable nAround candidates for a single course ───
// weldCostPerMeter is calibrated at referenceThickness = 10 mm

interface CourseOption {
  nAround: number;
  piecesPerPlate: number;
  standardPlates: number;
  boughtMm2: number;
}

function getAllCourseOptions(
  width: number,
  plateLength: number,
  circumference: number,
  quantity: number,
): CourseOption[] {
  const nMin = Math.ceil(circumference / plateLength);
  const results: CourseOption[] = [];
  for (let n = nMin; n <= nMin + 3; n++) {
    const piecesPerPlate = Math.floor((plateLength * n) / circumference);
    if (piecesPerPlate < 1) continue;
    const standardPlates = Math.ceil((n * quantity) / piecesPerPlate);
    const boughtMm2 = standardPlates * width * plateLength;
    results.push({ nAround: n, piecesPerPlate, standardPlates, boughtMm2 });
  }
  return results;
}

// ─── Step 2: Enumerate valid course-width combos (mixed widths allowed) ───
// Restored from original to support mixed-plate configurations.
// Only generates combos whose sum of course widths can cover shellLength.

function uniqueWidths(plates: PlateSize[]): number[] {
  return [...new Set(plates.map(p => p.width))].sort((a, b) => a - b);
}

function lengthsForWidth(w: number, plates: PlateSize[]): number[] {
  return [...new Set(plates.filter(p => p.width === w).map(p => p.length))].sort((a, b) => a - b);
}

function findCourseWidthCombos(shellLength: number, plates: PlateSize[], maxExtra = 2): number[][] {
  const widths = uniqueWidths(plates);
  const maxW = Math.max(...widths);
  const minN = Math.ceil(shellLength / maxW);
  const maxN = minN + maxExtra;

  const results = new Set<string>();
  const combos: number[][] = [];

  function recurse(remaining: number, slots: number, current: number[]) {
    if (remaining <= 0) {
      const sorted = [...current].sort((a, b) => b - a);
      const key = sorted.join(',');
      if (!results.has(key)) {
        results.add(key);
        combos.push(sorted);
      }
      return;
    }
    if (slots === 0) return;
    for (const w of widths) {
      recurse(remaining - w, slots - 1, [...current, w]);
    }
  }

  for (let n = minN; n <= maxN; n++) {
    recurse(shellLength, n, []);
  }

  return combos;
}

// ─── Step 3: Evaluate one shell configuration ───

function evaluateShell(
  courseWidths: number[],
  courseLengths: number[],
  nArounds: number[],
  od: number,
  shellLength: number,
  quantity: number,
): ShellOption {
  const circumference = Math.PI * od;
  const numCourses = courseWidths.length;

  let totalPieces = 0;
  let totalStandardPlates = 0;
  let totalBoughtMm2 = 0;
  const courses: CourseDetail[] = [];

  // Use the original actualH = min(w, remaining) so:
  //  • each course covers only as much shell height as the plate allows
  //  • the shell is physically realizable (sum of actualH = shellLength)
  //  • no negative waste from infeasible single-course configs
  let remaining = shellLength;

  for (let i = 0; i < numCourses; i++) {
    const w = courseWidths[i];
    const l = courseLengths[i];
    const n = nArounds[i];
    const actualH = Math.min(w, remaining);
    remaining -= actualH;

    const piecesPerPlate = Math.floor((l * n) / circumference);
    const standardPlates = piecesPerPlate >= 1
      ? Math.ceil((n * quantity) / piecesPerPlate)
      : n * quantity;
    const boughtMm2 = standardPlates * w * l;

    totalPieces += n * quantity;
    totalStandardPlates += standardPlates;
    totalBoughtMm2 += boughtMm2;

    courses.push({
      width: w,
      length: l,
      actualHeight: actualH,
      platesAround: n,
      piecesPerPlate: piecesPerPlate >= 1 ? piecesPerPlate : 1,
      standardPlates,
      boughtM2: boughtMm2 / 1e6,
    });
  }

  // Weld lengths (metres)
  // Longitudinal: each course contributes (nAround-1) seams of height actualH per vessel
  const longitudinalWeldM = courses.reduce(
    (sum, c, i) => sum + (nArounds[i] - 1) * (c.actualHeight / 1000),
    0,
  ) * quantity;
  // Circumferential: one seam per course junction
  const circumferentialWeldM = numCourses > 1
    ? (Math.PI * od / 1000) * (numCourses - 1) * quantity
    : 0;
  const totalWeldLength = longitudinalWeldM + circumferentialWeldM;

  const totalWeldSeams =
    nArounds.reduce((sum, n) => sum + (n - 1), 0) * quantity
    + (numCourses > 1 ? (numCourses - 1) * quantity : 0);

  const netAreaM2 = shellAreaM2(od, shellLength) * quantity;
  const boughtM2 = totalBoughtMm2 / 1e6;
  const wastagePct = boughtM2 > 0 ? (boughtM2 - netAreaM2) / boughtM2 * 100 : 100;
  const isMixed = new Set(courseWidths.map((w, i) => `${w}x${courseLengths[i]}`)).size > 1;

  return {
    courses,
    totalPlates: totalPieces,
    totalStandardPlates,
    boughtM2,
    netAreaM2,
    wastagePct,
    numCourses,
    isMixed,
    quantity,
    totalWeldSeams,
    totalWeldLength,
  };
}

// ─── Cartesian product helper ───

function cartesian(arrays: number[][]): number[][] {
  return arrays.reduce<number[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(val => [...combo, val])),
    [[]],
  );
}

// ─── Main optimizer ───

export function optimizeShell(
  od: number,
  shellLength: number,
  plates: PlateSize[],
  topN = 5,
  quantity = 1,
): ShellOption[] {
  const allResults: ShellOption[] = [];
  const seen = new Set<string>();
  const circumference = Math.PI * od;

  for (const courseWidths of findCourseWidthCombos(shellLength, plates)) {
    const lengthOptions = courseWidths.map(w => lengthsForWidth(w, plates));
    if (lengthOptions.some(opts => opts.length === 0)) continue;

    for (const courseLengths of cartesian(lengthOptions)) {
      // Pick the nAround that minimises bought area per course independently.
      // nAround values are independent across courses (they don't interact), so
      // greedy per-course selection is optimal and avoids the 4^N cartesian explosion.
      const nAroundCombo = courseWidths.map((w, i) => {
        const opts = getAllCourseOptions(w, courseLengths[i], circumference, quantity);
        if (opts.length === 0) return 0;
        return opts.reduce((best, o) => o.boughtMm2 < best.boughtMm2 ? o : best).nAround;
      });
      if (nAroundCombo.some(n => n === 0)) continue;

      const result = evaluateShell(courseWidths, courseLengths, nAroundCombo, od, shellLength, quantity);

      const key = `${result.totalStandardPlates}|${result.totalWeldLength.toFixed(1)}|${nAroundCombo.join(',')}|${result.numCourses}`;
      if (seen.has(key)) continue;
      seen.add(key);

      allResults.push(result);
    }
  }

  // Preliminary sort by wastagePct to keep a reasonable pool for cost re-ranking
  allResults.sort((a, b) => {
    const wa = Math.round(a.wastagePct * 100);
    const wb = Math.round(b.wastagePct * 100);
    return wa - wb || a.totalStandardPlates - b.totalStandardPlates;
  });

  return allResults.slice(0, topN * 6); // wider pool for cost re-ranking
}

// ─── Public API ───

function getDerivedDiameters(inputs: VesselInputs): { od: number; id: number } {
  if (inputs.diameterType === 'OD') {
    return { od: inputs.diameter, id: inputs.diameter - 2 * inputs.plateThickness };
  }
  return { id: inputs.diameter, od: inputs.diameter + 2 * inputs.plateThickness };
}

function getAvailablePlateSizes(inputs: VesselInputs): PlateSize[] {
  return inputs.materialType === 'carbon_steel' ? CS_PLATE_SIZES : SS_PLATE_SIZES;
}

function getDensity(inputs: VesselInputs): number {
  return inputs.materialType === 'carbon_steel' ? CS_DENSITY : SS_DENSITY;
}

function getPlatePricePerKg(inputs: VesselInputs, pricing: PricingData): number {
  if (inputs.materialType === 'carbon_steel') return pricing.cs_plate_per_kg;
  return pricing.ss_plate_per_kg;
}

export function calculateAll(inputs: VesselInputs, pricing: PricingData, advanced: AdvancedSettings = DEFAULT_ADVANCED): CalculationResults {
  // FIX 3: thickness validation
  const thickness = inputs.plateThickness;
  if (!thickness || thickness <= 0) throw new Error('Plate thickness must be > 0 mm');

  const { od, id } = getDerivedDiameters(inputs);
  const plates = getAvailablePlateSizes(inputs);
  const density = getDensity(inputs);
  const pricePerKg = getPlatePricePerKg(inputs, pricing);
  const quantity = inputs.quantity ?? 1;

  const shellOptions = optimizeShell(od, inputs.shellLength, plates, 5, quantity);

  // FCAW weld cost scales linearly with plate thickness relative to 10 mm reference
  const REFERENCE_THICKNESS_MM = 10;
  const effectiveWeldCostPerMeter =
    pricing.fcaw_per_metre * (thickness / REFERENCE_THICKNESS_MM);

  // Attach weight and full cost model to each option
  const optionsWithCost = shellOptions.map(opt => {
    const totalWeight = (opt.boughtM2 * 1e6 * thickness) / 1e9 * density;
    const materialCost = totalWeight * pricePerKg;
    const weldCost = opt.totalWeldLength * effectiveWeldCostPerMeter;

    // Aggregate total segments first, then apply power law
    const totalSegmentsPerVessel = opt.courses.reduce((sum, c) => sum + c.platesAround, 0);
    // segmentation penalty scales with:
    // - weld economics (fcaw_per_metre)
    // - thickness (via scaling)
    // - shell height (longer welds → more complexity)
    // This keeps penalty proportional to real fabrication effort
    const heightFactor = inputs.shellLength / 1000; // mm → metres
    const segmentationBaseFactor =
      pricing.fcaw_per_metre * (thickness / REFERENCE_THICKNESS_MM) * heightFactor;
    const clampedWeight = Math.min(2, Math.max(0, advanced.segmentationWeight ?? 1.0));
    const segmentationPenalty =
      Math.pow(totalSegmentsPerVessel, advanced.segmentationExponent ?? 1.7) * segmentationBaseFactor * clampedWeight * quantity;

    const finalCost = materialCost + weldCost + segmentationPenalty;
    const perVesselWeight = totalWeight / quantity;
    const perVesselCost = materialCost / quantity;

    return {
      ...opt,
      totalWeight,
      cost: materialCost,
      perVesselWeight,
      perVesselCost,
      materialCost,
      weldCost,
      segmentationPenalty,
      finalCost,
    };
  });

  // Sort by finalCost ascending
  optionsWithCost.sort((a, b) => (a.finalCost ?? 0) - (b.finalCost ?? 0));

  // Trim to topN after cost-based sort
  const topOptions = optionsWithCost.slice(0, 5);

  // Assign labels
  if (topOptions.length > 0) {
    const minPlates = Math.min(...topOptions.map(o => o.totalStandardPlates));
    const minWeldLen = Math.min(...topOptions.map(o => o.totalWeldLength));
    for (const opt of topOptions) {
      if (opt.totalWeldLength === minWeldLen) {
        opt.label = 'Fabrication-efficient';
      } else if (opt.totalStandardPlates === minPlates) {
        opt.label = 'Material-efficient';
      } else {
        opt.label = 'Balanced';
      }
    }
  }

  // Grand total reflects material cost only — weld cost is kept as an internal ranking factor
  const bestCost = topOptions.length > 0 ? (topOptions[0].materialCost ?? 0) : 0;

  return {
    inputs,
    od,
    id,
    circumference: Math.PI * od,
    netShellAreaM2: shellAreaM2(od, inputs.shellLength),
    shellOptions: topOptions,
    grandTotal: bestCost,
    timestamp: Date.now(),
  };
}

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
    table = ALLOWABLE_STRESS_SS316;
  }
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, s0] = table[i];
    const [t1, s1] = table[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      return s0 + (s1 - s0) * (tempC - t0) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}

// ─── Liquid head pressure ───

export function calculateLiquidHead(liquidHeightMm: number, fluidDensityKgM3: number): number {
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

export function calculateUG32Head(
  P_MPa: number,
  D_mm: number,
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
    const L = D_mm;
    tMin = (0.885 * P_MPa * L) / (S_MPa * E - 0.1 * P_MPa);
  } else if (headType === 'hemispherical') {
    const L = D_mm / 2;
    tMin = (P_MPa * L) / (2 * S_MPa * E - 0.2 * P_MPa);
  } else {
    tMin = D_mm * Math.sqrt(0.33 * P_MPa / S_MPa);
  }
  const tFormed = tMin / (1 - 0.10);
  const tRequired = tFormed + CA_mm;
  const nominal = getNextNominalThickness(tRequired, materialType);
  return { tMinMm: tMin, tFormedMm: tFormed, nominalMm: nominal };
}

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
    totalCost: totalWeight * 2 * pricePerKg,
  };
}

// ─── Nozzle / Manhole BOM ───

export function calculateNozzleBOM(nozzles: NozzleSpec[]): NozzleBOMItem[] {
  return nozzles.map(spec => {
    if (spec.type !== 'manhole') {
      return { spec, fasteners: null };
    }
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
  const basePlateThicknessMm = 12;
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
  L: number;
  OD: number;
  t: number;
  H: number;
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

  const L_m = L / 1000;
  const H_m = H / 1000;
  const A_m = A / 1000;
  const Rm_m = (OD - t) / 2 / 1000;
  const t_m = t / 1000;

  const Q = totalVesselWeightN / 2;

  const denom = 1 + (4 * H_m) / (3 * L_m);

  const M1_num = 1 - A_m / L_m + (Rm_m * Rm_m - H_m * H_m) / (2 * A_m * L_m);
  const M1 = Q * A_m * (1 - M1_num / denom);

  const M2_term1 = (1 + 2 * (Rm_m * Rm_m - H_m * H_m) / (L_m * L_m)) / denom;
  const M2 = (Q * L_m / 4) * (M2_term1 - 4 * A_m / L_m);

  const Z_m3 = Math.PI * Rm_m * Rm_m * t_m;

  const sigma1 = Math.abs(M1) / Z_m3 / 1e6;
  const sigma2 = Math.abs(M2) / Z_m3 / 1e6;

  const saddleHeightMm = OD * 0.2;
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

export function formatCurrency(value: number): string {
  return `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
