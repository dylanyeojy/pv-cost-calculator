import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/lib/context';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { HEAD_TYPE_LABELS } from '@/lib/dishEndCalculations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Printer, Plus, Trophy, Check, FileText } from 'lucide-react';
import { ShellOption, NestingOption } from '@/lib/types';
import NumberFlow from '@number-flow/react';

const RANK_LABELS = ['★ BEST', '2ND', '3RD', '4TH', '5TH'];

// ─── Shell course group table ───

function CourseGroupTable({ option }: { option: ShellOption }) {
  const grouped = new Map<string, { width: number; length: number; count: number; platesAround: number; standardPlates: number; piecesPerPlate: number }>();
  for (const c of option.courses) {
    const key = `${c.width}x${c.length}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.standardPlates += c.standardPlates;
    } else {
      grouped.set(key, { width: c.width, length: c.length, count: 1, platesAround: c.platesAround, standardPlates: c.standardPlates, piecesPerPlate: c.piecesPerPlate });
    }
  }
  const qty = option.quantity ?? 1;

  return (
    <div className="space-y-1">
      {[...grouped.values()].map((g, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {g.count} {g.count === 1 ? 'course' : 'courses'} × {g.platesAround} {g.platesAround === 1 ? 'piece' : 'pieces'}/ring{qty > 1 ? ` × ${qty} vessels` : ''}
            {g.piecesPerPlate > 1 && <span className="ml-1 text-primary/70">({g.piecesPerPlate} cuts/plate)</span>}
            <span className="font-mono ml-2 text-foreground">[{g.width}×{g.length} mm]</span>
          </span>
          <span className="font-mono font-medium">{g.standardPlates} {g.standardPlates === 1 ? 'plate' : 'plates'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Nesting plate breakdown ───

function NestingPlateTable({ option }: { option: NestingOption }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Layout: <span className="font-medium text-foreground uppercase">{option.layout}</span>
          {option.numWeld > 1 && (
            <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
              {option.numWeld} plates welded → canvas
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Canvas: <span className="font-mono text-foreground">{option.canvasW}×{option.canvasH} mm</span>
          <span className="ml-2">• {option.blanksPerCanvas} {option.blanksPerCanvas === 1 ? 'blank' : 'blanks'}/canvas × {option.numCanvases} {option.numCanvases === 1 ? 'canvas' : 'canvases'}</span>
        </span>
      </div>
      {option.plateSpecs.map((spec, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Purchase: <span className="font-mono text-foreground">[{spec.width}×{spec.length} mm]</span>
          </span>
          <span className="font-mono font-medium">{spec.count} {spec.count === 1 ? 'plate' : 'plates'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared detail breakdown component ───

function OptionDetails({
  rank,
  isMixed,
  children,
  boughtM2,
  netAreaM2,
  totalWeight,
  cost,
}: {
  rank: number;
  isMixed?: boolean;
  children: React.ReactNode;
  boughtM2: number;
  netAreaM2: number;
  totalWeight: number;
  cost: number;
}) {
  return (
    <div className="rounded-xl glass-card card-shadow-lg overflow-hidden border-2 border-border/60 hover:border-primary/40 transition-colors duration-200">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {rank === 0 && <Trophy className="h-5 w-5 text-primary" />}
          <span className="font-semibold text-foreground">
            {RANK_LABELS[rank] || `#${rank + 1}`} — Detail Breakdown
          </span>
          {isMixed && (
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">
              MIXED
            </span>
          )}
        </div>
      </div>
      <div className="px-6 pb-5 pt-4 space-y-4">
        {children}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-border text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Area Purchased</p>
            <p className="font-mono font-semibold">{formatNumber(boughtM2, 4)} m²</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Net Area Needed</p>
            <p className="font-mono font-semibold">{formatNumber(netAreaM2, 4)} m²</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Area Wasted</p>
            <p className="font-mono font-semibold">{formatNumber(boughtM2 - netAreaM2, 4)} m²</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Weight</p>
            <p className="font-mono font-semibold">{formatNumber(totalWeight, 1)} kg</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Plate Cost</p>
            <p className="font-mono font-bold text-primary">{formatCurrency(cost)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Selectable option cards ───

const LABEL_STYLES: Record<string, string> = {
  'Fabrication-efficient': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'Material-efficient':    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Balanced':              'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'No Weld':               'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

function OptionCards({
  items,
  selectedIndex,
  onSelect,
  isMixedFn,
}: {
  items: { totalPlates: number; totalStandardPlates?: number; wastagePct: number; finalCost?: number; label?: string }[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  isMixedFn?: (i: number) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {items.map((opt, i) => {
        const isSelected = i === selectedIndex;
        const mixed = isMixedFn?.(i);
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`relative rounded-xl p-4 text-left transition-all border-2 cursor-pointer ${
              isSelected
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30'
            }`}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-2">
              {i === 0 && <Trophy className="h-4 w-4 text-primary shrink-0" />}
              <span className={`text-xs font-bold ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {RANK_LABELS[i] || `#${i + 1}`}
              </span>
            </div>
            <p className="font-mono font-bold text-lg leading-tight">{opt.totalStandardPlates ?? opt.totalPlates}</p>
            <p className="text-[11px] text-muted-foreground">plates</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">{opt.wastagePct.toFixed(1)}% waste</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {mixed && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                  MIXED
                </span>
              )}
              {opt.label && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LABEL_STYLES[opt.label] ?? 'bg-accent text-accent-foreground'}`}>
                  {opt.label}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Helper: check if a nesting option is "mixed" (has more than one plate spec size)
function isNestingMixed(option: NestingOption): boolean {
  const distinctSizes = new Set(option.plateSpecs.map(s => `${s.width}x${s.length}`));
  return distinctSizes.size > 1;
}

// ─── Invoice panel (right column) ───

interface ShellGroup { width: number; length: number; plates: number }

// ─── Print-only invoice document ───

import type { CalculationResults as CR, ShellOption as SO, NestingOption as NO, DishEndResults as DER } from '@/lib/types';

function PrintInvoiceDoc({
  inputs,
  od,
  id,
  shellOption,
  shellGroups,
  shellCost,
  dishEnd,
  dishOption,
  dishGroups,
  dishCost,
  filterPlateCost,
  filterPlateCount,
  nozzleNeckCost,
  supportCost,
  supportType,
  combinedCost,
}: {
  inputs: CR['inputs'];
  od: number;
  id: number;
  shellOption: SO | undefined;
  shellGroups: ShellGroup[];
  shellCost: number;
  dishEnd: DER | null;
  dishOption: NO | null;
  dishGroups: { width: number; length: number; plates: number }[] | null;
  dishCost: number;
  filterPlateCost: number;
  filterPlateCount: number;
  nozzleNeckCost: number;
  supportCost: number;
  supportType: 'legs' | 'saddles' | null;
  combinedCost: number;
}) {
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  const materialLabel = inputs.materialType;

  return (
    <div className="print-invoice-doc">
      {/* Letterhead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12pt', borderBottom: '2pt solid #1a7fe8', paddingBottom: '8pt' }}>
        <div>
          <div className="pi-app">Pressure Vessel Costing Calculator</div>
          <div className="pi-title">Invoice</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pi-value">{today}</div>
        </div>
      </div>

      {/* Bill To / Project */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16pt', marginBottom: '10pt' }}>
        <div>
          <div className="pi-label">Project</div>
          <div className="pi-value" style={{ fontSize: '11pt' }}>{inputs.projectName || '—'}</div>
          {inputs.tagNumber && (
            <div style={{ marginTop: '4pt' }}>
              <div className="pi-label">Reference</div>
              <div className="pi-value pi-mono">{inputs.tagNumber}</div>
            </div>
          )}
        </div>
        <div>
          <div className="pi-label">Specifications</div>
          <div className="pi-value pi-mono" style={{ fontSize: '8.5pt', lineHeight: '1.6' }}>
            OD {formatNumber(od, 1)} mm &nbsp;|&nbsp; ID {formatNumber(id, 1)} mm<br />
            L {formatNumber(inputs.shellLength)} mm &nbsp;|&nbsp; t {formatNumber(inputs.plateThickness, 2)} mm<br />
            {materialLabel}
          </div>
        </div>
      </div>

      <hr className="pi-divider" />

      {/* Shell Plates Table */}
      <div className="pi-section-header">Shell Plates</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="right">Qty</th>
            <th className="right">Weight (kg)</th>
            <th className="right">Cost (MYR)</th>
          </tr>
        </thead>
        <tbody>
          {shellGroups.map((g, i) => {
            const groupAreaM2 = (g.plates * g.width * g.length) / 1e6;
            const fraction = shellOption && shellOption.boughtM2 > 0
              ? groupAreaM2 / shellOption.boughtM2
              : 1 / shellGroups.length;
            const weight = (shellOption?.totalWeight ?? 0) * fraction;
            const cost = shellCost * fraction;
            return (
              <tr key={i}>
                <td className="pi-mono">{g.width}×{g.length} mm — {formatNumber(inputs.plateThickness, 2)} mm</td>
                <td className="right pi-mono">{g.plates}</td>
                <td className="right pi-mono">{formatNumber(weight, 1)}</td>
                <td className="right pi-mono">{formatCurrency(cost)}</td>
              </tr>
            );
          })}
          <tr className="subtotal">
            <td>Shell Plates Subtotal</td>
            <td className="right pi-mono">{shellOption?.totalStandardPlates ?? 0}</td>
            <td className="right pi-mono">{formatNumber(shellOption?.totalWeight ?? 0, 1)}</td>
            <td className="right pi-mono">{formatCurrency(shellCost)}</td>
          </tr>
        </tbody>
      </table>

      {/* Dish End Plates Table */}
      {dishOption && dishGroups && dishGroups.length > 0 && (
        <>
          <div className="pi-section-header">Dish End Plates (×{dishEnd?.inputs.quantity} ends)</div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="right">Qty</th>
                <th className="right">Weight (kg)</th>
                <th className="right">Cost (MYR)</th>
              </tr>
            </thead>
            <tbody>
              {dishGroups.map((g, i) => {
                const groupAreaM2 = (g.plates * g.width * g.length) / 1e6;
                const fraction = dishOption.boughtAreaM2 > 0
                  ? groupAreaM2 / dishOption.boughtAreaM2
                  : 1 / dishGroups.length;
                const weight = (dishOption.totalWeight ?? 0) * fraction;
                const cost = dishCost * fraction;
                return (
                  <tr key={i}>
                    <td className="pi-mono">{g.width}×{g.length} mm — {formatNumber(dishEnd?.inputs.plateThickness ?? 0, 2)} mm</td>
                    <td className="right pi-mono">{g.plates}</td>
                    <td className="right pi-mono">{formatNumber(weight, 1)}</td>
                    <td className="right pi-mono">{formatCurrency(cost)}</td>
                  </tr>
                );
              })}
              <tr className="subtotal">
                <td>Dish End Plates Subtotal</td>
                <td className="right pi-mono">{dishOption.totalPlates}</td>
                <td className="right pi-mono">{formatNumber(dishOption.totalWeight ?? 0, 1)}</td>
                <td className="right pi-mono">{formatCurrency(dishCost)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Filter Plates */}
      {filterPlateCount > 0 && (
        <>
          <div className="pi-section-header">Filter Plates (×{filterPlateCount})</div>
          <table>
            <tbody>
              <tr>
                <td>Filter Plates — material cost</td>
                <td className="right" /><td className="right" />
                <td className="right pi-mono">{formatCurrency(filterPlateCost)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Nozzle & Manhole Necks */}
      {nozzleNeckCost > 0 && (
        <>
          <div className="pi-section-header">Nozzle & Manhole Necks (SA106 Gr. B)</div>
          <table>
            <tbody>
              <tr>
                <td>SA106 pipe necks — material cost</td>
                <td className="right" /><td className="right" />
                <td className="right pi-mono">{formatCurrency(nozzleNeckCost)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Leg Supports / Saddles */}
      {supportCost > 0 && (
        <>
          <div className="pi-section-header">{supportType === 'legs' ? 'Leg Supports (SA106 Gr. B)' : 'Saddles (SA106 Gr. B)'}</div>
          <table>
            <tbody>
              <tr>
                <td>SA106 support steel — material cost</td>
                <td className="right" /><td className="right" />
                <td className="right pi-mono">{formatCurrency(supportCost)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Other items placeholder */}
      <hr className="pi-divider" />
      <table>
        <tbody>
          <tr>
            <td style={{ color: '#94a3b8', fontStyle: 'italic' }}>Flanges</td>
            <td className="right" style={{ color: '#94a3b8', fontStyle: 'italic' }}>— obtain quote</td>
          </tr>
          <tr>
            <td style={{ color: '#94a3b8', fontStyle: 'italic' }}>Welding (FCAW)</td>
            <td className="right" style={{ color: '#94a3b8', fontStyle: 'italic' }}>— to be quoted</td>
          </tr>
          <tr>
            <td style={{ color: '#94a3b8', fontStyle: 'italic' }}>Surface coating</td>
            <td className="right" style={{ color: '#94a3b8', fontStyle: 'italic' }}>— to be quoted</td>
          </tr>
        </tbody>
      </table>

      {/* Grand Total */}
      <div className="pi-total-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: '10pt', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Total{(inputs.quantity ?? 1) > 1 ? ` (×${inputs.quantity} vessels)` : ''}
        </div>
        <div className="pi-mono" style={{ fontSize: '16pt', fontWeight: 800, color: '#1a7fe8' }}>
          {formatCurrency(combinedCost)}
        </div>
      </div>
      {(inputs.quantity ?? 1) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4pt', fontSize: '8.5pt', color: '#94a3b8' }}>
          <span>Per vessel</span>
          <span className="pi-mono">{formatCurrency(combinedCost / (inputs.quantity ?? 1))}</span>
        </div>
      )}

      {/* Footer */}
      <hr className="pi-divider" style={{ marginTop: '12pt' }} />
      <div style={{ fontSize: '7.5pt', color: '#94a3b8', lineHeight: 1.5 }}>
        This estimate covers raw plate material costs only. Welding, surface coating, inspection, and other fabrication costs are not included and must be quoted separately.
        Generated by Pressure Vessel Costing Calculator.
      </div>
    </div>
  );
}

function InvoicePanel({
  projectName,
  tagNumber,
  shellGroups,
  shellOption,
  shellThickness,
  shellCost,
  dishGroups,
  dishOption,
  dishThickness,
  dishQuantity,
  dishCost,
  filterPlateCost,
  filterPlateCount,
  nozzleNeckCost,
  supportCost,
  supportType,
  combinedCost,
  vesselQuantity,
  onPrint,
  onNewEstimate,
}: {
  projectName: string;
  tagNumber: string;
  shellGroups: ShellGroup[];
  shellOption: ShellOption | undefined;
  shellThickness: number;
  shellCost: number;
  dishGroups: { width: number; length: number; plates: number }[] | null;
  dishOption: NestingOption | null;
  dishThickness: number;
  dishQuantity: number;
  dishCost: number;
  filterPlateCost: number;
  filterPlateCount: number;
  nozzleNeckCost: number;
  supportCost: number;
  supportType: 'legs' | 'saddles' | null;
  combinedCost: number;
  vesselQuantity: number;
  onPrint: () => void;
  onNewEstimate: () => void;
}) {
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  // Column header cell
  const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`py-1.5 px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );

  return (
    <div className="rounded-xl glass-card card-shadow-lg border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/60 bg-primary/5">
        {/* Row 1: Invoice title */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">Invoice</p>
        </div>
        {/* Row 2: Project name, then tag + date on same line */}
        <div className="pl-[2.625rem]">
          <p className="text-sm font-semibold text-foreground">{projectName || 'Unnamed Project'}</p>
          <div className="flex items-center justify-between gap-3 mt-0.5">
            <p className="text-xs text-muted-foreground font-mono">{tagNumber || '\u00a0'}</p>
            <span className="text-xs text-muted-foreground shrink-0">{today}</span>
          </div>
        </div>
      </div>

      {/* Shell Plates Table */}
      <div className="px-5 pt-4 pb-3 border-b border-border/60">
        <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2">Shell Plates</p>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Plate Size</Th>
              <Th right>Qty</Th>
              <Th right>Weight</Th>
              <Th right>Cost</Th>
            </tr>
          </thead>
          <tbody>
            {shellGroups.map((g, i) => {
              const groupAreaM2 = (g.plates * g.width * g.length) / 1e6;
              const frac = shellOption && shellOption.boughtM2 > 0
                ? groupAreaM2 / shellOption.boughtM2 : 1 / (shellGroups.length || 1);
              const w = (shellOption?.totalWeight ?? 0) * frac;
              return (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 px-2 font-mono leading-tight">
                    <div>{g.width}×{g.length}</div>
                    <div className="text-[10px] text-muted-foreground">{shellThickness} mm</div>
                  </td>
                  <td className="py-1.5 px-2 font-mono text-right">{g.plates}</td>
                  <td className="py-1.5 px-2 font-mono text-right">{formatNumber(w, 0)} kg</td>
                  <td className="py-1.5 px-2 font-mono text-right">{formatCurrency(shellCost * frac)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60 bg-accent/20">
              <td className="py-1.5 px-2 font-semibold text-xs">Subtotal</td>
              <td className="py-1.5 px-2 font-mono text-right font-semibold">{shellOption?.totalStandardPlates ?? 0}</td>
              <td className="py-1.5 px-2 font-mono text-right font-semibold">{formatNumber(shellOption?.totalWeight ?? 0, 0)} kg</td>
              <td className="py-1.5 px-2 font-mono text-right font-semibold">{formatCurrency(shellCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Dish End Plates Table */}
      {dishGroups && dishGroups.length > 0 && dishOption && (
        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2">
            Dish End Plates <span className="text-muted-foreground font-normal normal-case">×{dishQuantity} ends</span>
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Plate Size</Th>
                <Th right>Qty</Th>
                <Th right>Weight</Th>
                <Th right>Cost</Th>
              </tr>
            </thead>
            <tbody>
              {dishGroups.map((g, i) => {
                const groupAreaM2 = (g.plates * g.width * g.length) / 1e6;
                const frac = dishOption.boughtAreaM2 > 0
                  ? groupAreaM2 / dishOption.boughtAreaM2 : 1 / (dishGroups.length || 1);
                const w = (dishOption.totalWeight ?? 0) * frac;
                return (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 px-2 font-mono leading-tight">
                      <div>{g.width}×{g.length}</div>
                      <div className="text-[10px] text-muted-foreground">{dishThickness} mm</div>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-right">{g.plates}</td>
                    <td className="py-1.5 px-2 font-mono text-right">{formatNumber(w, 0)} kg</td>
                    <td className="py-1.5 px-2 font-mono text-right">{formatCurrency(dishCost * frac)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 bg-accent/20">
                <td className="py-1.5 px-2 font-semibold text-xs">Subtotal</td>
                <td className="py-1.5 px-2 font-mono text-right font-semibold">{dishOption.totalPlates}</td>
                <td className="py-1.5 px-2 font-mono text-right font-semibold">{formatNumber(dishOption.totalWeight ?? 0, 0)} kg</td>
                <td className="py-1.5 px-2 font-mono text-right font-semibold">{formatCurrency(dishCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Filter Plates line */}
      {filterPlateCount > 0 && (
        <div className="px-5 pt-3 pb-2 border-b border-border/60">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5">Filter Plates</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">×{filterPlateCount} plates</span>
            <span className="font-mono font-semibold">{formatCurrency(filterPlateCost)}</span>
          </div>
        </div>
      )}

      {/* SA106 Nozzle Necks line */}
      {nozzleNeckCost > 0 && (
        <div className="px-5 pt-3 pb-2 border-b border-border/60">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5">Nozzle & Manhole Necks (SA106)</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{formatCurrency(nozzleNeckCost)}</span>
          </div>
        </div>
      )}

      {/* Supports line */}
      {supportCost > 0 && (
        <div className="px-5 pt-3 pb-2 border-b border-border/60">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5">
            {supportType === 'legs' ? 'Leg Supports (SA106)' : 'Saddles (SA106)'}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{formatCurrency(supportCost)}</span>
          </div>
        </div>
      )}

      {/* Flanges */}
      <div className="px-5 py-2.5 border-b border-border/60 space-y-1">
        {[['Flanges', '— obtain quote'], ['Welding (FCAW)', '— to be quoted'], ['Surface coating', '— to be quoted']].map(([label, val]) => (
          <div key={label} className="flex items-center justify-between text-xs text-muted-foreground/60 italic">
            <span>{label}</span><span>{val}</span>
          </div>
        ))}
      </div>

      {/* Grand Total */}
      <div className="px-5 py-4 border-b border-primary/20 bg-primary/5">
        {vesselQuantity > 1 && (
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Per vessel</p>
            <p className="text-sm font-mono text-muted-foreground">{formatCurrency(combinedCost / vesselQuantity)}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Total Amount{vesselQuantity > 1 ? ` ×${vesselQuantity}` : ''}
          </p>
          <NumberFlow
            value={combinedCost}
            format={{ style: 'currency', currency: 'MYR', minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            className="text-xl font-bold font-mono text-primary"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-2 no-print">
        <Button variant="outline" className="flex-1 h-9 text-xs rounded-lg" onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print / PDF
        </Button>
        <Button className="flex-1 h-9 text-xs rounded-lg" onClick={onNewEstimate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Estimate
        </Button>
      </div>
    </div>
  );
}

// ─── Main Results page ───

export default function Results() {
  const { results, projectResults, usingFallbackPricing, clearForm } = useAppContext();
  const navigate = useNavigate();
  const [shellSelectedIndex, setShellSelectedIndex] = useState(0);
  const [dishSelectedIndex, setDishSelectedIndex] = useState(0);
  const [activeVesselTab, setActiveVesselTab] = useState(0);

  // Reset tab indices when switching vessel tabs
  useEffect(() => { setShellSelectedIndex(0); setDishSelectedIndex(0); }, [activeVesselTab]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!results && !projectResults) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-muted-foreground mb-4">No results yet. Run a calculation first.</p>
        <Button onClick={() => navigate('/')}>New Estimate</Button>
      </div>
    );
  }

  const isSummaryTab = projectResults !== null && activeVesselTab >= projectResults.vessels.length;

  // In multi-vessel mode use the active tab's results; otherwise use single results
  const activeResults = projectResults
    ? (isSummaryTab ? null : projectResults.vessels[activeVesselTab]?.results ?? null)
    : results;

  if (!activeResults && !isSummaryTab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-muted-foreground mb-4">No results yet. Run a calculation first.</p>
        <Button onClick={() => navigate('/')}>New Estimate</Button>
      </div>
    );
  }

  const { inputs, od, id, circumference, netShellAreaM2, shellOptions, dishEnd } = activeResults ?? ({} as typeof activeResults);
  const materialLabel = inputs.materialType;

  const shellOption = shellOptions[shellSelectedIndex];
  const dishOption = dishEnd?.nestingOptions[dishSelectedIndex];

  const shellMaterialCost = shellOption?.cost ?? 0;
  const shellCost = shellMaterialCost;
  const dishCost = dishOption?.cost ?? 0;
  const filterPlateCost = activeResults?.filterPlates?.totalCost ?? 0;
  const nozzleNeckCost = activeResults?.nozzleBOM
    ? activeResults.nozzleBOM.reduce((sum, item) => sum + (item.neckCostRM ?? 0), 0)
    : 0;
  const supportCost = activeResults?.support?.type === 'legs'
    ? (activeResults.support.legs?.totalCost ?? 0)
    : activeResults?.support?.type === 'saddles'
      ? (activeResults.support.saddles?.totalSaddleCost ?? 0)
      : 0;
  const combinedCost = shellCost + dishCost + filterPlateCost + nozzleNeckCost + supportCost;

  // Calculate net blank area for dish end
  const dishNetBlankAreaM2 = dishEnd ? Math.PI * (dishEnd.geometry.BD / 2) ** 2 / 1e6 : 0;

  // Build invoice data for shell plates (group courses by plate size)
  const shellGroups: ShellGroup[] = [];
  if (shellOption) {
    const grouped = new Map<string, ShellGroup>();
    for (const c of shellOption.courses) {
      const key = `${c.width}x${c.length}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.plates += c.standardPlates;
      } else {
        grouped.set(key, { width: c.width, length: c.length, plates: c.standardPlates });
      }
    }
    shellGroups.push(...grouped.values());
  }

  // Build invoice data for dish end plates
  const dishGroups = dishOption
    ? dishOption.plateSpecs.map(s => ({ width: s.width, length: s.length, plates: s.count }))
    : null;

  return (
    <div className="max-w-[1500px] mx-auto p-6 pb-20">
      {/* Print-only invoice document — hidden on screen, shown when printing */}
      <PrintInvoiceDoc
        inputs={inputs}
        od={od}
        id={id}
        shellOption={shellOption}
        shellGroups={shellGroups}
        shellCost={shellCost}
        dishEnd={dishEnd ?? null}
        dishOption={dishOption ?? null}
        dishGroups={dishGroups}
        dishCost={dishCost}
        filterPlateCost={filterPlateCost}
        filterPlateCount={activeResults?.filterPlates?.count ?? 0}
        nozzleNeckCost={nozzleNeckCost}
        supportCost={supportCost}
        supportType={activeResults?.support?.type ?? null}
        combinedCost={combinedCost}
      />

      {/* Screen content — hidden on print */}
      <div className="screen-only">

      {/* Warning banner */}
      {usingFallbackPricing && (
        <div className="flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm mb-6">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="text-warning-foreground">Using offline placeholder prices — update pricing in Settings for accurate estimates.</span>
        </div>
      )}

      {/* Multi-vessel tab bar */}
      {projectResults && (
        <div className="flex gap-1 mb-6 flex-wrap border-b border-border pb-0">
          {projectResults.vessels.map((v, i) => (
            <button
              key={v.vesselId}
              type="button"
              onClick={() => setActiveVesselTab(i)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                activeVesselTab === i
                  ? 'bg-background border-border text-foreground -mb-px'
                  : 'bg-muted/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              {v.vesselName}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveVesselTab(projectResults.vessels.length)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              isSummaryTab
                ? 'bg-background border-border text-foreground -mb-px'
                : 'bg-muted/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            ∑ Summary
          </button>
        </div>
      )}

      {/* Summary tab */}
      {isSummaryTab && projectResults && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Vessel</th>
                  <th className="text-right px-4 py-3 font-medium">OD (mm)</th>
                  <th className="text-right px-4 py-3 font-medium">Length (mm)</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Unit Cost</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectResults.vessels.map((v) => {
                  const qty = v.vesselInputs.quantity || 1;
                  return (
                    <tr key={v.vesselId} className="bg-background hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{v.vesselName}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(v.results.od, 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(v.vesselInputs.shellLength, 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">×{qty}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(v.results.grandTotal)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(v.results.grandTotal * qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-foreground text-background">
                  <td colSpan={5} className="px-4 py-3 font-semibold text-sm uppercase tracking-wide">Project Total</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-base">{formatCurrency(projectResults.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => { clearForm(); navigate('/'); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Estimate
            </Button>
          </div>
        </div>
      )}

      {/* Per-vessel / single-vessel content */}
      {!isSummaryTab && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-10 items-start">

      {/* ── LEFT COLUMN ── */}
      <div className="space-y-10 min-w-0">

      {/* Project Details Header */}
      <div className="rounded-xl bg-foreground text-background p-5 space-y-4 card-shadow-lg">
        <div>
          <h3 className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-2">Project Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Project</p>
              <p className="font-semibold truncate">{inputs.projectName || '—'}</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Project ID</p>
              <p className="font-mono font-semibold">{inputs.tagNumber || '—'}</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Material</p>
              <p className="font-semibold">{materialLabel}</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Orientation</p>
              <p className="font-semibold capitalize">{inputs.orientation}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10" />

        <div>
          <h3 className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-2">Shell Geometry</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Outer Diameter</p>
              <p className="font-mono font-semibold">{formatNumber(od, 1)} mm</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Inner Diameter</p>
              <p className="font-mono font-semibold">{formatNumber(id, 1)} mm</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Shell Length</p>
              <p className="font-mono font-semibold">{formatNumber(inputs.shellLength)} mm</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Net Shell Area</p>
              <p className="font-mono font-semibold">{formatNumber(netShellAreaM2, 4)} m²</p>
            </div>
            <div>
              <p className="text-background/50 text-xs uppercase tracking-wider">Thickness</p>
              <p className="font-mono font-semibold">{formatNumber(inputs.plateThickness, 2)} mm</p>
            </div>
          </div>
        </div>

        {dishEnd && (
          <>
            <div className="border-t border-background/10" />
            <div>
              <h3 className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-2">Dish End Geometry</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-background/50 text-xs uppercase tracking-wider">Head Type</p>
                  <p className="font-semibold">{HEAD_TYPE_LABELS[dishEnd.inputs.headType]}</p>
                </div>
                <div>
                  <p className="text-background/50 text-xs uppercase tracking-wider">Straight Face</p>
                  <p className="font-mono font-semibold">{dishEnd.inputs.straightFace} mm</p>
                </div>
                <div>
                  <p className="text-background/50 text-xs uppercase tracking-wider">Blank Diameter</p>
                  <p className="font-mono font-semibold">{formatNumber(dishEnd.geometry.BD, 1)} mm</p>
                </div>
                <div>
                  <p className="text-background/50 text-xs uppercase tracking-wider">Net Blank Area</p>
                  <p className="font-mono font-semibold">{formatNumber(dishNetBlankAreaM2, 4)} m²</p>
                </div>
                <div>
                  <p className="text-background/50 text-xs uppercase tracking-wider">Thickness</p>
                  <p className="font-mono font-semibold">{formatNumber(dishEnd.inputs.plateThickness, 2)} mm</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-background/10" />

        {/* Summary row */}
        <div>
          <h3 className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-2">Scope Summary</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <span className="text-background/50 text-xs uppercase tracking-wider mr-1.5">Filter Plates</span>
              <span className="font-semibold">{(inputs.filterPlateCount ?? 0) > 0 ? `Yes (×${inputs.filterPlateCount})` : 'No'}</span>
            </span>
            <span>
              <span className="text-background/50 text-xs uppercase tracking-wider mr-1.5">Manholes</span>
              <span className="font-semibold font-mono">
                {inputs.nozzles?.filter(n => n.type === 'manhole').reduce((s, n) => s + n.quantity, 0) ?? 0}
              </span>
            </span>
            <span>
              <span className="text-background/50 text-xs uppercase tracking-wider mr-1.5">Nozzles</span>
              <span className="font-semibold font-mono">
                {inputs.nozzles?.filter(n => n.type === 'nozzle').reduce((s, n) => s + n.quantity, 0) ?? 0}
              </span>
            </span>
            <span>
              <span className="text-background/50 text-xs uppercase tracking-wider mr-1.5">
                {inputs.orientation === 'vertical' ? 'Leg Supports' : 'Saddles'}
              </span>
              <span className="font-semibold font-mono">
                {inputs.orientation === 'vertical'
                  ? (inputs.legInputs?.quantity ?? 4)
                  : (inputs.saddleInputs?.quantity ?? 2)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Shell Plate Options */}
      <div>
        <h2 className="text-base font-bold mb-4">Shell Plate Options</h2>
        {shellOptions.length === 0 ? (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-6 text-center text-sm text-destructive">
            No valid plate combinations found. Check dimensions vs available plate sizes.
          </div>
        ) : (
          <div className="space-y-4">
            <OptionCards items={shellOptions} selectedIndex={shellSelectedIndex} onSelect={setShellSelectedIndex} isMixedFn={(i) => shellOptions[i].isMixed} />
            <OptionDetails
              rank={shellSelectedIndex}
              isMixed={shellOptions[shellSelectedIndex].isMixed}
              boughtM2={shellOptions[shellSelectedIndex].boughtM2}
              netAreaM2={shellOptions[shellSelectedIndex].netAreaM2}
              totalWeight={shellOptions[shellSelectedIndex].totalWeight ?? 0}
              cost={shellOptions[shellSelectedIndex].cost ?? 0}
            >
              {(() => {
                const shellCourses = shellOptions[shellSelectedIndex].courses.filter(c => c.pieceType === 'shell_course');
                const neckBlanks = shellOptions[shellSelectedIndex].courses.filter(c => c.pieceType === 'neck_blank');
                return (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shell Vessel</h3>
                    <CourseGroupTable option={{ ...shellOptions[shellSelectedIndex], courses: shellCourses }} />
                    {neckBlanks.length > 0 && (
                      <>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Manhole Necks</h3>
                        {neckBlanks.map((c, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {c.quantity} blank{c.quantity !== 1 ? 's' : ''}
                              <span className="font-mono ml-2 text-foreground">[{c.width}×{c.length} mm]</span>
                              <span className="ml-1 text-xs text-muted-foreground/70">(neck blank)</span>
                            </span>
                            <span className="font-mono font-medium">{c.standardPlates} {c.standardPlates === 1 ? 'plate' : 'plates'}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </OptionDetails>
          </div>
        )}
      </div>

      {/* Dish End Plate Options */}
      {dishEnd && dishEnd.nestingOptions.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-4">Dish End Plate Options</h2>
          <div className="space-y-4">
            <OptionCards
              items={dishEnd.nestingOptions}
              selectedIndex={dishSelectedIndex}
              onSelect={setDishSelectedIndex}
              isMixedFn={(i) => isNestingMixed(dishEnd.nestingOptions[i])}
            />
            <OptionDetails
              rank={dishSelectedIndex}
              isMixed={isNestingMixed(dishEnd.nestingOptions[dishSelectedIndex])}
              boughtM2={dishEnd.nestingOptions[dishSelectedIndex].boughtAreaM2}
              netAreaM2={dishEnd.nestingOptions[dishSelectedIndex].netAreaM2}
              totalWeight={dishEnd.nestingOptions[dishSelectedIndex].totalWeight ?? 0}
              cost={dishEnd.nestingOptions[dishSelectedIndex].cost ?? 0}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nesting Configuration</h3>
              <NestingPlateTable option={dishEnd.nestingOptions[dishSelectedIndex]} />
            </OptionDetails>
          </div>
        </div>
      )}

      {dishEnd && dishEnd.nestingOptions.length === 0 && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-6 text-center text-sm text-destructive">
          No standard plate combination can accommodate a blank diameter of {formatNumber(dishEnd.geometry.BD, 1)} mm. Consider petal (gore) construction.
        </div>
      )}

      {/* Filter Plate Options */}
      {activeResults?.filterPlates && activeResults?.filterPlates.count > 0 && (
        <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filter Plate Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Quantity</p>
                <p className="font-semibold">{activeResults?.filterPlates.count}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Blank Diameter</p>
                <p className="font-mono font-semibold">{formatNumber(activeResults?.filterPlates.diameterMm, 1)} mm</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Plate Thickness</p>
                <p className="font-mono font-semibold">{activeResults?.filterPlates.thicknessMm} mm</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Weight per plate</p>
                <p className="font-mono font-semibold">{activeResults?.filterPlates.weightPerPlateKg.toFixed(1)} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total weight</p>
                <p className="font-mono font-semibold">{activeResults?.filterPlates.totalWeightKg.toFixed(1)} kg</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-muted-foreground text-xs">Material Cost</p>
                <p className="font-mono font-bold text-primary">{formatCurrency(activeResults?.filterPlates.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manholes & Nozzles */}
      {activeResults?.nozzleBOM && activeResults?.nozzleBOM.length > 0 && (
        <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Manholes & Nozzles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Manholes */}
            {activeResults?.nozzleBOM.filter(item => item.spec.type === 'manhole').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manholes</h3>
                {activeResults?.nozzleBOM.filter(item => item.spec.type === 'manhole').map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-secondary/30 p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Standard / Size</p>
                        <p className="font-mono font-semibold">{inputs.globalNozzleStandard} {item.spec.size}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Neck Length</p>
                        <p className="font-mono font-semibold">{item.spec.neckLength ?? 300} mm</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Qty</p>
                        <p className="font-mono font-semibold">{item.spec.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Blind Flanges</p>
                        <p className="font-mono font-semibold">{item.blindFlangeQty} <span className="text-muted-foreground font-normal">— obtain quote</span></p>
                      </div>
                    </div>
                    {item.boltCount !== null && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border/40">
                        <div>
                          <p className="text-xs text-muted-foreground">Bolt count (per flange)</p>
                          <p className="font-mono font-semibold">{item.boltCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bolt dia.</p>
                          <p className="font-mono font-semibold">{item.boltDiameterMm !== null ? `Ø${item.boltDiameterMm} mm` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bolt length</p>
                          <p className="font-mono font-semibold">{item.boltLength !== null ? `${item.boltLength.toFixed(0)} mm` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Nuts / Washers (per flange)</p>
                          <p className="font-mono font-semibold">{item.nutCount ?? '—'} / {item.washerCount ?? '—'} <span className="text-muted-foreground font-normal">— obtain quote</span></p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                      <div>
                        <p className="text-xs text-muted-foreground">Neck weight (SA106 Gr. B)</p>
                        <p className="font-mono font-semibold">{item.neckWeightKg !== null ? `${item.neckWeightKg.toFixed(1)} kg` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Neck cost</p>
                        <p className="font-mono font-semibold text-primary">{item.neckCostRM !== null ? formatCurrency(item.neckCostRM) : '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nozzles */}
            {activeResults?.nozzleBOM.filter(item => item.spec.type === 'nozzle').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nozzles</h3>
                {activeResults?.nozzleBOM.filter(item => item.spec.type === 'nozzle').map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-secondary/30 p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Standard / Size</p>
                        <p className="font-mono font-semibold">{inputs.globalNozzleStandard} {item.spec.size}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Neck Length</p>
                        <p className="font-mono font-semibold">{item.spec.neckLength ?? 150} mm</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Qty</p>
                        <p className="font-mono font-semibold">{item.spec.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Flange</p>
                        <p className="font-semibold">{inputs.globalNozzleStandard} {item.spec.size} <span className="text-muted-foreground font-normal">— obtain quote</span></p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                      <div>
                        <p className="text-xs text-muted-foreground">Neck weight (SA106 Gr. B)</p>
                        <p className="font-mono font-semibold">{item.neckWeightKg !== null ? `${item.neckWeightKg.toFixed(1)} kg` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Neck cost</p>
                        <p className="font-mono font-semibold text-primary">{item.neckCostRM !== null ? formatCurrency(item.neckCostRM) : '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leg Supports / Saddle */}
      {activeResults?.support && (
        <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {activeResults?.support.type === 'legs' ? 'Leg Supports' : 'Saddle Supports — Zick Analysis'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeResults?.support.type === 'legs' && activeResults?.support.legs && (() => {
              const l = activeResults?.support.legs;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Pipe OD</p><p className="font-semibold">{l.od_mm} mm</p></div>
                  <div><p className="text-xs text-muted-foreground">Wall Thickness</p><p className="font-semibold">{l.wall_mm} mm</p></div>
                  <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-semibold">{l.quantity}</p></div>
                  <div><p className="text-xs text-muted-foreground">Base Plate (square)</p><p className="font-semibold">{l.basePlateSizeMm.toFixed(0)} × {l.basePlateSizeMm.toFixed(0)} mm · 12 mm thk</p></div>
                  <div><p className="text-xs text-muted-foreground">Weight per leg + base</p><p className="font-semibold">{(l.weightPerLegKg + l.basePlateWeightKg).toFixed(1)} kg</p></div>
                  <div><p className="text-xs text-muted-foreground">Total SA106 weight</p><p className="font-semibold">{l.totalWeightKg.toFixed(1)} kg</p></div>
                  <div className="md:col-span-3 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">SA106 Gr. B Cost</p>
                    <p className="font-semibold text-primary">{formatCurrency(l.totalCost)}</p>
                  </div>
                </div>
              );
            })()}
            {activeResults?.support.type === 'saddles' && activeResults?.support.saddles && (() => {
              const z = activeResults?.support.saddles;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-xs text-muted-foreground">Contact Angle (derived)</p><p className="font-semibold">{z.derivedAngle.toFixed(0)}°</p></div>
                    <div><p className="text-xs text-muted-foreground">Saddle Width (derived)</p><p className="font-semibold">{z.derivedWidth.toFixed(0)} mm</p></div>
                    <div><p className="text-xs text-muted-foreground">Distance A (derived)</p><p className="font-semibold">{z.derivedDistanceA.toFixed(0)} mm</p></div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-2">Stress check</th>
                        <th className="text-right pb-2">Value (MPa)</th>
                        <th className="text-right pb-2">Allowable (MPa)</th>
                        <th className="text-right pb-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Bending at saddle (σ1)</td>
                        <td className="text-right">{z.sigma1MPa.toFixed(2)}</td>
                        <td className="text-right">{z.allowableMPa.toFixed(1)}</td>
                        <td className={`text-right font-semibold ${z.sigma1Pass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {z.sigma1Pass ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2">Bending at midspan (σ2)</td>
                        <td className="text-right">{z.sigma2MPa.toFixed(2)}</td>
                        <td className="text-right">{z.allowableMPa.toFixed(1)}</td>
                        <td className={`text-right font-semibold ${z.sigma2Pass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {z.sigma2Pass ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-xs text-muted-foreground">Load per saddle (Q)</p><p className="font-semibold">{(z.QN / 1000).toFixed(1)} kN</p></div>
                    <div><p className="text-xs text-muted-foreground">Total SA106 weight</p><p className="font-semibold">{z.saddleWeightKg.toFixed(1)} kg</p></div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">SA106 Gr. B Cost</p>
                    <p className="font-semibold text-primary">{formatCurrency(z.totalSaddleCost)}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Tip */}
      <div className="rounded-xl bg-accent/30 border border-accent/50 p-4 text-sm text-muted-foreground">
        <strong>Tip:</strong> More plates = more weld seams = higher welding cost. Balance wastage % vs plate count when choosing.
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-400">
        <strong>Estimation only.</strong> ASME thickness calculations and support estimates are for fabrication costing
        purposes only. Nozzle reinforcement (UG-37), external pressure (UG-28), and seismic/wind loads are not
        calculated. Results are not a substitute for a code-certified engineering design.
      </div>

      </div>{/* end LEFT COLUMN */}

      {/* ── RIGHT COLUMN: sticky invoice ── */}
      <div className="lg:sticky lg:top-[88px] lg:self-start">
        <InvoicePanel
          projectName={inputs.projectName}
          tagNumber={inputs.tagNumber}
          shellGroups={shellGroups}
          shellOption={shellOption}
          shellThickness={inputs.plateThickness}
          shellCost={shellCost}
          dishGroups={dishGroups}
          dishOption={dishOption ?? null}
          dishThickness={dishEnd?.inputs.plateThickness ?? 0}
          dishQuantity={dishEnd?.inputs.quantity ?? 0}
          dishCost={dishCost}
          filterPlateCost={filterPlateCost}
          filterPlateCount={activeResults?.filterPlates?.count ?? 0}
          nozzleNeckCost={nozzleNeckCost}
          supportCost={supportCost}
          supportType={activeResults?.support?.type ?? null}
          combinedCost={combinedCost}
          vesselQuantity={inputs.quantity ?? 1}
          onPrint={() => window.print()}
          onNewEstimate={() => { clearForm(); navigate('/'); }}
        />
      </div>

      </div>
      )}

      </div>{/* end screen-only */}
    </div>
  );
}
