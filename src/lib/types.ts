export type MaterialType = 'SA516 Gr 70' | 'SS304' | 'SS316';
export type HeadType = 'ellipsoidal' | 'torispherical' | 'hemispherical' | 'flat';
export type StraightFace = 25 | 38 | 50;
export type DiameterType = 'ID' | 'OD';
export type VesselOrientation = 'vertical' | 'horizontal';
export type FlangeStandard = 'B16.5' | 'PN10' | 'PN16';
export type FlangeType = 'slip_on_rf' | 'weld_neck';
export type NozzleItemType = 'nozzle' | 'manhole';

export interface NozzleSpec {
  type: NozzleItemType;
  size: string;
  flangeType: FlangeType;
  quantity: number;
  neckLength: number;
}

export interface LegInputs {
  diameter: number;
  length: number;
  quantity: number;
}

export interface SaddleInputs {
  quantity: number;
}

export interface VesselInputs {
  projectName: string;
  tagNumber: string;
  designPressure: number;
  designTemperature: number;
  diameterType: DiameterType;
  diameter: number;
  shellLength: number;
  plateThickness: number;
  materialType: MaterialType;
  rubberLining: boolean;
  quantity: number; // number of identical vessels (default 1)
  orientation: VesselOrientation;
  jointEfficiency: number;
  corrosionAllowance: number;
  totalDesignPressureOverride: number;
  filterPlateCount: number;
  globalNozzleStandard: FlangeStandard;
  filterPlateThickness: number;
  nozzles: NozzleSpec[];
  legInputs: LegInputs;
  saddleInputs: SaddleInputs;
}

export interface PlateSize {
  width: number;
  length: number;
  label: string;
}

// ─── Shell optimizer types ───

export interface CourseDetail {
  width: number;
  length: number;
  actualHeight: number;
  platesAround: number;   // = nAround (pieces per ring per vessel)
  piecesPerPlate: number; // ring-pieces cut from one standard plate
  standardPlates: number; // standard plates purchased for this course (all vessels)
  boughtM2: number;       // total bought area for this course across all vessels (m²)
  pieceType: 'shell_course' | 'neck_blank';
}

export interface NeckBlankPiece {
  width_mm: number;
  height_mm: number;
  quantity: number;
  label: string;
  pieceType: 'neck_blank';
}

export interface ShellOption {
  courses: CourseDetail[];
  totalPlates: number;        // total ring-pieces entering all vessels (Σ nAround × qty across courses)
  totalStandardPlates: number; // total standard plates purchased (Σ standardPlates across courses)
  boughtM2: number;           // total bought area across ALL vessels (m²)
  netAreaM2: number;
  wastagePct: number;
  numCourses: number;
  isMixed: boolean;
  quantity: number;
  totalWeldSeams: number;     // Σ (nAround-1)×qty per course + circumferential seams
  totalWeldLength: number;    // total weld length in metres across all vessels
  totalWeight?: number;       // total weight for all vessels
  cost?: number;              // material cost only (RM)
  perVesselWeight?: number;
  perVesselCost?: number;
  materialCost?: number;      // plate material cost (RM)
  weldCost?: number;          // weld cost (RM), thickness-scaled
  segmentationPenalty?: number; // complexity penalty (RM)
  finalCost?: number;         // materialCost + weldCost + segmentationPenalty
  label?: string;             // 'Fabrication-efficient' | 'Balanced' | 'Material-efficient'
}


// ─── Pricing — unit prices (saved to config/pricing) ───

export interface PricingData {
  cs_plate_per_kg: number;
  ss_plate_per_kg: number;
  fcaw_per_metre: number;
  jotun_barrier80_per_litre: number;
  jotun_penguard_per_litre: number;
  jotun_hardtop_per_litre: number;
  rubber_lining_per_m2: number;
  sa106_per_kg: number;
}

export const DEFAULT_PRICING: PricingData = {
  cs_plate_per_kg: 4.50,
  ss_plate_per_kg: 12.00,
  fcaw_per_metre: 35.00,
  jotun_barrier80_per_litre: 45.00,
  jotun_penguard_per_litre: 38.00,
  jotun_hardtop_per_litre: 42.00,
  rubber_lining_per_m2: 800.00,
  sa106_per_kg: 8.00,
};

// ─── Advanced settings — model tuning (saved to config/advanced) ───

