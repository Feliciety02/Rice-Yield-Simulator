import { Fragment, useState } from 'react';
import { ArrowDownUp, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ModuleType = 'create' | 'assign' | 'decide' | 'process' | 'record' | 'dispose';

type ModuleStyle = {
  label: string;
  accent: string;
  soft: string;
  shape: 'rounded' | 'rect' | 'diamond';
};

const MODULE_STYLES: Record<ModuleType, ModuleStyle> = {
  create: {
    label: 'Create',
    accent: 'hsl(var(--chart-1))',
    soft: 'hsl(var(--chart-1) / 0.12)',
    shape: 'rounded',
  },
  assign: {
    label: 'Assign',
    accent: 'hsl(var(--chart-2))',
    soft: 'hsl(var(--chart-2) / 0.12)',
    shape: 'rect',
  },
  decide: {
    label: 'Decide',
    accent: 'hsl(var(--warning))',
    soft: 'hsl(var(--warning) / 0.12)',
    shape: 'diamond',
  },
  process: {
    label: 'Process',
    accent: 'hsl(var(--chart-3))',
    soft: 'hsl(var(--chart-3) / 0.12)',
    shape: 'rect',
  },
  record: {
    label: 'Record',
    accent: 'hsl(var(--chart-4))',
    soft: 'hsl(var(--chart-4) / 0.12)',
    shape: 'rounded',
  },
  dispose: {
    label: 'Dispose',
    accent: 'hsl(var(--muted-foreground))',
    soft: 'hsl(var(--muted-foreground) / 0.12)',
    shape: 'rounded',
  },
};

const modules = [
  {
    id: 1,
    label: 'Create Crop Cycle',
    type: 'create',
    desc: 'Initialize a new 120-day crop cycle and start date',
  },
  {
    id: 2,
    label: 'Assign Parameters',
    type: 'assign',
    desc: 'Set irrigation, ENSO, planting month',
  },
  {
    id: 3,
    label: 'Decide Season',
    shortLabel: 'Season?',
    type: 'decide',
    desc: 'Dry / Wet / Transition based on start month',
  },
  {
    id: 4,
    label: 'Process Growing Period',
    type: 'process',
    desc: [
      'Sample weather daily',
      'Assign severity if typhoon',
      'Accumulate weather mix',
    ],
  },
  {
    id: 5,
    label: 'Assign Yield',
    type: 'assign',
    desc: 'Average daily base + irrigation + ENSO',
  },
  {
    id: 6,
    label: 'Add Noise',
    type: 'assign',
    desc: 'Apply Normal(0, 0.2) random variation',
  },
  {
    id: 7,
    label: 'Record Yield and Failure Flag',
    type: 'record',
    desc: 'Store final yield, ensure >= 0, flag low yield',
  },
  {
    id: 8,
    label: 'Dispose',
    type: 'dispose',
    desc: 'Exit entity and finalize cycle record',
  },
] as const;

const FLOW_GRID_STYLE = {
  backgroundImage:
    'linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  backgroundPosition: '-1px -1px',
};

function FlowConnector({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center">
        <div className="w-px h-5 bg-border" />
        <div className="w-2 h-2 border-b border-r border-border rotate-45 -mt-1" />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className="h-px w-8 bg-border" />
      <div className="w-2 h-2 border-b border-r border-border rotate-45 -ml-1" />
    </div>
  );
}

function ArenaModule({
  module,
}: {
  module: {
    id: number;
    label: string;
    shortLabel?: string;
    type: ModuleType;
    desc: string | readonly string[];
  };
}) {
  const style = MODULE_STYLES[module.type];
  const base =
    'px-4 py-2.5 text-[11px] font-semibold text-center border shadow-[0_12px_22px_-18px_hsl(var(--foreground)/0.35)] transition';
  const shapeLabel = module.shortLabel ?? module.label;
  const shapeStyles = {
    backgroundColor: style.soft,
    borderColor: style.accent,
    color: 'hsl(var(--foreground))',
  };

  const shape =
    style.shape === 'diamond' ? (
      <div className="flex justify-center">
        <div
          className={`${base} text-[10px] leading-tight`}
          style={{
            ...shapeStyles,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            width: 150,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <span className="px-3">{shapeLabel}</span>
        </div>
      </div>
    ) : style.shape === 'rounded' ? (
      <div className={`${base} rounded-full min-w-[170px] max-w-[200px]`} style={shapeStyles}>
        {shapeLabel}
      </div>
    ) : (
      <div className={`${base} rounded-2xl min-w-[170px] max-w-[200px]`} style={shapeStyles}>
        {shapeLabel}
      </div>
    );

  return (
    <div className="flex flex-col items-center w-[210px]">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: style.accent }}
      >
        {style.label}
      </div>
      <div className="relative mt-2">
        <span
          className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-card text-[10px] font-semibold text-foreground ring-1 ring-border flex items-center justify-center"
          style={{ boxShadow: `0 6px 14px -10px ${style.accent}` }}
        >
          {module.id}
        </span>
        {shape}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2 max-w-[190px] text-center space-y-0.5">
        {Array.isArray(module.desc) ? (
          module.desc.map((line) => (
            <div key={line}>- {line}</div>
          ))
        ) : (
          <div>{module.desc}</div>
        )}
      </div>
    </div>
  );
}

function LegendShape({ type }: { type: ModuleType }) {
  const style = MODULE_STYLES[type];
  const shapeStyles = {
    backgroundColor: style.soft,
    borderColor: style.accent,
  };

  if (style.shape === 'diamond') {
    return (
      <div
        className="w-8 h-6 border"
        style={{
          ...shapeStyles,
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }}
      />
    );
  }

  if (style.shape === 'rounded') {
    return <div className="w-8 h-6 rounded-full border" style={shapeStyles} />;
  }

  return <div className="w-8 h-6 rounded-lg border" style={shapeStyles} />;
}

export default function ModelFlowTab() {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const isHorizontal = layout === 'horizontal';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-1 mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Simulation Model Flow</h2>
        <p className="text-sm text-muted-foreground">
          Arena-style module flow for the rice yield simulator
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-35" style={FLOW_GRID_STYLE} />
        <div className="relative">
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
            <div className="flex flex-col items-center gap-2">
              {modules.map((module, i) => (
                <div key={module.id} className="flex flex-col items-center">
                  <ArenaModule module={module} />
                  {i < modules.length - 1 && <FlowConnector orientation="vertical" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto pb-2 no-scrollbar">
              <div className="flex items-start gap-5 min-w-max">
                {modules.map((module, i) => (
                  <Fragment key={module.id}>
                    <ArenaModule module={module} />
                    {i < modules.length - 1 && <FlowConnector orientation="horizontal" />}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-semibold text-foreground mb-3">Legend</div>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          {(Object.keys(MODULE_STYLES) as ModuleType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <LegendShape type={type} />
              <span>{MODULE_STYLES[type].label} module</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <div className="h-px w-6 bg-border" />
              <div className="w-2 h-2 border-b border-r border-border rotate-45 -ml-1" />
            </div>
            <span>Entity flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
