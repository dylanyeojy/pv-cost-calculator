import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { HistoryEntry, PricingData, AdvancedSettings } from './types';

// ─── History (estimates collection) ───

const estimatesCol = collection(db, 'estimates');

export async function fetchHistory(max = 50): Promise<HistoryEntry[]> {
  const q = query(estimatesCol, orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as HistoryEntry));
}

export async function saveEstimate(entry: HistoryEntry): Promise<string> {
  const { id, ...data } = entry;
  const ref = await addDoc(estimatesCol, data);
  return ref.id;
}

export async function deleteEstimate(id: string): Promise<void> {
  await deleteDoc(doc(db, 'estimates', id));
}

// ─── Pricing (config/pricing document) ───

const pricingRef = doc(db, 'config', 'pricing');

export async function fetchPricing(): Promise<PricingData | null> {
  const snap = await getDoc(pricingRef);
  return snap.exists() ? (snap.data() as PricingData) : null;
}

export async function savePricing(pricing: PricingData): Promise<void> {
  await setDoc(pricingRef, pricing);
}

// ─── Advanced settings (config/advanced document) ───

const advancedRef = doc(db, 'config', 'advanced');

export async function fetchAdvanced(): Promise<AdvancedSettings | null> {
  const snap = await getDoc(advancedRef);
  return snap.exists() ? (snap.data() as AdvancedSettings) : null;
}

export async function saveAdvanced(settings: AdvancedSettings): Promise<void> {
  await setDoc(advancedRef, settings);
}