export interface AdvancedSettings {
  segmentationWeight: number; // unitless multiplier relative to weld cost (0 = disabled, max 2)
  segmentationExponent: number; // power-law exponent for segment count (default 1.7)
}

export const DEFAULT_ADVANCED: AdvancedSettings = {
  segmentationWeight: 1.0,
  segmentationExponent: 1.7,
};

// ─── Dish End types ───

export interface DishEndInputs {
  headType: HeadType;
  plateThickness: number;
  straightFace: StraightFace;
  quantity: number;
  cornerRadius: number; // only for flat head
}

export interface DishEndGeometry {
  CR: number | null;
  KR: number | null;
  H_no_sf: number;
  H_sf: number;
  BD: number;
}

export interface NestingPlateSpec {
  count: number;
  width: number;
  length: number;
}

export interface NestingOption {
  layout: 'side-by-side' | 'staggered';
  canvasW: number;
  canvasH: number;
  blanksPerCanvas: number;
  numCanvases: number;
  plateSpecs: NestingPlateSpec[];
  totalPlates: number;
  boughtAreaM2: number;
  netAreaM2: number;
  wastagePct: number;
  numWeld: number;
  totalWeight?: number;
  cost?: number;
  label?: string;
}

export interface DishEndResults {
  inputs: DishEndInputs;
  id: number;
  od: number;
  geometry: DishEndGeometry;
  unitWeightKg: number;
  totalWeightKg: number;      // total weight for all dish end blanks (inputs.quantity total)
  nestingOptions: NestingOption[];
}

export interface ASMEThicknessResult {
  totalDesignPressureMPa: number;
  liquidHeadMPa: number;
  allowableStressMPa: number;
  shellTminMm: number;
  shellNominalMm: number;
  shellThinWallWarning: boolean;
  headTminMm: number;
  headTformedMm: number;
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
  boltSpec: string;
  nutCount: number;
  washerCount: number;
}

export interface NozzleBOMItem {
  spec: NozzleSpec;
  fasteners: ManholeFastenerSet | null;
  boltLength: number | null;
  neckWeightKg: number | null;
  neckCostRM: number | null;
  boltCount: number | null;
  nutCount: number | null;
  washerCount: number | null;
  boltDiameterMm: number | null;
  blindFlangeQty: number;
}

export interface LegSupportResult {
  od_mm: number;
  wall_mm: number;
  quantity: number;
  basePlateSizeMm: number;
  weightPerLegKg: number;
  basePlateWeightKg: number;
  totalWeightKg: number;
  totalCost: number;
}

export interface ZickResult {
  QN: number;
  M1Nm: number;
  M2Nm: number;
  sigma1MPa: number;
  sigma2MPa: number;
  allowableMPa: number;
  sigma1Pass: boolean;
  sigma2Pass: boolean;
  saddleWeightKg: number;
  totalSaddleCost: number;
  derivedAngle: number;
  derivedWidth: number;
  derivedDistanceA: number;
}

export type SupportResult =
  | { type: 'legs'; legs: LegSupportResult }
  | { type: 'saddles'; saddles: ZickResult };

export interface CalculationResults {
  inputs: VesselInputs;
  od: number;
  id: number;
  circumference: number;
  netShellAreaM2: number;
  shellOptions: ShellOption[];
  grandTotal: number;
  timestamp: number;
  dishEnd?: DishEndResults;
  asmeThickness?: ASMEThicknessResult;
  filterPlates?: FilterPlateResult;
  nozzleBOM?: NozzleBOMItem[];
  support?: SupportResult;
}

export interface HistoryEntry {
  id: string;
  projectName: string;
  tagNumber: string;
  materialType: MaterialType;
  od: number;
  shellLength: number;
  grandTotal: number;
  timestamp: number;
  results: CalculationResults;
}

export const CS_THICKNESSES = [6.40, 8.00, 9.60, 12.70, 15.90, 19.10, 22.30, 25.40];
export const SS_THICKNESSES = [5, 6, 8, 10, 12, 16, 22, 25];

export const CS_PLATE_SIZES: PlateSize[] = [
  { width: 1829, length: 6096, label: '1829 × 6096' },
  { width: 1829, length: 9144, label: '1829 × 9144' },
  { width: 2438, length: 6096, label: '2438 × 6096' },
  { width: 2438, length: 7315, label: '2438 × 7315' },
  { width: 2438, length: 9144, label: '2438 × 9144' },
];

