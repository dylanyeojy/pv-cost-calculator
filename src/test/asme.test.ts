import { describe, it, expect } from 'vitest';
import {
  getASMEAllowableStress,
  calculateLiquidHead,
  calculateUG27Shell,
  calculateUG32Head,
  calculateFilterPlates,
  calculateNozzleBOM,
  calculateLegs,
  calculateZickSaddle,
  liveASMEPreview,
} from '@/lib/calculations';
import { NozzleSpec, LegInputs, SaddleInputs, DEFAULT_PRICING } from '@/lib/types';

describe('getASMEAllowableStress', () => {
  it('returns 138 MPa for SA-516 Gr.70 at 20°C', () => {
    expect(getASMEAllowableStress('SA516 Gr 70', 20)).toBe(138);
  });

  it('linearly interpolates SA-516 Gr.70 at 175°C → 134.5 MPa', () => {
    // Between 150°C (138) and 200°C (131): 138 + (175-150)/(200-150) * (131-138) = 134.5
    expect(getASMEAllowableStress('SA516 Gr 70', 175)).toBeCloseTo(134.5, 1);
  });

  it('returns 100 MPa for SA-516 Gr.70 at 400°C', () => {
    expect(getASMEAllowableStress('SA516 Gr 70', 400)).toBe(100);
  });

  it('returns 138 MPa for SS304 at 20°C', () => {
    expect(getASMEAllowableStress('SS304', 20)).toBe(138);
  });

  it('returns 127 MPa for SS304 at 100°C', () => {
    expect(getASMEAllowableStress('SS304', 100)).toBe(127);
  });

  it('returns 138 MPa for SS316 at 20°C', () => {
    expect(getASMEAllowableStress('SS316', 20)).toBe(138);
  });

  it('throws for temperature below 20°C', () => {
    expect(() => getASMEAllowableStress('SA516 Gr 70', 10)).toThrow();
  });

  it('throws for temperature above 400°C', () => {
    expect(() => getASMEAllowableStress('SA516 Gr 70', 450)).toThrow();
  });
});

describe('calculateLiquidHead', () => {
  it('returns 0.02943 MPa for 3000mm of water', () => {
    // 1000 kg/m³ × 9.81 × 3m = 29430 Pa = 0.02943 MPa
    expect(calculateLiquidHead(3000)).toBeCloseTo(0.02943, 4);
  });

  it('returns 0 for 0 height', () => {
    expect(calculateLiquidHead(0)).toBe(0);
  });
});

describe('calculateUG27Shell', () => {
  it('returns t_min ≈ 3.64mm and nominal 8mm for CS vessel at 1 MPa', () => {
    // P=1 MPa, R=500mm, S=138 MPa, E=1.0, CA=3mm
    // t = 1×500/(138×1 - 0.6×1) = 500/137.4 = 3.638mm
    // t+CA = 6.638mm → snap to 8mm (CS)
    const result = calculateUG27Shell(1.0, 500, 138, 1.0, 3, 'SA516 Gr 70');
    expect(result.tMinMm).toBeCloseTo(3.638, 2);
    expect(result.nominalMm).toBe(8.0);
    expect(result.thinWallWarning).toBe(false);
  });

  it('uses SS thickness list for SS304', () => {
    // P=1 MPa, R=500mm, S=138 MPa, E=1.0, CA=2mm
    // t_min=3.638mm, +CA=5.638mm → next SS thickness ≥ 5.638 is 6mm
    const result = calculateUG27Shell(1.0, 500, 138, 1.0, 2, 'SS304');
    expect(result.nominalMm).toBe(6);
  });

  it('sets thinWallWarning when t_min >= R/2', () => {
    // Extreme case: P=100 MPa, R=50mm, S=138 MPa, E=1.0, CA=0
    const result = calculateUG27Shell(100, 50, 138, 1.0, 0, 'SA516 Gr 70');
    expect(result.thinWallWarning).toBe(true);
  });
});

