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
} from '@/lib/calculations';
import { NozzleSpec, LegInputs, SaddleInputs } from '@/lib/types';

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
    expect(result.totalCost).toBeCloseTo(274.8 * 2 * 4.50, -1);
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

describe('calculateLegs', () => {
  it('calculates 4 CS legs: OD=168.3mm, t=7.11mm, L=600mm', () => {
    // Pipe cross-section: π/4 × (OD² - ID²) where ID = 168.3 - 2×7.11 = 154.08mm
    // area = π/4 × ((0.1683)² - (0.15408)²) = π/4 × (0.028305 - 0.023741) = π/4 × 0.004564 = 0.003591 m²
    // volume per leg = 0.003591 × 0.6 = 0.002155 m³
    // weight per leg = 0.002155 × 7850 = 16.91 kg
    const legInputs: LegInputs = { pipeOD: 168.3, pipeThickness: 7.11, legLength: 600 };
    const result = calculateLegs(legInputs, 'carbon_steel', 4.50);
    expect(result.weightPerLegKg).toBeCloseTo(16.9, 0);
    expect(result.basePlateSizeMm).toBeCloseTo(168.3 * 1.1, 1);  // 185.1mm
    // base plate: 185.1mm × 185.1mm × 12mm (default), density 7850
    // weight = (0.1851)² × 0.012 × 7850 ≈ 3.23 kg
    expect(result.basePlateWeightKg).toBeCloseTo(3.23, 0);
    expect(result.totalWeightKg).toBeCloseTo((result.weightPerLegKg + result.basePlateWeightKg) * 4, 0);
  });
});

describe('calculateZickSaddle', () => {
  it('computes M1, M2 for a simple test case and passes stress checks', () => {
    // Vessel: L=10000mm, OD=1219mm, t=8mm, H(head depth)=250mm
    // W=50000N, A=1000mm, saddle width b=300mm
    const saddleInputs: SaddleInputs = { angle: 120, width: 300, distanceA: 1000 };
    const result = calculateZickSaddle(
      { L: 10000, OD: 1219, t: 8, H: 250 },
      saddleInputs,
      50000,
      138,
      'carbon_steel',
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
  });
});
