import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VesselInputs, CalculationResults, PricingData, DEFAULT_PRICING, AdvancedSettings, DEFAULT_ADVANCED, HistoryEntry, MaterialType, DishEndInputs, HeadType, VesselOrientation, NozzleSpec, LegInputs, SaddleInputs } from './types';
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
  pricing: PricingData;
  setPricing: React.Dispatch<React.SetStateAction<PricingData>>;
  advancedSettings: AdvancedSettings;
  setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
  usingFallbackPricing: boolean;
  setUsingFallbackPricing: React.Dispatch<React.SetStateAction<boolean>>;
  history: HistoryEntry[];
  historyLoading: boolean;
  runCalculation: () => Promise<CalculationResults>;
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
  corrosionAllowance: 3,
  totalDesignPressureOverride: 0,
  filterPlateCount: 0,
  globalNozzleStandard: 'B16.5',
  filterPlateThickness: 22.30,
  nozzles: [] as NozzleSpec[],
  legInputs: { diameter: 4, length: 1500, quantity: 4 } as LegInputs,
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

  const runCalculation = async () => {
    const vesselOD_mm = inputs.diameterType === 'OD'
      ? inputs.diameter
      : inputs.diameter + 2 * inputs.plateThickness;
    const neckBlanks = calculateManholeNeckBlanks(inputs.nozzles, vesselOD_mm);
    const calc = calculateAll(inputs, pricing, advancedSettings, neckBlanks);

    // Calculate dish end if quantity > 0
    if (dishEndInputs.quantity > 0 && inputs.diameter > 0) {
      const { od, id } = calc;
      const dishResult = calculateDishEnd(dishEndInputs, id, od, pricing, inputs.materialType);
      calc.dishEnd = dishResult;

      // Add dish end best cost to grand total
      if (dishResult.nestingOptions.length > 0) {
        calc.grandTotal += (dishResult.nestingOptions[0].cost ?? 0);
      }
    }

    // ─── Phase 2: ASME thickness ───
    const { id } = calc;
    if (inputs.designPressure > 0 && inputs.designTemperature >= 20 && inputs.designTemperature <= 400) {
      try {
        const S = getASMEAllowableStress(inputs.materialType, inputs.designTemperature);
        const P_top_MPa = inputs.designPressure / 1000; // kPa → MPa
        const liquidMPa = inputs.orientation === 'vertical'
          ? calculateLiquidHead(inputs.shellLength)
          : 0;
        const P_total = inputs.totalDesignPressureOverride > 0
          ? inputs.totalDesignPressureOverride / 1000
          : P_top_MPa + liquidMPa;
        const R_mm = id / 2;
        const shellResult = calculateUG27Shell(P_total, R_mm, S, inputs.jointEfficiency, inputs.corrosionAllowance, inputs.materialType);
        const headType = calc.dishEnd ? calc.dishEnd.inputs.headType : 'ellipsoidal';
        const headResult = calculateUG32Head(P_total, id, headType, S, inputs.jointEfficiency, inputs.corrosionAllowance, inputs.materialType);
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
        // Out-of-range temperature — skip silently (form validation catches it)
      }
    }

    // ─── Phase 2: Filter plates ───
    if (inputs.filterPlateCount > 0) {
      const pricePerKg = inputs.materialType === 'SA516 Gr 70' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
      calc.filterPlates = calculateFilterPlates(inputs.filterPlateCount, id, inputs.materialType, pricePerKg, inputs.filterPlateThickness);
      calc.grandTotal += calc.filterPlates.totalCost;
    }

    // ─── Phase 2: Nozzle BOM ───
    if (inputs.nozzles.length > 0) {
      calc.nozzleBOM = calculateNozzleBOM(inputs.nozzles, inputs.globalNozzleStandard, pricing);
    }

    // ─── Phase 2: Supports ───
    const supportPricePerKg = inputs.materialType === 'SA516 Gr 70' ? pricing.cs_plate_per_kg : pricing.ss_plate_per_kg;
    if (inputs.orientation === 'vertical') {
      const legs = calculateLegs(inputs.legInputs, inputs.materialType, supportPricePerKg);
      if (legs) {
        calc.support = { type: 'legs', legs };
        calc.grandTotal += legs.totalCost;
      }
    } else {
      const shellWeightN = calc.shellOptions[0]
        ? (calc.shellOptions[0].totalWeight ?? 0) * 9.81
        : 0;
      const headWeightN = calc.dishEnd ? calc.dishEnd.totalWeightKg * 9.81 : 0;
      const totalWeightN = shellWeightN + headWeightN;
      if (totalWeightN > 0 && calc.asmeThickness) {
        const H_mm = id / 4;
        const saddles = calculateZickSaddle(
          { L: inputs.shellLength, OD: calc.od, t: inputs.plateThickness, H: H_mm },
          inputs.saddleInputs,
          totalWeightN,
          calc.asmeThickness.allowableStressMPa,
          inputs.materialType,
          supportPricePerKg,
        );
        calc.support = { type: 'saddles', saddles };
        calc.grandTotal += saddles.totalSaddleCost;
      }
    }

    setResults(calc);

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
      // JSON round-trip strips undefined fields which Firestore rejects
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
      pricing, setPricing, advancedSettings, setAdvancedSettings, usingFallbackPricing, setUsingFallbackPricing,
      history, historyLoading,
      runCalculation, clearForm, loadFromHistory, deleteFromHistory, savePricingToFirestore, saveAdvancedToFirestore,
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