describe('calculateUG32Head', () => {
  it('ellipsoidal: t_min ≈ 3.62mm, t_formed ≈ 4.03mm, nominal 8mm (CS)', () => {
    // P=1 MPa, D=1000mm, S=138 MPa, E=1.0, CA=3mm
    // t = 1×1000/(2×138×1 - 0.2×1) = 1000/275.8 = 3.625mm
    // t_formed = 3.625/0.9 = 4.028mm
    // t_formed + CA = 7.028mm → snap to 8mm
    const result = calculateUG32Head(1.0, 1000, 'ellipsoidal', 138, 1.0, 3, 'SA516 Gr 70');
    expect(result.tMinMm).toBeCloseTo(3.625, 2);
    expect(result.tFormedMm).toBeCloseTo(4.028, 2);
    expect(result.nominalMm).toBe(8.0);
  });

  it('torispherical: uses L=D (crown radius = ID)', () => {
    // t = 0.885×1×1000/(138×1 - 0.1×1) = 885/137.9 = 6.417mm
    // t_formed = 6.417/0.9 = 7.130mm; +CA 3mm = 10.130mm → snap 12.7mm CS
    const result = calculateUG32Head(1.0, 1000, 'torispherical', 138, 1.0, 3, 'SA516 Gr 70');
    expect(result.tMinMm).toBeCloseTo(6.417, 2);
    expect(result.nominalMm).toBe(12.70);
  });

  it('hemispherical: uses L=D/2', () => {
    // t = 1×500/(2×138×1 - 0.2×1) = 500/275.8 = 1.813mm
    // t_formed = 1.813/0.9 = 2.014mm; +CA 3mm = 5.014mm → 6.4mm CS
    const result = calculateUG32Head(1.0, 1000, 'hemispherical', 138, 1.0, 3, 'SA516 Gr 70');
    expect(result.tMinMm).toBeCloseTo(1.813, 2);
    expect(result.nominalMm).toBe(6.40);
  });
});

describe('calculateFilterPlates', () => {
  it('calculates weight and cost for 2 CS filter plates, ID=1000mm, t=22.3mm', () => {
    // Area = π × (0.5)² = 0.7854 m²
    // Weight per plate = 0.7854 × (22.3/1000) × 7850 = 137.4 kg
    const result = calculateFilterPlates(2, 1000, 'SA516 Gr 70', 4.50, 22.3);
    expect(result.count).toBe(2);
    expect(result.diameterMm).toBe(1000);
    expect(result.thicknessMm).toBe(22.3);
    expect(result.weightPerPlateKg).toBeCloseTo(137.4, 0);
    expect(result.totalWeightKg).toBeCloseTo(274.8, 0);
    expect(result.totalCost).toBeCloseTo(274.8 * 2 * 4.50, -1);
  });

  it('uses provided plateThickness for stainless steel', () => {
    const result = calculateFilterPlates(1, 800, 'SS304', 12.00, 22);
    expect(result.thicknessMm).toBe(22);
  });

  it('returns zero-cost result for count=0', () => {
    const result = calculateFilterPlates(0, 1000, 'SA516 Gr 70', 4.50, 22.3);
    expect(result.totalWeightKg).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe('calculateNozzleBOM', () => {
  it('returns bolt data for a B16.5 24" nozzle when fastener data exists', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', size: '24',
      flangeType: 'slip_on_rf', quantity: 1, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom).toHaveLength(1);
    expect(bom[0].boltCount).toBe(20);
    expect(bom[0].nutCount).toBe(20);
    expect(bom[0].washerCount).toBe(40);
    expect(bom[0].boltDiameterMm).toBeCloseTo(31.75, 1);
    expect(bom[0].blindFlangeQty).toBe(0);
  });

  it('sets blindFlangeQty for manhole type', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'manhole', size: '24',
      flangeType: 'slip_on_rf', quantity: 2, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom[0].blindFlangeQty).toBe(2);
  });

  it('multiplies bolt count by quantity', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', size: '24',
      flangeType: 'weld_neck', quantity: 3, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom[0].boltCount).toBe(60); // 20 × 3
    expect(bom[0].washerCount).toBe(120); // 40 × 3
  });

  it('returns null bolt fields for a size with no fastener data', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', size: '4',
      flangeType: 'weld_neck', quantity: 1, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom[0].boltCount).toBeNull();
    expect(bom[0].boltLength).toBeNull();
  });

  it('calculates neck weight for a 4" nozzle', () => {
    // SA106_PIPE_SCHEDULE[4]: od_mm=114.3, wall_mm=6.02
    // weight = π × (114.3 - 6.02) × 6.02 × 1e-6 × 7850 × (150/1000) × 1
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', size: '4',
      flangeType: 'weld_neck', quantity: 1, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom[0].neckWeightKg).not.toBeNull();
    expect(bom[0].neckWeightKg!).toBeGreaterThan(0);
    expect(bom[0].neckCostRM).toBeCloseTo(bom[0].neckWeightKg! * DEFAULT_PRICING.sa106_per_kg, 4);
  });

  it('returns null neck fields when size not in SA106 schedule', () => {
    const nozzles: NozzleSpec[] = [{
      type: 'nozzle', size: '99',
      flangeType: 'weld_neck', quantity: 1, neckLength: 150,
    }];
    const bom = calculateNozzleBOM(nozzles, 'B16.5', DEFAULT_PRICING);
    expect(bom[0].neckWeightKg).toBeNull();
    expect(bom[0].neckCostRM).toBeNull();
  });
});

