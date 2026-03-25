import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VesselInputs, CalculationResults, PricingData, DEFAULT_PRICING, AdvancedSettings, DEFAULT_ADVANCED, HistoryEntry, MaterialType, SSGrade, DishEndInputs, HeadType } from './types';
import { calculateAll } from './calculations';
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
  materialType: 'carbon_steel' as MaterialType,
  ssGrade: 'SS304' as SSGrade,
  rubberLining: false,
  quantity: 1,
};

const defaultDishEndInputs: DishEndInputs = {
  headType: 'ellipsoidal' as HeadType,
  materialType: 'carbon_steel' as MaterialType,
  ssGrade: 'SS304' as SSGrade,
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
    const calc = calculateAll(inputs, pricing, advancedSettings);

    // Calculate dish end if quantity > 0
    if (dishEndInputs.quantity > 0 && inputs.diameter > 0) {
      const { od, id } = calc;
      const dishResult = calculateDishEnd(dishEndInputs, id, od, pricing);
      calc.dishEnd = dishResult;

      // Add dish end best cost to grand total
      if (dishResult.nestingOptions.length > 0) {
        calc.grandTotal += (dishResult.nestingOptions[0].cost ?? 0);
      }
    }

    setResults(calc);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      projectName: inputs.projectName,
      tagNumber: inputs.tagNumber,
      materialType: inputs.materialType,
      ssGrade: inputs.materialType === 'stainless_steel' ? inputs.ssGrade : undefined,
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
