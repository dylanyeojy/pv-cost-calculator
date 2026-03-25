import {
  HeadType, StraightFace, DishEndInputs, DishEndGeometry, DishEndResults,
  NestingOption, NestingPlateSpec, PlateSize, PricingData,
  CS_PLATE_SIZES, SS_PLATE_SIZES, CS_DENSITY, SS_DENSITY,
} from './types';

// ─── Straight Face suggestion ───

export function suggestedSF(id: number): StraightFace {
  if (id <= 400) return 25;
  if (id < 1000) return 38;
  return 50;
}

// ─── Head geometry formulas (ASME BPVC Sec VIII Div 1) ───

export function calcEllipsoidal(ID: number, t: number, SF: number): DishEndGeometry {
  const CR = 0.9 * ID;
  const KR = 0.17 * ID;
  const H_no_sf = ID / 4;
  const H_sf = H_no_sf + SF;
  const BD = 1.17 * ID + 2 * SF;
  return { CR, KR, H_no_sf, H_sf, BD };
}

export function calcTorispherical(ID: number, t: number, SF: number): DishEndGeometry {
  const CR = ID;
  const KR = 0.1 * ID;
  const phi = Math.asin((ID / 2 - KR) / (CR - KR));
  const H_no_sf = KR * (1 - Math.sin(phi)) + CR * (1 - Math.cos(phi));
  const H_sf = H_no_sf + SF;
  const BD = (Math.PI - 0.8) * ID + 2 * SF;
  return { CR, KR, H_no_sf, H_sf, BD };
}

export function calcHemispherical(ID: number, t: number, SF: number): DishEndGeometry {
  const CR = ID / 2;
  const H_no_sf = ID / 2;
  const H_sf = H_no_sf + SF;
  const BD = (Math.PI / 2) * ID + 2 * SF;
  return { CR, KR: null, H_no_sf, H_sf, BD };
}

export function calcFlat(ID: number, cornerR: number, t: number, SF: number): DishEndGeometry {
  const BD = ID + 2 * cornerR + 2 * SF;
  const H_no_sf = t;
  const H_sf = t + SF;
  return { CR: null, KR: cornerR, H_no_sf, H_sf, BD };
}

export function calcDishGeometry(headType: HeadType, ID: number, t: number, SF: number, cornerR = 0): DishEndGeometry {
  switch (headType) {
    case 'ellipsoidal': return calcEllipsoidal(ID, t, SF);
    case 'torispherical': return calcTorispherical(ID, t, SF);
    case 'hemispherical': return calcHemispherical(ID, t, SF);
    case 'flat': return calcFlat(ID, cornerR, t, SF);
  }
}

export function dishWeightKg(BD: number, t: number, density: number): number {
  const areaMm2 = Math.PI * (BD / 2) ** 2;
  return areaMm2 * t * density / 1e9;
}

// ─── Nesting optimizer ───

function allPlateSizes(plates: PlateSize[]): PlateSize[] {
  return [...plates].sort((a, b) => b.width * b.length - a.width * a.length);
}

function multisets(items: number[], r: number): number[][] {
  const sorted = [...new Set(items)].sort((a, b) => a - b);
  if (r === 1) return sorted.map(x => [x]);
  const result: number[][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (const rest of multisets(sorted.slice(i), r - 1)) {
      result.push([sorted[i], ...rest]);
    }
  }
  return result;
}

interface Canvas {
  canvasW: number;
  canvasH: number;
  plateSpecs: NestingPlateSpec[];
  nPlates: number;
  canvasArea: number;
}