describe('calculateLegs', () => {
  it('calculates 4 CS legs using 6" NPS pipe schedule (OD=168.3mm, wall=7.11mm, L=600mm)', () => {
    // Using SA106_PIPE_SCHEDULE[6]: od_mm=168.3, wall_mm=7.11
    // weight per leg = π × (168.3 - 7.11) × 7.11 × (1/1e6) × 7850 × (600/1000)
    //               = π × 161.19 × 7.11 × 1e-6 × 7850 × 0.6 ≈ 16.9 kg
    const legInputs: LegInputs = { diameter: 6, length: 600, quantity: 4 };
    const result = calculateLegs(legInputs, 'SA516 Gr 70', 4.50);
    expect(result).not.toBeNull();
    expect(result!.weightPerLegKg).toBeCloseTo(16.9, 0);
    expect(result!.basePlateSizeMm).toBeCloseTo(168.3 * 1.1, 1);
    expect(result!.basePlateWeightKg).toBeCloseTo(3.23, 0);
    expect(result!.totalWeightKg).toBeCloseTo((result!.weightPerLegKg + result!.basePlateWeightKg) * 4, 0);
  });

  it('returns null for an unknown pipe diameter', () => {
    const legInputs: LegInputs = { diameter: 99, length: 600, quantity: 4 };
    expect(calculateLegs(legInputs, 'SA516 Gr 70', 4.50)).toBeNull();
  });
});

describe('calculateZickSaddle', () => {
  it('computes M1, M2 for a simple test case and passes stress checks', () => {
    // Vessel: L=10000mm, OD=1219mm, t=8mm, H(head depth)=250mm
    // Derived: b = 0.5 × 1219 = 609.5mm, A = 0.2 × 10000 = 2000mm
    const saddleInputs: SaddleInputs = { quantity: 2 };
    const result = calculateZickSaddle(
      { L: 10000, OD: 1219, t: 8, H: 250 },
      saddleInputs,
      50000,
      138,
      'SA516 Gr 70',
      4.50,
    );
    expect(result.QN).toBe(25000);
    expect(result.M1Nm).toBeGreaterThan(0);
    expect(result.M2Nm).toBeGreaterThan(0);
    expect(result.sigma1MPa).toBeLessThan(138);
    expect(result.sigma2MPa).toBeLessThan(138);
    expect(result.sigma1Pass).toBe(true);
    expect(result.sigma2Pass).toBe(true);
    expect(result.saddleWeightKg).toBeGreaterThan(0);
    expect(result.totalSaddleCost).toBeGreaterThan(0);
    expect(result.derivedAngle).toBe(120);
    expect(result.derivedWidth).toBeCloseTo(609.5, 1);
    expect(result.derivedDistanceA).toBeCloseTo(2000, 1);
  });
});

