import { Fragment, useState } from 'react';
import { ArrowDownUp, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  { id: 1, label: 'Create Crop Cycle', shape: 'rounded', desc: 'Initialize a new 120-day crop cycle' },
  { id: 2, label: 'Assign Crop Parameters', shape: 'rect', desc: 'Set irrigation, ENSO, planting month' },
  { id: 3, label: 'Blend Season', shape: 'diamond', desc: 'Dry / Wet / Transition based on month' },
  { id: 4, label: 'Assign Weather State', shape: 'rect', desc: 'Sample from normalized seasonal probabilities' },
  { id: 5, label: 'Process Growing Period', shape: 'rect', desc: 'Simulate 120-day growth phase' },
  { id: 6, label: 'Decide Weather Type', shape: 'diamond', desc: 'Dry / Normal / Wet / Typhoon' },
  { id: 7, label: 'If Typhoon, Set Severity', shape: 'diamond', desc: 'Moderate or Severe based on storm intensity' },
  { id: 8, label: 'Assign Yield', shape: 'rect', desc: 'Base yield + irrigation + ENSO + severity' },
  { id: 9, label: 'Add Noise', shape: 'rect', desc: 'Apply Normal(0, 0.2) random variation' },
  { id: 10, label: 'Record Yield', shape: 'rounded', desc: 'Store final yield, ensure >= 0' },
  { id: 11, label: 'Decide Low Yield', shape: 'diamond', desc: 'Check if yield < 2.0 t/ha' },
  { id: 12, label: 'Record Low Yield', shape: 'rounded', desc: 'Flag cycle as crop failure' },
  { id: 13, label: 'Dispose', shape: 'rect', desc: 'End cycle, aggregate statistics' },
];

function ShapeBox({ shape, label }: { shape: string; label: string }) {
  const base = 'px-4 py-2.5 text-sm font-medium text-center border transition-all min-w-[180px]';

  if (shape === 'diamond') {
    return (
      <div className="flex justify-center">
        <div
          className={`${base} border-primary/30 bg-primary/5 text-foreground`}
          style={{
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            width: 160,
            height: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="text-xs font-semibold">{label}</span>
        </div>
      </div>
    );
  }

  if (shape === 'rounded') {
    return (
      <div className={`${base} rounded-full border-primary/25 bg-primary/5 text-foreground`}>
        {label}
      </div>
    );
  }

  return (
    <div className={`${base} rounded-2xl border-border bg-card text-foreground`}>
      {label}
    </div>
  );
}

export default function ModelFlowTab() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const isHorizontal = layout === 'horizontal';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-1 mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Simulation Model Flow</h2>
        <p className="text-sm text-muted-foreground">
          Arena-style discrete event simulation flowchart
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-muted-foreground">Flow Layout</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setLayout((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'))}
            title={isHorizontal ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
            aria-label={isHorizontal ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
          >
            {isHorizontal ? <ArrowDownUp className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
          </Button>
        </div>

        {layout === 'vertical' ? (
          <div className="flex flex-col items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center">
                <ShapeBox shape={step.shape} label={step.label} />
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1 max-w-[200px] text-center">
                  {step.desc}
                </p>
                {i < steps.length - 1 && (
                  <div className="w-px h-4 bg-border" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 no-scrollbar">
            <div className="flex items-center gap-4 min-w-max">
              {steps.map((step, i) => (
                <Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <ShapeBox shape={step.shape} label={step.label} />
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] text-center">
                      {step.desc}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-8 h-px bg-border shrink-0" />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-semibold text-foreground mb-3">Legend</div>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-5 rounded-full border border-primary/25 bg-primary/5" />
            <span>Terminal / Record</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-5 rounded-lg border border-border bg-card" />
            <span>Process</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-5 border border-primary/30 bg-primary/5"
              style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
            />
            <span>Decision</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-px bg-border" />
            <span>Flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