function buildCanvases(plates: PlateSize[], BD: number): Canvas[] {
  const canvases: Canvas[] = [];
  const byLength = new Map<number, number[]>();

  for (const p of allPlateSizes(plates)) {
    const widths = byLength.get(p.length) || [];
    if (!widths.includes(p.width)) widths.push(p.width);
    byLength.set(p.length, widths);
  }

  // How many plates wide do we need to cover the blank diameter?
  const maxPlateWidth = Math.max(...plates.map(p => p.width));
  const maxWeld = Math.max(3, Math.ceil(BD / maxPlateWidth));

  const seen = new Set<string>();

  for (const [length, widths] of byLength) {
    // Stack rows of plates vertically if a single plate length is shorter than BD
    const rowsNeeded = length < BD ? Math.ceil(BD / length) : 1;
    const effectiveH = length * rowsNeeded;

    for (let n = 1; n <= maxWeld; n++) {
      for (const combo of multisets(widths, n)) {
        const canvasW = combo.reduce((s, w) => s + w, 0);
        if (canvasW < BD) continue;

        const key = `${canvasW}x${effectiveH}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const counts = new Map<number, number>();
        for (const w of combo) counts.set(w, (counts.get(w) || 0) + 1);

        const plateSpecs: NestingPlateSpec[] = [];
        for (const [w, cnt] of counts) {
          plateSpecs.push({ count: cnt * rowsNeeded, width: w, length });
        }

        canvases.push({ canvasW, canvasH: effectiveH, plateSpecs, nPlates: n * rowsNeeded, canvasArea: canvasW * effectiveH });
      }
    }
  }
  return canvases;
}

function blanksSideBySide(cw: number, ch: number, BD: number): number {
  return Math.max(Math.floor(cw / BD) * Math.floor(ch / BD), 0);
}

function blanksStaggered(cw: number, ch: number, BD: number): number {
  if (BD <= 0) return 0;
  const rowH = BD * Math.sqrt(3) / 2;
  if (rowH <= 0) return 0;
  const colsE = Math.floor(cw / BD);
  const offset = BD / 2;
  const colsO = cw >= offset + BD ? Math.floor((cw - offset) / BD) : 0;
  let total = 0;
  let rowIdx = 0;
  let y = BD / 2;
  while (y + BD / 2 <= ch) {
    total += rowIdx % 2 === 0 ? colsE : colsO;
    y += rowH;
    rowIdx++;
  }
  return Math.max(total, 0);
}

export function optimizeNesting(BD: number, qty: number, plates: PlateSize[], topN = 5): NestingOption[] {
  const canvases = buildCanvases(plates, BD);
  if (canvases.length === 0) return [];

  const blankAreaM2 = Math.PI * (BD / 2) ** 2 / 1e6;
  const netAreaM2 = blankAreaM2 * qty;
  const allResults: NestingOption[] = [];
  const seen = new Set<string>();

  for (const canvas of canvases) {
    const { canvasW, canvasH, canvasArea, nPlates, plateSpecs } = canvas;
    const cAreaM2 = canvasArea / 1e6;

    for (const layout of ['side-by-side', 'staggered'] as const) {
      const bpc = layout === 'side-by-side'
        ? blanksSideBySide(canvasW, canvasH, BD)
        : blanksStaggered(canvasW, canvasH, BD);
      if (bpc <= 0) continue;

      const nCanvas = Math.ceil(qty / bpc);
      const totalPlatesList: NestingPlateSpec[] = plateSpecs.map(s => ({
        count: s.count * nCanvas,
        width: s.width,
        length: s.length,
      }));
      const totalPlateCnt = totalPlatesList.reduce((s, p) => s + p.count, 0);
      const boughtArea = cAreaM2 * nCanvas;
      const wastagePct = boughtArea > 0 ? (boughtArea - netAreaM2) / boughtArea * 100 : 100;

      const sig = JSON.stringify(totalPlatesList.sort((a, b) => a.width - b.width)) + layout;
      if (seen.has(sig)) continue;
      seen.add(sig);

      allResults.push({
        layout,
        canvasW,
        canvasH,
        blanksPerCanvas: bpc,
        numCanvases: nCanvas,
        plateSpecs: totalPlatesList,
        totalPlates: totalPlateCnt,
        boughtAreaM2: boughtArea,
        netAreaM2,
        wastagePct,
        numWeld: nPlates,
      });
    }
  }

  allResults.sort((a, b) => {
    const wa = Math.round(a.wastagePct * 100);
    const wb = Math.round(b.wastagePct * 100);
    return wa - wb || a.totalPlates - b.totalPlates;
  });

  const top = allResults.slice(0, topN);

  if (top.length > 0) {
    const minWeld = Math.min(...top.map(o => o.numWeld));
    const minWaste = Math.min(...top.map(o => o.wastagePct));
    for (const opt of top) {
      if (opt.numWeld === 1) {
        opt.label = 'No Weld';
      } else if (opt.numWeld === minWeld) {
        opt.label = 'Fabrication-efficient';
      } else if (Math.round(opt.wastagePct * 100) === Math.round(minWaste * 100)) {
        opt.label = 'Material-efficient';
      } else {
        opt.label = 'Balanced';
      }
    }
  }

  return top;
}

// ─── Public API ───

export function calculateDishEnd(
  dishInputs: DishEndInputs,
  vesselID: number,
  vesselOD: number,
  pricing: PricingData,
): DishEndResults {
  const density = dishInputs.materialType === 'carbon_steel' ? CS_DENSITY : SS_DENSITY;
  const plates = dishInputs.materialType === 'carbon_steel' ? CS_PLATE_SIZES : SS_PLATE_SIZES;

  const geometry = calcDishGeometry(
    dishInputs.headType,
    vesselID,
    dishInputs.plateThickness,
    dishInputs.straightFace,
    dishInputs.cornerRadius,
  );

  const unitWt = dishWeightKg(geometry.BD, dishInputs.plateThickness, density);
  // dishInputs.quantity is the total blanks across all vessels — no multiplication
  const totalQty = dishInputs.quantity;
  const totalWt = unitWt * totalQty;

  const nestingOptions = optimizeNesting(geometry.BD, totalQty, plates);

  // Attach weight and cost
  const pricePerKg = getPlatePricePerKg(dishInputs, pricing);
  const optionsWithCost = nestingOptions.map(opt => {
    const totalWeight = opt.boughtAreaM2 * dishInputs.plateThickness / 1000 * density;
    const cost = totalWeight * pricePerKg;
    return { ...opt, totalWeight, cost };
  });

  return {
    inputs: dishInputs,
    id: vesselID,
    od: vesselOD,
    geometry,
    unitWeightKg: unitWt,
    totalWeightKg: totalWt,
    nestingOptions: optionsWithCost,
  };
}

function getPlatePricePerKg(inputs: DishEndInputs, pricing: PricingData): number {
  if (inputs.materialType === 'carbon_steel') return pricing.cs_plate_per_kg;
  return pricing.ss_plate_per_kg;
}

export const HEAD_TYPE_LABELS: Record<HeadType, string> = {
  ellipsoidal: '2:1 Ellipsoidal',
  torispherical: 'Torispherical',
  hemispherical: 'Hemispherical',
  flat: 'Flat Head',
};
