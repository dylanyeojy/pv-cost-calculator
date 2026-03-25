import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/lib/context';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Card, CardContent } from '@/components/ui/card';
import { History, Trash2 } from 'lucide-react';
import { HistoryEntry } from '@/lib/types';

export default function HistoryPage() {
  const { history, historyLoading, loadFromHistory, deleteFromHistory } = useAppContext();
  const navigate = useNavigate();

  const handleClick = (entry: HistoryEntry) => {
    loadFromHistory(entry);
    navigate('/results');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteFromHistory(id);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">History</h1>
        <p className="text-sm text-muted-foreground mt-1">Past estimates saved to Firestore</p>
      </div>

      {historyLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No estimates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(entry => {
            const r = entry.results;
            const vesselQty = r?.inputs?.quantity ?? 1;
            const dishQty = r?.dishEnd?.inputs?.quantity ?? 0;
            const bestShell = r?.shellOptions?.[0];
            const shellPlates = bestShell?.totalStandardPlates;
            const shellThickness = r?.inputs?.plateThickness;
            const materialLabel = entry.materialType === 'carbon_steel' ? 'CS' : 'SS';

            return (
              <Card
                key={entry.id}
                className="glass-card card-shadow border border-border/50 rounded-xl cursor-pointer hover:border-primary/40 transition-colors duration-200"
                onClick={() => handleClick(entry)}
              >
                <CardContent className="p-4 space-y-2.5">
                  {/* Row 1: title + date + delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-semibold text-sm">{entry.projectName || 'Untitled'}</p>
                      {entry.tagNumber && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                          {entry.tagNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/am/i, 'AM').replace(/pm/i, 'PM')}, {new Date(entry.timestamp).toLocaleDateString('en-MY')}
                      </p>
                      <button
                        onClick={(e) => handleDelete(e, entry.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                        aria-label="Delete estimate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: material specs */}
                  <p className="text-xs text-muted-foreground font-mono">
                    {materialLabel}
                    {shellThickness ? ` ${formatNumber(shellThickness, 2)} mm` : ''}
                    {' · '}OD {formatNumber(entry.od)} mm
                    {' · '}L {formatNumber(entry.shellLength)} mm
                  </p>

                  {/* Row 3: quantities + plates + cost */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip>{vesselQty} {vesselQty === 1 ? 'vessel' : 'vessels'}</Chip>
                      {dishQty > 0 && (
                        <Chip>{dishQty} {dishQty === 1 ? 'dish end' : 'dish ends'}</Chip>
                      )}
                      {shellPlates != null && (
                        <Chip>{shellPlates} {shellPlates === 1 ? 'shell plate' : 'shell plates'}</Chip>
                      )}
                    </div>
                    <p className="font-mono font-bold text-primary text-sm shrink-0">
                      {formatCurrency(entry.grandTotal)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
      {children}
    </span>
  );
}
