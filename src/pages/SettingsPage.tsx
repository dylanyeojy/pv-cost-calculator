import { useState } from 'react';
import { useAppContext } from '@/lib/context';
import { DEFAULT_PRICING, DEFAULT_ADVANCED, PricingData, AdvancedSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, RotateCcw, Pencil, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

const PRICING_KEYS: { key: keyof PricingData; description: string; unit: string; helper?: string }[] = [
  { key: 'cs_plate_per_kg', description: 'Carbon Steel Plate', unit: 'RM/kg' },
  { key: 'ss_plate_per_kg', description: 'Stainless Steel Plate', unit: 'RM/kg' },
  { key: 'fcaw_per_metre', description: 'FCAW Welding', unit: 'RM/m' },
  { key: 'jotun_barrier80_per_litre', description: 'Jotun Barrier 80', unit: 'RM/litre' },
  { key: 'jotun_penguard_per_litre', description: 'Jotun Penguard Express', unit: 'RM/litre' },
  { key: 'jotun_hardtop_per_litre', description: 'Jotun Hardtop XP', unit: 'RM/litre' },
  { key: 'rubber_lining_per_m2', description: 'Rubber Lining', unit: 'RM/m²' },
];

export default function SettingsPage() {
  const { pricing, savePricingToFirestore, advancedSettings, saveAdvancedToFirestore } = useAppContext();

  // ─── Unit Pricing state ───
  const [draftPricing, setDraftPricing] = useState<PricingData>({ ...pricing });
  const [editingPricingKey, setEditingPricingKey] = useState<keyof PricingData | null>(null);
  const hasPricingChanges = PRICING_KEYS.some(({ key }) => draftPricing[key] !== pricing[key]);

  const handleSavePricing = async () => {
    await savePricingToFirestore({ ...draftPricing });
    setEditingPricingKey(null);
    toast.success('Pricing saved successfully');
  };

  const handleResetPricing = async () => {
    setDraftPricing({ ...DEFAULT_PRICING });
    await savePricingToFirestore({ ...DEFAULT_PRICING });
    setEditingPricingKey(null);
    toast.info('Pricing reset to defaults');
  };

  const handlePricingChange = (key: keyof PricingData, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setDraftPricing(prev => ({ ...prev, [key]: num }));
    } else if (value === '' || value === '0' || value === '0.') {
      setDraftPricing(prev => ({ ...prev, [key]: 0 }));
    }
  };

  // ─── Advanced Settings state ───
  const [draftAdvanced, setDraftAdvanced] = useState<AdvancedSettings>({ ...advancedSettings });
  const [editingAdvancedKey, setEditingAdvancedKey] = useState<keyof AdvancedSettings | null>(null);
  const hasAdvancedChanges = (Object.keys(DEFAULT_ADVANCED) as (keyof AdvancedSettings)[])
    .some(key => draftAdvanced[key] !== advancedSettings[key]);

  const handleSaveAdvanced = async () => {
    await saveAdvancedToFirestore({ ...draftAdvanced });
    setEditingAdvancedKey(null);
    toast.success('Advanced settings saved');
  };

  const handleResetAdvanced = async () => {
    setDraftAdvanced({ ...DEFAULT_ADVANCED });
    await saveAdvancedToFirestore({ ...DEFAULT_ADVANCED });
    setEditingAdvancedKey(null);
    toast.info('Advanced settings reset to defaults');
  };

  const handleAdvancedChange = (key: keyof AdvancedSettings, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setDraftAdvanced(prev => ({ ...prev, [key]: num }));
    }
  };

  const handleBlur = () => {
    setEditingPricingKey(null);
    setEditingAdvancedKey(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '-' || e.key === 'e') e.preventDefault();
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingPricingKey(null);
      setEditingAdvancedKey(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage unit pricing for estimates</p>
      </div>

      {/* Unit Pricing Card */}
      <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Unit Pricing
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetPricing} className="rounded-lg text-xs">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset Defaults
              </Button>
              <Button size="sm" onClick={handleSavePricing} disabled={!hasPricingChanges} className="rounded-lg text-xs">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Click any price to edit it inline</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRICING_KEYS.map(({ key, description, unit, helper }) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">
                    {description}
                    {helper && <p className="text-xs text-muted-foreground font-normal mt-0.5">{helper}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{unit}</TableCell>
                  <TableCell className="text-right">
                    {editingPricingKey === key ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draftPricing[key]}
                        onChange={e => handlePricingChange(key, e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="h-8 w-28 ml-auto text-right font-mono text-sm bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingPricingKey(key)}
                        className="font-mono text-sm px-2 py-1 rounded-md transition-colors cursor-pointer hover:bg-accent"
                      >
                        {draftPricing[key].toFixed(2)}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Advanced Card */}
      <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Advanced
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetAdvanced} className="rounded-lg text-xs">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset Defaults
              </Button>
              <Button size="sm" onClick={handleSaveAdvanced} disabled={!hasAdvancedChanges} className="rounded-lg text-xs">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Model tuning parameters — adjust to calibrate ranking behaviour</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Segmentation Weight */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Segmentation Weight</p>
              <p className="text-xs text-muted-foreground mt-0.5">Controls how strongly segmentation complexity is penalized relative to weld cost (0 = disabled, max 2)</p>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[draftAdvanced.segmentationWeight]}
                onValueChange={([v]) => setDraftAdvanced(prev => ({ ...prev, segmentationWeight: v }))}
                showTooltip
                tooltipContent={v => `${v.toFixed(1)} ×`}
                className="flex-1"
              />
              <span className="font-mono text-sm w-12 text-right tabular-nums">{draftAdvanced.segmentationWeight.toFixed(1)} ×</span>
            </div>
          </div>

          {/* Segmentation Exponent */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Segmentation Exponent</p>
              <p className="text-xs text-muted-foreground mt-0.5">How sharply the penalty grows with extra segments — higher values more strongly discourage additional segments</p>
            </div>
            <div className="shrink-0">
              {editingAdvancedKey === 'segmentationExponent' ? (
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="3"
                  value={draftAdvanced.segmentationExponent}
                  onChange={e => handleAdvancedChange('segmentationExponent', e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="h-8 w-24 text-right font-mono text-sm bg-secondary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              ) : (
                <button
                  onClick={() => setEditingAdvancedKey('segmentationExponent')}
                  className="font-mono text-sm px-2 py-1 rounded-md transition-colors cursor-pointer hover:bg-accent"
                >
                  {draftAdvanced.segmentationExponent.toFixed(1)}
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