describe('liveASMEPreview', () => {
  const CS_THICKNESSES = [6.40, 8.00, 9.60, 12.70, 15.90, 19.10, 22.30, 25.40];

  it('returns correct results for SA516 Gr 70, 1000 kPa, 150°C, E=0.85, CA=3mm, ID=1000mm, ellipsoidal', () => {
    const result = liveASMEPreview({
      materialType: 'SA516 Gr 70',
      designPressureKPa: 1000,
      liquidHeadKPa: 0,
      designTempC: 150,
      jointEfficiency: 0.85,
      corrosionAllowanceMm: 3,
      diameterMm: 1000,
      diameterType: 'ID',
      headType: 'ellipsoidal',
    });

    expect(result.allowableStressMPa).not.toBeNull();
    expect(result.allowableStressMPa!).toBeCloseTo(138, 0);

    expect(result.shellTminMm).not.toBeNull();
    expect(result.shellTminMm!).toBeGreaterThan(0);

    expect(result.recommendedShellNominalMm).not.toBeNull();
    expect(CS_THICKNESSES).toContain(result.recommendedShellNominalMm!);

    expect(result.headTminMm).not.toBeNull();
    expect(result.headTminMm!).toBeGreaterThan(0);

    expect(result.recommendedHeadNominalMm).not.toBeNull();
  });

  it('returns all nulls when designPressureKPa is 0', () => {
    const result = liveASMEPreview({
      materialType: 'SA516 Gr 70',
      designPressureKPa: 0,
      liquidHeadKPa: 0,
      designTempC: 150,
      jointEfficiency: 0.85,
      corrosionAllowanceMm: 3,
      diameterMm: 1000,
      diameterType: 'ID',
      headType: 'ellipsoidal',
    });
    expect(result.allowableStressMPa).toBeNull();
    expect(result.shellTminMm).toBeNull();
    expect(result.headTminMm).toBeNull();
    expect(result.recommendedShellNominalMm).toBeNull();
    expect(result.recommendedHeadNominalMm).toBeNull();
  });

  it('returns all nulls when diameterMm is 0', () => {
    const result = liveASMEPreview({
      materialType: 'SA516 Gr 70',
      designPressureKPa: 1000,
      liquidHeadKPa: 0,
      designTempC: 150,
      jointEfficiency: 0.85,
      corrosionAllowanceMm: 3,
      diameterMm: 0,
      diameterType: 'ID',
      headType: 'ellipsoidal',
    });
    expect(result.allowableStressMPa).toBeNull();
    expect(result.shellTminMm).toBeNull();
    expect(result.headTminMm).toBeNull();
    expect(result.recommendedShellNominalMm).toBeNull();
    expect(result.recommendedHeadNominalMm).toBeNull();
  });

  it('returns all nulls when designTempC is out of range', () => {
    const result = liveASMEPreview({
      materialType: 'SA516 Gr 70',
      designPressureKPa: 1000,
      liquidHeadKPa: 0,
      designTempC: 500,
      jointEfficiency: 0.85,
      corrosionAllowanceMm: 3,
      diameterMm: 1000,
      diameterType: 'ID',
      headType: 'ellipsoidal',
    });
    expect(result.allowableStressMPa).toBeNull();
    expect(result.shellTminMm).toBeNull();
  });
});
