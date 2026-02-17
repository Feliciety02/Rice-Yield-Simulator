import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const steps = [
  { id: 1, label: 'Create Crop Cycle', shape: 'rounded', desc: 'Initialize a new 120-day crop cycle' },
  { id: 2, label: 'Assign Crop Parameters', shape: 'rect', desc: 'Set irrigation type, ENSO state, planting month' },
  { id: 3, label: 'Decide Season', shape: 'diamond', desc: 'June–October → Wet; otherwise → Dry' },
  { id: 4, label: 'Assign Weather State', shape: 'rect', desc: 'Sample from season-specific probability distribution' },
  { id: 5, label: 'Process Growing Period', shape: 'rect', desc: 'Simulate 120-day growth phase' },
  { id: 6, label: 'Decide Weather Type', shape: 'diamond', desc: 'Dry / Normal / Wet / Typhoon' },
  { id: 7, label: 'Assign Yield', shape: 'rect', desc: 'Base yield + irrigation + ENSO adjustments' },
  { id: 8, label: 'Add Noise', shape: 'rect', desc: 'Apply Normal(0, 0.2) random variation' },
  { id: 9, label: 'Record Yield', shape: 'rounded', desc: 'Store final yield, ensure ≥ 0' },
  { id: 10, label: 'Decide Low Yield', shape: 'diamond', desc: 'Check if yield < 2.0 t/ha' },
  { id: 11, label: 'Record Low Yield', shape: 'rounded', desc: 'Flag cycle as crop failure' },
  { id: 12, label: 'Dispose', shape: 'rect', desc: 'End cycle, aggregate statistics' },
];

function ShapeBox({ shape, label, active }: { shape: string; label: string; active?: boolean }) {
  const base = 'px-4 py-2.5 text-sm font-medium text-center border-2 transition-all min-w-[180px]';
  
  if (shape === 'diamond') {
    return (
      <div className="flex justify-center">
        <div
          className={`${base} border-primary bg-primary/10 text-foreground rotate-0`}
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
      <div className={`${base} rounded-full border-accent bg-accent/10 text-foreground`}>
        {label}
      </div>
    );
  }

  return (
    <div className={`${base} rounded-lg border-primary bg-card text-foreground`}>
      {label}
    </div>
  );
}

export default function ModelFlowTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Simulation Model Flow</CardTitle>
          <p className="text-sm text-muted-foreground">
            Arena-style discrete event simulation flowchart for the Philippine Rice Yield model.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center">
                <ShapeBox shape={step.shape} label={step.label} />
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1 max-w-[200px] text-center">
                  {step.desc}
                </p>
                {i < steps.length - 1 && (
                  <div className="w-0.5 h-4 bg-primary/40" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Legend</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded-full border-2 border-accent bg-accent/10" />
            <span className="text-muted-foreground">Terminal / Record</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded border-2 border-primary bg-card" />
            <span className="text-muted-foreground">Process</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-6 border-2 border-primary bg-primary/10"
              style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
            />
            <span className="text-muted-foreground">Decision</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-primary/40" />
            <span className="text-muted-foreground">Flow Arrow</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