export const SS_PLATE_SIZES: PlateSize[] = [
  { width: 1219, length: 2438, label: '1219 × 2438' },
  { width: 1524, length: 3048, label: '1524 × 3048' },
  { width: 1524, length: 6096, label: '1524 × 6096' },
];

export const CS_DENSITY = 7850; // kg/m³
export const SS_DENSITY = 8000;

// ─── ASME Section II Part D — Allowable stress tables [tempC, MPa] ───
export const ALLOWABLE_STRESS_SA516_GR70: [number, number][] = [
  [20,138],[50,138],[100,138],[150,138],[200,131],[250,125],[300,118],[350,110],[400,100],
];
export const ALLOWABLE_STRESS_SS304: [number, number][] = [
  [20,138],[50,138],[100,127],[150,120],[200,114],[250,110],[300,106],[350,103],[400,99],
];
export const ALLOWABLE_STRESS_SS316: [number, number][] = [
  [20,138],[50,138],[100,127],[150,122],[200,117],[250,113],[300,110],[350,106],[400,103],
];

export const ASME_ALLOWABLE_STRESS: Record<MaterialType, [number, number][]> = {
  'SA516 Gr 70': ALLOWABLE_STRESS_SA516_GR70,
  'SS304': ALLOWABLE_STRESS_SS304,
  'SS316': ALLOWABLE_STRESS_SS316,
};

// ─── Manhole fastener lookup ───
export const MANHOLE_FASTENERS: Record<string, ManholeFastenerSet> = {
  'B16.5_24': { boltCount: 20, boltSpec: '1¼" × 170 mm (ASTM A193 B7)', nutCount: 20, washerCount: 40 },
  'PN10_DN600': { boltCount: 20, boltSpec: 'M27 × 95 mm (Grade 8.8)', nutCount: 20, washerCount: 40 },
  'PN16_DN600': { boltCount: 20, boltSpec: 'M33 × 115 mm (Grade 8.8)', nutCount: 20, washerCount: 40 },
};

// ─── SA-106 Pipe Schedule (ASME B36.10M Schedule 40 standard weight) ───
export const SA106_PIPE_SCHEDULE: Record<number, { od_mm: number; wall_mm: number; weight_per_m: number }> = {
  2:  { od_mm: 60.3,  wall_mm: 3.91, weight_per_m: 5.44 },
  3:  { od_mm: 88.9,  wall_mm: 5.49, weight_per_m: 11.29 },
  4:  { od_mm: 114.3, wall_mm: 6.02, weight_per_m: 16.07 },
  6:  { od_mm: 168.3, wall_mm: 7.11, weight_per_m: 28.26 },
  8:  { od_mm: 219.1, wall_mm: 8.18, weight_per_m: 42.55 },
  10: { od_mm: 273.1, wall_mm: 9.27, weight_per_m: 60.31 },
  12: { od_mm: 323.9, wall_mm: 9.53, weight_per_m: 73.84 },
  14: { od_mm: 355.6, wall_mm: 9.53, weight_per_m: 81.33 },
  16: { od_mm: 406.4, wall_mm: 9.53, weight_per_m: 93.27 },
  18: { od_mm: 457.2, wall_mm: 9.53, weight_per_m: 105.16 },
  20: { od_mm: 508.0, wall_mm: 9.53, weight_per_m: 117.15 },
  24: { od_mm: 609.6, wall_mm: 9.53, weight_per_m: 140.80 },
};

// ─── Flange fastener data ───
export interface FlangeFastenerSpec {
  boltCount: number;
  boltDiameterMm: number;
  nutHeightMm: number;
  washerThicknessMm: number;
  flangeThicknessMm: number;
}

export const FLANGE_FASTENER_DATA: Record<string, FlangeFastenerSpec> = {
  'B16.5_24': {
    boltCount: 20,
    boltDiameterMm: 31.75,   // 1-1/4"
    nutHeightMm: 27.78,      // 0.875 × 31.75
    washerThicknessMm: 4,
    flangeThicknessMm: 63.5,
  },
  'PN10_DN600': {
    boltCount: 20,
    boltDiameterMm: 24,
    nutHeightMm: 21,         // 0.875 × 24
    washerThicknessMm: 4,
    flangeThicknessMm: 32,
  },
  'PN16_DN600': {
    boltCount: 20,
    boltDiameterMm: 27,
    nutHeightMm: 23.63,      // 0.875 × 27
    washerThicknessMm: 4,
    flangeThicknessMm: 40,
  },
};
