export type MaterialType = 'carbon_steel' | 'stainless_steel';
export type SSGrade = 'SS304' | 'SS316' | 'SS316L';
export type HeadType = 'ellipsoidal' | 'torispherical' | 'hemispherical' | 'flat';
export type StraightFace = 25 | 38 | 50;
export type DiameterType = 'ID' | 'OD';

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
  ssGrade: SSGrade;
  rubberLining: boolean;
  quantity: number; // number of identical vessels (default 1)
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
}

export const DEFAULT_PRICING: PricingData = {
  cs_plate_per_kg: 4.50,
  ss_plate_per_kg: 12.00,
  fcaw_per_metre: 35.00,
  jotun_barrier80_per_litre: 45.00,
  jotun_penguard_per_litre: 38.00,
  jotun_hardtop_per_litre: 42.00,
  rubber_lining_per_m2: 800.00,
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
  materialType: MaterialType;
  ssGrade: SSGrade;
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
}

export interface HistoryEntry {
  id: string;
  projectName: string;
  tagNumber: string;
  materialType: MaterialType;
  ssGrade?: SSGrade;
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
