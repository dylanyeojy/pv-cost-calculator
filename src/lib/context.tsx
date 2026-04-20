import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VesselInputs, CalculationResults, PricingData, DEFAULT_PRICING, AdvancedSettings, DEFAULT_ADVANCED, HistoryEntry, MaterialType, DishEndInputs, HeadType, VesselOrientation, NozzleSpec, LegInputs, SaddleInputs, VesselEntry, VesselCalculationResult, ProjectResults } from './types';
import { calculateAll, getASMEAllowableStress, calculateLiquidHead, calculateUG27Shell, calculateUG32Head, calculateFilterPlates, calculateNozzleBOM, calculateLegs, calculateZickSaddle, calculateManholeNeckBlanks } from './calculations';
import { calculateDishEnd, suggestedSF } from './dishEndCalculations';
import { fetchHistory, saveEstimate, deleteEstimate, fetchPricing, savePricing, fetchAdvanced, saveAdvanced } from './firestore';
import { toast } from 'sonner';

interface AppContextValue {
  inputs: VesselInputs;
  setInputs: React.Dispatch<React.SetStateAction<VesselInputs>>;
  dishEndInputs: DishEndInputs;
  setDishEndInputs: React.Dispatch<React.SetStateAction<DishEndInputs>>;
  dishEndEnabled: boolean;
  results: CalculationResults | null;
  setResults: React.Dispatch<React.SetStateAction<CalculationResults | null>>;
  projectResults: ProjectResults | null;
  setProjectResults: React.Dispatch<React.SetStateAction<ProjectResults | null>>;
  pricing: PricingData;
  setPricing: React.Dispatch<React.SetStateAction<PricingData>>;
  advancedSettings: AdvancedSettings;
  setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
  usingFallbackPricing: boolean;
  setUsingFallbackPricing: React.Dispatch<React.SetStateAction<boolean>>;
  history: HistoryEntry[];
  historyLoading: boolean;
  runCalculation: () => Promise<CalculationResults>;
  runProjectCalculation: (vessels: VesselEntry[], dishEndMap: Record<string, DishEndInputs>) => Promise<void>;
  clearForm: () => void;
  loadFromHistory: (entry: HistoryEntry) => void;
  deleteFromHistory: (id: string) => Promise<void>;
  savePricingToFirestore: (data: PricingData) => Promise<void>;
  saveAdvancedToFirestore: (data: AdvancedSettings) => Promise<void>;
}

const defaultInputs: VesselInputs = {
  projectName: '',
  tagNumber: '',
  designPressure: 0,
  designTemperature: 0,
  diameterType: 'OD',
  diameter: 0,
  shellLength: 0,
  plateThickness: 6.40,
  materialType: 'SA516 Gr 70' as MaterialType,
  rubberLining: false,
  quantity: 1,
  orientation: 'vertical' as VesselOrientation,
  jointEfficiency: 0.85,
  corrosionAllowance: 0,
  totalDesignPressureOverride: 0,
  filterPlateCount: 0,
  globalNozzleStandard: 'B16.5',
  filterPlateThickness: 22.30,
  nozzles: [] as NozzleSpec[],
  legInputs: { diameter: 4, length: 0, quantity: 4 } as LegInputs,
  saddleInputs: { quantity: 2 } as SaddleInputs,
};

const defaultDishEndInputs: DishEndInputs = {
  headType: 'ellipsoidal' as HeadType,
  plateThickness: 6.40,
  straightFace: 50,
  quantity: 2,
  cornerRadius: 0,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<VesselInputs>(defaultInputs);
  const [dishEndInputs, setDishEndInputs] = useState<DishEndInputs>(defaultDishEndInputs);
  const dishEndEnabled = dishEndInputs.quantity > 0;
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [projectResults, setProjectResults] = useState<ProjectResults | null>(null);
  const [pricing, setPricing] = useState<PricingData>(DEFAULT_PRICING);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(DEFAULT_ADVANCED);
  const [usingFallbackPricing, setUsingFallbackPricing] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load history and pricing from Firestore on mount
  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch(err => console.error('Failed to fetch history:', err))
      .finally(() => setHistoryLoading(false));

    fetchPricing()
      .then(data => {
        if (data) {
          setPricing({ ...DEFAULT_PRICING, ...data });
          setUsingFallbackPricing(false);
        }
      })
      .catch(err => console.error('Failed to fetch pricing:', err));

    fetchAdvanced()
      .then(data => {
        if (data) setAdvancedSettings({ ...DEFAULT_ADVANCED, ...data });
      })
      .catch(err => console.error('Failed to fetch advanced settings:', err));
  }, []);

  const calcSingleVessel = (inp: VesselInputs, dishEnd: DishEndInputs): CalculationResults => {
    const vesselOD_mm = inp.diameterType === 'OD'
      ? inp.diameter
      : inp.diameter + 2 * inp.plateThickness;
    const neckBlanks = calculateManholeNeckBlanks(inp.nozzles, vesselOD_mm);
    const calc = calculateAll(inp, pricing, advancedSettings, neckBlanks);

    if (dishEnd.quantity > 0 && inp.diameter > 0) {
      const { od, id } = calc;
      const dishResult = calculateDishEnd(dishEnd, id, od, pricing, inp.materialType);
      calc.dishEnd = dishResult;
      if (dishResult.nestingOptions.length > 0) {
        calc.grandTotal += (dishResult.nestingOptions[0].cost ?? 0);
      }
    }

    const { id } = calc;
    if (inp.designPressure > 0 && inp.designTemperature >= 20 && inp.designTemperature <= 400) {
      try {
        const S = getASMEAllowableStress(inp.materialType, inp.designTemperature);
        const P_top_MPa = inp.designPressure / 1000;
        const liquidMPa = inp.orientation === 'vertical' ? calculateLiquidHead(inp.shellLength) : 0;
        const P_total = inp.totalDesignPressureOverride > 0
          ? inp.totalDesignPressureOverride / 1000
          : P_top_MPa + liquidMPa;
        const R_mm = id / 2;
        const shellResult = calculateUG27Shell(P_total, R_mm, S, inp.jointEfficiency, inp.corrosionAllowance, inp.materialType);
        const headType = calc.dishEnd ? calc.dishEnd.inputs.headType : 'ellipsoidal';
        const headResult = calculateUG32Head(P_total, id, headType, S, inp.jointEfficiency, inp.corrosionAllowance, inp.materialType);
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
        // Out-of-range temperature — skip silently
      }
    }

    if (inp.filterPlateCount > 0) {
      const pricePerKg = inp.materialType === 'SA516 Gr 70' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
      calc.filterPlates = calculateFilterPlates(inp.filterPlateCount, id, inp.materialType, pricePerKg, inp.filterPlateThickness);
      calc.grandTotal += calc.filterPlates.totalCost;
    }

    if (inp.nozzles.length > 0) {
      calc.nozzleBOM = calculateNozzleBOM(inp.nozzles, inp.globalNozzleStandard, pricing);
    }

    const supportPricePerKg = inp.materialType === 'SA516 Gr 70' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
    if (inp.orientation === 'vertical') {
      const legs = calculateLegs(inp.legInputs, inp.materialType, supportPricePerKg);
      if (legs) {
        calc.support = { type: 'legs', legs };
        calc.grandTotal += legs.totalCost;
      }
    } else {
      const shellWeightN = calc.shellOptions[0] ? (calc.shellOptions[0].totalWeight ?? 0) * 9.81 : 0;
      const headWeightN = calc.dishEnd ? calc.dishEnd.totalWeightKg * 9.81 : 0;
      const totalWeightN = shellWeightN + headWeightN;
      if (totalWeightN > 0 && calc.asmeThickness) {
        const H_mm = id / 4;
        const saddles = calculateZickSaddle(
          { L: inp.shellLength, OD: calc.od, t: inp.plateThickness, H: H_mm },
          inp.saddleInputs,
          totalWeightN,
          calc.asmeThickness.allowableStressMPa,
          inp.materialType,
          supportPricePerKg,
        );
        calc.support = { type: 'saddles', saddles };
        calc.grandTotal += saddles.totalSaddleCost;
      }
    }

    return calc;
  };

  const runCalculation = async () => {
    const calc = calcSingleVessel(inputs, dishEndInputs);
    setResults(calc);
    setProjectResults(null);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      projectName: inputs.projectName,
      tagNumber: inputs.tagNumber,
      materialType: inputs.materialType,
      od: calc.od,
      shellLength: inputs.shellLength,
      grandTotal: calc.grandTotal,
      timestamp: calc.timestamp,
      results: calc,
    };

    try {
      const serializable = JSON.parse(JSON.stringify(entry)) as HistoryEntry;
      const firestoreId = await saveEstimate(serializable);
      entry.id = firestoreId;
      toast.success('Estimate saved to history');
    } catch (err: any) {
      console.error('Failed to save estimate:', err);
      toast.error(`Failed to save estimate: ${err?.message ?? 'Unknown error'}`);
    }

    setHistory(prev => [entry, ...prev].slice(0, 50));
    return calc;
  };

  const runProjectCalculation = async (vessels: VesselEntry[], dishEndMap: Record<string, DishEndInputs>) => {
    const timestamp = Date.now();
    const vesselResults: VesselCalculationResult[] = vessels.map(v => ({
      vesselId: v.id,
      vesselName: v.name,
      vesselInputs: v.savedInputs,
      dishEndInputs: dishEndMap[v.id] ?? v.savedDishEnd,
      results: calcSingleVessel(v.savedInputs, dishEndMap[v.id] ?? v.savedDishEnd),
    }));

    const grandTotal = vesselResults.reduce(
      (sum, v) => sum + v.results.grandTotal * (v.vesselInputs.quantity || 1),
      0,
    );

    const proj: ProjectResults = {
      projectName: vessels[0]?.savedInputs.projectName ?? '',
      tagNumber: vessels[0]?.savedInputs.tagNumber ?? '',
      timestamp,
      vessels: vesselResults,
      grandTotal,
    };

    setProjectResults(proj);
    setResults(null);

    const firstVessel = vesselResults[0];
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      projectName: proj.projectName,
      tagNumber: proj.tagNumber,
      materialType: firstVessel?.vesselInputs.materialType ?? ('SA516 Gr 70' as MaterialType),
      od: firstVessel?.results.od ?? 0,
      shellLength: firstVessel?.vesselInputs.shellLength ?? 0,
      grandTotal: proj.grandTotal,
      timestamp,
      results: firstVessel?.results ?? ({} as CalculationResults),
      isProjectEntry: true,
      vessels: vesselResults,
    };

    try {
      const serializable = JSON.parse(JSON.stringify(entry)) as HistoryEntry;
      const firestoreId = await saveEstimate(serializable);
      entry.id = firestoreId;
      toast.success(`Project saved — ${vessels.length} vessels`);
    } catch (err: any) {
      console.error('Failed to save project estimate:', err);
      toast.error(`Failed to save: ${err?.message ?? 'Unknown error'}`);
    }

    setHistory(prev => [entry, ...prev].slice(0, 50));
  };

  const clearForm = () => {
    setInputs(defaultInputs);
    setDishEndInputs(defaultDishEndInputs);
    setResults(null);
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setResults(entry.results);
    setInputs(entry.results.inputs);
    if (entry.results.dishEnd) {
      setDishEndInputs(entry.results.dishEnd.inputs);
    }
  };

  const deleteFromHistory = async (id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
    try {
      await deleteEstimate(id);
    } catch (err) {
      console.error('Failed to delete estimate:', err);
    }
  };

  const savePricingToFirestore = async (data: PricingData) => {
    setPricing(data);
    setUsingFallbackPricing(false);
    try {
      await savePricing(data);
    } catch (err) {
      console.error('Failed to save pricing:', err);
    }
  };

  const saveAdvancedToFirestore = async (data: AdvancedSettings) => {
    setAdvancedSettings(data);
    try {
      await saveAdvanced(data);
    } catch (err) {
      console.error('Failed to save advanced settings:', err);
    }
  };

  return (
    <AppContext.Provider value={{
      inputs, setInputs,
      dishEndInputs, setDishEndInputs, dishEndEnabled,
      results, setResults,
      projectResults, setProjectResults,
      pricing, setPricing, advancedSettings, setAdvancedSettings, usingFallbackPricing, setUsingFallbackPricing,
      history, historyLoading,
      runCalculation, runProjectCalculation, clearForm, loadFromHistory, deleteFromHistory, savePricingToFirestore, saveAdvancedToFirestore,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
