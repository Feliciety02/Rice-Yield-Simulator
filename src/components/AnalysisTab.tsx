import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, CloudRain, Leaf, Tornado, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ChartLegend from './ChartLegend';
import { useSimulationStore } from '@/store/simulationStore';
import {
  BASE_YIELDS,
  DEFAULT_DAYS_PER_CYCLE,
  ENSO_ADJ,
  HIGH_YIELD_THRESHOLD,
  IRRIGATION_ADJ,
  LOW_YIELD_THRESHOLD,
  NOISE_SD,
  SACKS_PER_TON,
  TYPHOON_YIELDS,
  getSeason,
  getWeatherWeights,
  getTyphoonSeverityWeights,
  runSimulation,
  ENSOState,
  IrrigationType,
  TyphoonSeverity,
  WeatherType,
} from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: 'hsl(var(--weather-dry))',
  Normal: 'hsl(var(--weather-normal))',
  Wet: 'hsl(var(--weather-wet))',
  Typhoon: 'hsl(var(--weather-typhoon))',
};

const TYPHOON_SEVERITY_COLORS: Record<TyphoonSeverity, string> = {
  Moderate: 'hsl(var(--warning))',
  Severe: 'hsl(var(--destructive))',
};

const SCENARIO_COLORS = {
  low: 'hsl(var(--chart-5))',
  mid: 'hsl(var(--warning))',
  high: 'hsl(var(--chart-3))',
};

const CARD_CLASS = 'rounded-2xl border-0 ring-1 ring-border/70 shadow-[0_20px_45px_-30px_hsl(var(--primary)/0.45)] bg-card/95';

const DEFAULT_SCENARIO_SAMPLE_SIZE = 300;
const SCENARIO_SAMPLE_OPTIONS = [100, 300, 500] as const;


const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--ring-soft))',
  borderRadius: 12,
  fontFamily: 'Poppins, sans-serif',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};


const ENSO_ADJ: Record<ENSOState, number> = {
  'El Niño': -0.4,
  Neutral: 0,
  'La Niña': 0.3,
};

const NOISE_SD = 0.2;

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

type ScenarioCycleGroup = { label: string; yields: number[] };
type ScenarioCycles = {
  irrigationData: ScenarioCycleGroup[];
  ensoData: ScenarioCycleGroup[];
  typhoonData: ScenarioCycleGroup[];
};

function scheduleIdle(work: () => void) {
  if (typeof window === 'undefined') {
    work();
    return () => {};
  }
  const anyWindow = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (anyWindow.requestIdleCallback) {
    const id = anyWindow.requestIdleCallback(work, { timeout: 350 });
    return () => anyWindow.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, 0);
  return () => window.clearTimeout(id);
}

function buildScenarioCycles(args: {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;
  numCycles: number;
  daysPerCycle?: number;
  seedSalt: number;
}): ScenarioCycles {
  const baseParams = {
    plantingMonth: args.plantingMonth,
    irrigationType: args.irrigationType,
    ensoState: args.ensoState,
    typhoonProbability: args.typhoonProbability,
    numCycles: args.numCycles,
    daysPerCycle: args.daysPerCycle,
  };

  const buildScenario = (label: string, overrides: Partial<typeof baseParams>) => {
    const seed = hashSeed(JSON.stringify({ ...baseParams, ...overrides, label, seed: args.seedSalt }));
    const result = runSimulation({ ...baseParams, ...overrides, seed });
    return {
      label,
      yields: result.cycles.map((cycle) => cycle.finalYield),
    };
  };

  const irrigationData = [
    buildScenario('Irrigated', { irrigationType: 'Irrigated' }),
    buildScenario('Rainfed', { irrigationType: 'Rainfed' }),
  ];

  const ensoData = [
    buildScenario('El Niño', { ensoState: 'El Niño' }),
    buildScenario('Neutral', { ensoState: 'Neutral' }),
    buildScenario('La Niña', { ensoState: 'La Niña' }),
  ];

  const typhoonScenarios = [
    { label: '5% Prob', value: 5 },
    { label: `${args.typhoonProbability}% (Current)`, value: args.typhoonProbability },
    { label: '35% Prob', value: 35 },
  ];
  const typhoonData = typhoonScenarios.map((scenario) =>
    buildScenario(scenario.label, { typhoonProbability: scenario.value })
  );

  return { irrigationData, ensoData, typhoonData };
}

function parseDateOnly(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function monthForDay(startMonth: number, dayIndex: number) {
  const date = new Date(2020, startMonth - 1, 1);
  date.setDate(date.getDate() + dayIndex);
  return date.getMonth() + 1;
}

function expectedYield(params: {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;
  daysPerCycle?: number;
}) {
  const days = params.daysPerCycle ?? DEFAULT_DAYS_PER_CYCLE;
  const severity = getTyphoonSeverityWeights();
  let baseSum = 0;
  for (let d = 0; d < days; d++) {
    const month = monthForDay(params.plantingMonth, d);
    const weights = getWeatherWeights(month, params.typhoonProbability / 100);
    const typhoonExpected =
      weights.Typhoon * (
        TYPHOON_YIELDS.Moderate * severity.Moderate +
        TYPHOON_YIELDS.Severe * severity.Severe
      );
    const dailyBase =
      BASE_YIELDS.Dry * weights.Dry +
      BASE_YIELDS.Normal * weights.Normal +
      BASE_YIELDS.Wet * weights.Wet +
      typhoonExpected;
    baseSum += dailyBase;
  }
  const base = days > 0 ? baseSum / days : 0;
  const adj = IRRIGATION_ADJ[params.irrigationType] + ENSO_ADJ[params.ensoState];
  return Math.max(0, base + adj);
}

function YieldModelMiniCard({
  title,
  icon,
  unit,
  children,
  footer,
}: {
  title: string;
  icon: ReactNode;
  unit?: string;
  children: ReactNode;
  footer?: string;
}) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-border/60 bg-surface/80 shadow-none">
      <CardContent className="p-4 space-y-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {icon}
            </div>
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </div>
          </div>
          {unit && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {children}
        {footer && (
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YieldCalculationCard({
  irrigationType,
  ensoState,
  isFarmer,
}: {
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  isFarmer: boolean;
}) {
  const formatValue = (value: number) => value.toFixed(1);
  const formatSigned = (value: number) => (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));
  const baseRows: { label: WeatherType; value: number }[] = [
    { label: 'Dry', value: BASE_YIELDS.Dry },
    { label: 'Normal', value: BASE_YIELDS.Normal },
    { label: 'Wet', value: BASE_YIELDS.Wet },
    { label: 'Typhoon', value: BASE_YIELDS.Typhoon },
  ];
  const typhoonRows: { label: TyphoonSeverity; value: number }[] = [
    { label: 'Moderate', value: TYPHOON_YIELDS.Moderate },
    { label: 'Severe', value: TYPHOON_YIELDS.Severe },
  ];
  const irrigationRows: { label: IrrigationType; value: number }[] = [
    { label: 'Irrigated', value: IRRIGATION_ADJ.Irrigated },
    { label: 'Rainfed', value: IRRIGATION_ADJ.Rainfed },
  ];
  const ensoRows: { label: ENSOState; value: number }[] = [
    { label: 'El Niño', value: ENSO_ADJ['El Niño'] },
    { label: 'Neutral', value: ENSO_ADJ.Neutral },
    { label: 'La Niña', value: ENSO_ADJ['La Niña'] },
  ];

  const renderAdjustmentRow = (label: string, value: number, active: boolean) => {
    const valueTone =
      value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : 'text-muted-foreground';
    return (
      <div
        key={label}
        className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
          active
            ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
            : 'text-muted-foreground'
        }`}
      >
        <span className="flex items-center gap-2">
          {label}
          {active && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              Selected
            </span>
          )}
        </span>
        <span className={`font-semibold ${valueTone}`}>{formatSigned(value)}</span>
      </div>
    );
  };

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Yield Calculation
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">Model constants</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="rounded-2xl bg-primary/5 ring-1 ring-primary/20 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Yield Determination Model
          </div>
          <div
            className="mt-2 text-base md:text-lg font-semibold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Final yield = max(0, base + adjustments + noise)
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Base yield comes from the daily weather mix. Adjustments apply irrigation and ENSO effects.
          </div>
        {isFarmer && (
          <div className="text-[11px] text-muted-foreground mt-2">
            Values shown in t/ha ({SACKS_PER_TON} sacks = 1 t/ha).
          </div>
        )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <YieldModelMiniCard title="Base Yields" icon={<Leaf className="w-4 h-4" />} unit="t/ha">
            <div className="space-y-1 text-xs">
              {baseRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg px-2 py-1 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: WEATHER_COLORS[row.label] }}
                    />
                    {row.label}
                  </span>
                  <span className="font-semibold text-foreground">{formatValue(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Typhoon base is a fallback when severity is unclassified; severity yields override on typhoon days.
            </div>
          </YieldModelMiniCard>

          <YieldModelMiniCard
            title="Typhoon Severity"
            icon={<Tornado className="w-4 h-4" />}
            unit="t/ha"
            footer="Severity overrides generic typhoon base yield when applicable."
          >
            <div className="space-y-1 text-xs">
              {typhoonRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg px-2 py-1 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: TYPHOON_SEVERITY_COLORS[row.label] }}
                    />
                    {row.label}
                  </span>
                  <span className={`font-semibold ${row.label === 'Severe' ? 'text-destructive' : 'text-warning'}`}>
                    {formatValue(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </YieldModelMiniCard>

          <YieldModelMiniCard title="Adjustments" icon={<Layers className="w-4 h-4" />} unit="t/ha">
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Irrigation</div>
                <div className="space-y-1">
                  {irrigationRows.map((row) => renderAdjustmentRow(row.label, row.value, row.label === irrigationType))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ENSO</div>
                <div className="space-y-1">
                  {ensoRows.map((row) => renderAdjustmentRow(row.label, row.value, row.label === ensoState))}
                </div>
              </div>
            </div>
          </YieldModelMiniCard>

          <YieldModelMiniCard title="Stochastic Noise" icon={<Sparkles className="w-4 h-4" />}>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="h-14 flex items-center justify-center">
                <svg viewBox="0 0 120 50" className="w-full h-12" aria-hidden="true">
                  <path
                    d="M2 46 C 20 46, 24 16, 60 10 C 96 16, 100 46, 118 46"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                  />
                  <line x1="2" y1="46" x2="118" y2="46" stroke="hsl(var(--border))" strokeWidth="1" />
                </svg>
              </div>
              <div className="text-center font-semibold text-foreground">
                Normal(0, {NOISE_SD.toFixed(1)})
              </div>
              <div className="text-center text-[11px] text-muted-foreground">
                Added to deterministic yield
              </div>
            </div>
          </YieldModelMiniCard>
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({
  title,
  icon,
  data,
  caption,
}: {
  title: string;
  icon: ReactNode;
  data: { label: string; low: number; mid: number; high: number }[];
  caption?: string;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </CardTitle>
            {caption && <div className="text-[11px] text-muted-foreground">{caption}</div>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ring-soft))" />
            <XAxis dataKey="label" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis
              domain={[0, 100]}
              fontSize={10}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value: number) => `${value}%`}
              label={{
                value: 'Probability (%)',
                angle: -90,
                position: 'insideLeft',
                offset: 6,
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
              }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
            <Bar dataKey="low" stackId="a" fill={SCENARIO_COLORS.low} isAnimationActive={false} />
            <Bar dataKey="mid" stackId="a" fill={SCENARIO_COLORS.mid} isAnimationActive={false} />
            <Bar dataKey="high" stackId="a" fill={SCENARIO_COLORS.high} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function AnalysisTab() {
  const { snap, viewMode } = useSimulationStore();
  const { params, runningMean, lowYieldProb, summary, cycleRecords, cycleStartDate } = snap;
  const isFarmer = viewMode === 'farmer';

  const cycleStartMonth = useMemo(() => parseDateOnly(cycleStartDate).getMonth() + 1, [cycleStartDate]);
  const baseParams = useMemo(() => ({ ...params, plantingMonth: cycleStartMonth }), [params, cycleStartMonth]);
  const modelBaseline = useMemo(() => expectedYield(baseParams), [baseParams]);
  const baseline = runningMean > 0 ? runningMean : modelBaseline;
  const calibration = modelBaseline > 0 ? baseline / modelBaseline : 1;
  const formatYieldValue = (value: number) =>
    isFarmer ? `${Math.round(value * SACKS_PER_TON)} sacks` : `${value.toFixed(2)} t/ha`;
  const formatYieldRange = (low: number, high: number) =>
    isFarmer
      ? `${Math.round(low * SACKS_PER_TON)} to ${Math.round(high * SACKS_PER_TON)} sacks`
      : `${low.toFixed(2)} to ${high.toFixed(2)} t/ha`;
  const toSacks = (value: number) => Math.round(value * SACKS_PER_TON);
  const [scenarioSamples, setScenarioSamples] = useState(DEFAULT_SCENARIO_SAMPLE_SIZE);
  const [scenarioSeedSalt, setScenarioSeedSalt] = useState(0);
  const [scenarioStatus, setScenarioStatus] = useState<'ready' | 'updating'>('ready');
  const scenarioTierLabel = isFarmer
    ? `Tiers: Low < ${toSacks(LOW_YIELD_THRESHOLD)} sacks (<${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha), Mid ${toSacks(LOW_YIELD_THRESHOLD)}-${toSacks(HIGH_YIELD_THRESHOLD)} sacks (${LOW_YIELD_THRESHOLD.toFixed(1)}-${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha), High > ${toSacks(HIGH_YIELD_THRESHOLD)} sacks (>${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha)`
    : `Tiers: Low < ${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha, Mid ${LOW_YIELD_THRESHOLD.toFixed(1)}-${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha, High > ${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha`;
  const scenarioMetaLabel = `Sample: ${scenarioSamples} cycles | Calibrated to baseline | Cycle start month ${cycleStartMonth}`;
  const scenarioLegendItems = useMemo(() => ([
    { label: 'Low', color: SCENARIO_COLORS.low, variant: 'fill' as const },
    { label: 'Mid', color: SCENARIO_COLORS.mid, variant: 'fill' as const },
    { label: 'High', color: SCENARIO_COLORS.high, variant: 'fill' as const },
  ]), []);

  const irrigationData = useMemo(() => {
    const currentAdj = IRRIGATION_ADJ[params.irrigationType];
    const irrigated = baseline + (IRRIGATION_ADJ.Irrigated - currentAdj);
    const rainfed = baseline + (IRRIGATION_ADJ.Rainfed - currentAdj);
    return [{
      category: 'Yield (t/ha)',
      Irrigated: Number(irrigated.toFixed(2)),
      Rainfed: Number(rainfed.toFixed(2)),
    }];
  }, [baseline, params.irrigationType]);
  const irrigationNumbers = irrigationData[0];

  const ensoData = useMemo(() => {
    const currentAdj = ENSO_ADJ[params.ensoState];
    return [{
      category: 'Yield (t/ha)',
      'El Niño': Number((baseline + (ENSO_ADJ['El Niño'] - currentAdj)).toFixed(2)),
      Neutral: Number((baseline + (ENSO_ADJ.Neutral - currentAdj)).toFixed(2)),
      'La Niña': Number((baseline + (ENSO_ADJ['La Niña'] - currentAdj)).toFixed(2)),
    }];
  }, [baseline, params.ensoState]);
  const ensoNumbers = ensoData[0];

  const typhoonData = useMemo(() => {
    const common = {
      plantingMonth: baseParams.plantingMonth,
      irrigationType: params.irrigationType,
      ensoState: params.ensoState,
      daysPerCycle: params.daysPerCycle,
    };
    const low = expectedYield({ ...common, typhoonProbability: 5 }) * calibration;
    const mid = expectedYield({ ...common, typhoonProbability: params.typhoonProbability }) * calibration;
    const high = expectedYield({ ...common, typhoonProbability: 35 }) * calibration;
    return [{
      category: 'Yield (t/ha)',
      'Low (5%)': Number(low.toFixed(2)),
      'Mid (current)': Number(mid.toFixed(2)),
      'High (35%)': Number(high.toFixed(2)),
    }];
  }, [
    baseParams.plantingMonth,
    calibration,
    params.daysPerCycle,
    params.ensoState,
    params.irrigationType,
    params.typhoonProbability,
  ]);
  const typhoonNumbers = typhoonData[0];

  const interpretation = useMemo(() => {
    const riskPct = (lowYieldProb * 100).toFixed(1);
    const riskBand = lowYieldProb > 0.30 ? 'High' : lowYieldProb > 0.15 ? 'Moderate' : 'Low';
    const irrigationDelta = Math.abs(IRRIGATION_ADJ.Irrigated - IRRIGATION_ADJ.Rainfed);
    const irrigationSacks = Math.round(irrigationDelta * SACKS_PER_TON);
    const ensoValues = Object.values(ENSO_ADJ);
    const ensoMin = Math.min(...ensoValues);
    const ensoMax = Math.max(...ensoValues);
    const formatSigned = (value: number) => (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));
    return {
      headline: `Risk Band: ${riskBand} (${riskPct}%)`,
      note: 'Scenario comparisons summarize how irrigation, ENSO, and typhoon probability shift outcomes under the current inputs.',
      takeaways: [
        `Irrigation shifts yield by about ${irrigationDelta.toFixed(1)} t/ha (around ${irrigationSacks} sacks) compared to rainfed conditions.`,
        `ENSO state changes yield by ${formatSigned(ensoMin)} to ${formatSigned(ensoMax)} t/ha across scenarios.`,
        `Typhoon probability has the strongest sensitivity. Higher storm rates reduce expected yield the most.`,
      ],
    };
  }, [lowYieldProb]);

  const mcTotals = useMemo(() => {
    const total = cycleRecords.length;
    if (total === 0) {
      return { total, low: 0, mid: 0, high: 0 };
    }
    let low = 0;
    let mid = 0;
    let high = 0;
    cycleRecords.forEach((r) => {
      if (r.yieldTons < LOW_YIELD_THRESHOLD) low++;
      else if (r.yieldTons <= HIGH_YIELD_THRESHOLD) mid++;
      else high++;
    });
    return { total, low, mid, high };
  }, [cycleRecords]);

  const mcPercents = useMemo(() => {
    if (mcTotals.total === 0) return null;
    return {
      low: (mcTotals.low / mcTotals.total) * 100,
      mid: (mcTotals.mid / mcTotals.total) * 100,
      high: (mcTotals.high / mcTotals.total) * 100,
    };
  }, [mcTotals]);

  const mcLabels = isFarmer
    ? {
        low: `Low (<${toSacks(LOW_YIELD_THRESHOLD)} sacks)`,
        mid: `Moderate (${toSacks(LOW_YIELD_THRESHOLD)}-${toSacks(HIGH_YIELD_THRESHOLD)} sacks)`,
        high: `High (>${toSacks(HIGH_YIELD_THRESHOLD)} sacks)`,
      }
    : {
        low: `Low (<${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
        mid: `Moderate (${LOW_YIELD_THRESHOLD.toFixed(1)}-${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
        high: `High (>${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
      };

  const mcData = useMemo(() => {
    const { total, low, mid, high } = mcTotals;
    if (total === 0) {
      return [{ name: 'Chance', Low: 0, Moderate: 0, High: 0 }];
    }
    const toPct = (v: number) => Number(((v / total) * 100).toFixed(1));
    return [{
      name: 'Chance',
      Low: toPct(low),
      Moderate: toPct(mid),
      High: toPct(high),
    }];
  }, [mcTotals]);

  const mcRange = useMemo(() => {
    if (summary) {
      return {
        p5: summary.percentile5,
        p95: summary.percentile95,
        mean: summary.mean,
      };
    }
    if (cycleRecords.length > 0) {
      const sorted = [...cycleRecords.map((r) => r.yieldTons)].sort((a, b) => a - b);
      const n = sorted.length;
      const mean = sorted.reduce((a, b) => a + b, 0) / n;
      return {
        p5: sorted[Math.floor(n * 0.05)] ?? mean,
        p95: sorted[Math.floor(n * 0.95)] ?? mean,
        mean,
      };
    }
    return null;
  }, [summary, cycleRecords]);

  const [scenarioCycles, setScenarioCycles] = useState<ScenarioCycles>(() =>
    buildScenarioCycles({
      plantingMonth: cycleStartMonth,
      irrigationType: params.irrigationType,
      ensoState: params.ensoState,
      typhoonProbability: params.typhoonProbability,
      numCycles: scenarioSamples,
      daysPerCycle: params.daysPerCycle,
      seedSalt: scenarioSeedSalt,
    })
  );

  useEffect(() => {
    let cancelled = false;
    setScenarioStatus('updating');
    const cancel = scheduleIdle(() => {
      if (cancelled) return;
      const next = buildScenarioCycles({
        plantingMonth: cycleStartMonth,
        irrigationType: params.irrigationType,
        ensoState: params.ensoState,
        typhoonProbability: params.typhoonProbability,
        numCycles: scenarioSamples,
        daysPerCycle: params.daysPerCycle,
        seedSalt: scenarioSeedSalt,
      });
      if (cancelled) return;
      setScenarioCycles(next);
      setScenarioStatus('ready');
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [
    cycleStartMonth,
    params.daysPerCycle,
    params.ensoState,
    params.irrigationType,
    params.typhoonProbability,
    scenarioSamples,
    scenarioSeedSalt,
  ]);

  const scenarioAnalysis = useMemo(() => {
    const toPercent = (value: number, total: number) =>
      total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

    const summarize = (scenario: { label: string; yields: number[] }) => {
      const totals = { low: 0, mid: 0, high: 0 };
      scenario.yields.forEach((yieldValue) => {
        const calibratedYield = yieldValue * calibration;
        if (calibratedYield < LOW_YIELD_THRESHOLD) {
          totals.low += 1;
        } else if (calibratedYield < HIGH_YIELD_THRESHOLD) {
          totals.mid += 1;
        } else {
          totals.high += 1;
        }
      });
      const totalCycles = scenario.yields.length || 1;
      return {
        label: scenario.label,
        low: toPercent(totals.low, totalCycles),
        mid: toPercent(totals.mid, totalCycles),
        high: toPercent(totals.high, totalCycles),
      };
    };

    return {
      irrigationData: scenarioCycles.irrigationData.map(summarize),
      ensoData: scenarioCycles.ensoData.map(summarize),
      typhoonData: scenarioCycles.typhoonData.map(summarize),
    };
  }, [calibration, scenarioCycles]);

  const handleExport = useCallback(() => {
    const csvEscape = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const empty = (count: number) => Array.from({ length: count }, () => '');
    const normalizeRow = (cells: (string | number)[], width: number) => {
      const normalized = cells.map((cell) => (cell == null ? '' : String(cell)));
      return [...normalized, ...empty(width - normalized.length)];
    };
    type SectionBlock = { width: number; rows: string[][] };
    const sections: SectionBlock[] = [];
    const appendSection = (
      title: string,
      interpretationText: string,
      conclusionText: string,
      recommendationText: string,
      headers: string[],
      dataRows: (string | number)[][]
    ) => {
      const width = Math.max(
        1,
        headers.length,
        ...dataRows.map((row) => row.length),
        interpretationText ? 2 : 1,
        conclusionText ? 2 : 1,
        recommendationText ? 2 : 1
      );
      const sectionRows: string[][] = [];
      sectionRows.push([`=== ${title} ===`, ...empty(width - 1)]);
      if (interpretationText) {
        sectionRows.push(normalizeRow(['Interpretation', interpretationText], width));
      }
      if (headers.length > 0) {
        sectionRows.push(normalizeRow(headers, width));
      }
      dataRows.forEach((row) => sectionRows.push(normalizeRow(row, width)));
      if (conclusionText) {
        sectionRows.push(normalizeRow(['Conclusion', conclusionText], width));
      }
      if (recommendationText) {
        sectionRows.push(normalizeRow(['Recommendation', recommendationText], width));
      }
      sectionRows.push(empty(width));
      sections.push({ width, rows: sectionRows });
    };

    const bucketLabels = {
      low: {
        tHa: `Low (<${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
        sacks: `Low (<${toSacks(LOW_YIELD_THRESHOLD)} sacks)`,
      },
      mid: {
        tHa: `Moderate (${LOW_YIELD_THRESHOLD.toFixed(1)}-${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
        sacks: `Moderate (${toSacks(LOW_YIELD_THRESHOLD)}-${toSacks(HIGH_YIELD_THRESHOLD)} sacks)`,
      },
      high: {
        tHa: `High (>${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha)`,
        sacks: `High (>${toSacks(HIGH_YIELD_THRESHOLD)} sacks)`,
      },
    };
    const riskPct = (lowYieldProb * 100).toFixed(1);
    const riskOutOf = Math.round(lowYieldProb * 100);
    const sampleDays = params.daysPerCycle ?? DEFAULT_DAYS_PER_CYCLE;
    const lowThresholdLabel = `${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha (${toSacks(LOW_YIELD_THRESHOLD)} sacks)`;
    const baselineInterpretation =
      `${interpretation.headline}. This table summarizes your current baseline yield under the selected season, irrigation, ENSO, and typhoon probability. ` +
      `Baseline yield is the best single-number expectation for a ${sampleDays}-day crop cycle, while the model baseline is the climate estimate before calibration. ` +
      `Low-yield risk shows how often harvest could fall below ${lowThresholdLabel}.`;
    const baselineConclusion =
      'Use the baseline as your planning anchor; if low-yield risk is high, build buffers in budget, inputs, or timing.';
    const baselineRecommendation =
      'Set a target yield near the baseline, prepare a low-yield contingency plan, and confirm input timing based on the cycle start month.';
    const irrigationInterpretation =
      'This table compares expected yield when only irrigation changes. The gap between irrigated and rainfed is the estimated gain from reliable water access. ' +
      'The sacks column shows the harvest difference in farmer-friendly units.';
    const irrigationConclusion =
      'If the irrigated gap is large, prioritize water access, scheduling, or moisture conservation to protect yield.';
    const irrigationRecommendation =
      'If you are rainfed, prioritize water-saving practices, field leveling, and backup water sources; if irrigated, schedule water at critical growth stages.';
    const ensoInterpretation =
      'This table shows how El Nino, Neutral, and La Nina phases shift yield with all other inputs held constant. ' +
      'El Nino typically reduces yield from drier conditions, while La Nina can raise yields with more rainfall. ' +
      'Use this when seasonal forecasts change.';
    const ensoConclusion =
      'When an El Nino outlook appears, plan more conservative inputs and water management; La Nina may allow higher targets.';
    const ensoRecommendation =
      'Follow seasonal forecasts: prepare drought mitigation for El Nino, improve drainage and pest scouting for La Nina, and maintain balanced inputs for Neutral.';
    const typhoonInterpretation =
      'This table keeps all inputs constant and changes only typhoon probability. It highlights how storm risk can depress yields even with good irrigation. ' +
      'Compare low, current, and high scenarios to understand downside exposure.';
    const typhoonConclusion =
      'If higher storm probability sharply lowers yield, invest in drainage, storm protection, and risk financing.';
    const typhoonRecommendation =
      'Strengthen bunds and drainage, secure crop insurance if available, and schedule planting to avoid peak storm months when feasible.';
    const mcBucketInterpretation =
      'This table summarizes completed cycles into low, moderate, and high yield buckets. Percent is the share of cycles in each bucket and count is how many seasons produced that outcome. ' +
      'It helps you judge how often poor or strong harvests occur.';
    const mcBucketConclusion =
      'A larger low bucket means higher downside risk; plan conservative cash flow or stagger plantings.';
    const mcBucketRecommendation =
      'If low outcomes dominate, reduce input exposure, diversify timing, and focus on risk-reducing practices before chasing higher yields.';
    const mcRangeInterpretation =
      'P5-P95 is the likely yield range from completed cycles; most seasons should fall inside. The mean is the average across cycles, and wider ranges mean more uncertainty.';
    const mcRangeConclusion =
      'Use P5 as a worst-case planning point and keep targets near the mean rather than the top end.';
    const mcRangeRecommendation =
      'Budget using the P5 value, set sales targets near the mean, and revisit plans if the range widens after more cycles.';
    const plainLanguageInterpretation =
      'This section explains the terms in simple language so farmers and field teams can discuss results consistently. ' +
      'It links technical metrics to practical decisions like expected sacks and risk levels.';
    const plainLanguageConclusion =
      'Use these definitions when sharing results with partners, cooperatives, or lenders.';
    const plainLanguageRecommendation =
      'Share this section in meetings so everyone uses the same meaning for risk, ranges, and yield targets.';
    const calibratedInterpretation =
      `${interpretation.note} The takeaways below are calibrated to the current baseline so comparisons stay realistic for the current season.`;
    const calibratedConclusion =
      'Focus on the takeaways with the biggest yield shifts; those are the strongest levers for planning.';
    const calibratedRecommendation =
      'Pick one or two highest-impact levers (irrigation, storm risk, or ENSO planning) and plan concrete actions before the next cycle.';

    appendSection(
      'Baseline Snapshot',
      baselineInterpretation,
      baselineConclusion,
      baselineRecommendation,
      ['Metric', 'Value (t/ha)', 'Value (sacks)', 'Notes'],
      [
        ['Baseline Yield', baseline.toFixed(4), toSacks(baseline), 'Average from live simulation or model if no cycles yet.'],
        ['Model Baseline Yield', modelBaseline.toFixed(4), toSacks(modelBaseline), 'Estimated from seasonal weights and adjustments.'],
        ['Calibration Factor', calibration.toFixed(4), '', 'Scenario results are scaled by this factor.'],
        ['Low Yield Risk (%)', (lowYieldProb * 100).toFixed(2), '', `Chance of falling below ${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha.`],
        ['Season', getSeason(cycleStartMonth), '', 'Season of the cycle start month.'],
        ['Cycle Start Month', cycleStartMonth, '', `Cycle length: ${sampleDays} days.`],
        ['Irrigation Type', params.irrigationType, '', 'Current irrigation setting.'],
        ['ENSO State', params.ensoState, '', 'Current ENSO setting.'],
        ['Typhoon Probability (%)', params.typhoonProbability.toFixed(1), '', 'Input typhoon rate.'],
      ]
    );

    appendSection(
      'Irrigation Comparison',
      irrigationInterpretation,
      irrigationConclusion,
      irrigationRecommendation,
      ['Scenario', 'Yield (t/ha)', 'Yield (sacks)', 'Notes'],
      [
        ['Irrigated', irrigationNumbers.Irrigated.toFixed(2), toSacks(irrigationNumbers.Irrigated), 'Calibrated to baseline.'],
        ['Rainfed', irrigationNumbers.Rainfed.toFixed(2), toSacks(irrigationNumbers.Rainfed), 'Calibrated to baseline.'],
      ]
    );

    appendSection(
      'ENSO Comparison',
      ensoInterpretation,
      ensoConclusion,
      ensoRecommendation,
      ['Scenario', 'Yield (t/ha)', 'Yield (sacks)', 'Notes'],
      [
        ['El Niño', ensoNumbers['El Niño'].toFixed(2), toSacks(ensoNumbers['El Niño']), 'Calibrated to baseline.'],
        ['Neutral', ensoNumbers.Neutral.toFixed(2), toSacks(ensoNumbers.Neutral), 'Calibrated to baseline.'],
        ['La Niña', ensoNumbers['La Niña'].toFixed(2), toSacks(ensoNumbers['La Niña']), 'Calibrated to baseline.'],
      ]
    );

    appendSection(
      'Typhoon Sensitivity',
      typhoonInterpretation,
      typhoonConclusion,
      typhoonRecommendation,
      ['Scenario', 'Yield (t/ha)', 'Yield (sacks)', 'Notes'],
      [
        ['Low (5%)', typhoonNumbers['Low (5%)'].toFixed(2), toSacks(typhoonNumbers['Low (5%)']), 'Calibrated to baseline.'],
        ['Mid (current)', typhoonNumbers['Mid (current)'].toFixed(2), toSacks(typhoonNumbers['Mid (current)']), 'Calibrated to baseline.'],
        ['High (35%)', typhoonNumbers['High (35%)'].toFixed(2), toSacks(typhoonNumbers['High (35%)']), 'Calibrated to baseline.'],
      ]
    );

    const total = mcTotals.total || 1;
    appendSection(
      'Monte Carlo Buckets',
      mcBucketInterpretation,
      mcBucketConclusion,
      mcBucketRecommendation,
      ['Bucket (t/ha)', 'Bucket (sacks)', 'Percent', 'Count', 'Notes'],
      [
        [bucketLabels.low.tHa, bucketLabels.low.sacks, ((mcTotals.low / total) * 100).toFixed(2), mcTotals.low, 'Below the low threshold.'],
        [bucketLabels.mid.tHa, bucketLabels.mid.sacks, ((mcTotals.mid / total) * 100).toFixed(2), mcTotals.mid, 'Between low and high thresholds.'],
        [bucketLabels.high.tHa, bucketLabels.high.sacks, ((mcTotals.high / total) * 100).toFixed(2), mcTotals.high, 'Above the high threshold.'],
      ]
    );

    if (mcRange) {
      appendSection(
        'Monte Carlo Range',
        mcRangeInterpretation,
        mcRangeConclusion,
        mcRangeRecommendation,
        ['Metric', 'Value (t/ha)', 'Value (sacks)', 'Notes'],
        [
          ['P5', mcRange.p5.toFixed(4), toSacks(mcRange.p5), 'Lower bound: only ~5% of cycles fall below this.'],
          ['P95', mcRange.p95.toFixed(4), toSacks(mcRange.p95), 'Upper bound: only ~5% of cycles exceed this.'],
          ['Mean', mcRange.mean.toFixed(4), toSacks(mcRange.mean), 'Average yield across completed cycles.'],
        ]
      );
    }

    appendSection(
      'Plain-Language Interpretation',
      plainLanguageInterpretation,
      plainLanguageConclusion,
      plainLanguageRecommendation,
      ['Topic', 'Explanation'],
      [
        ['Baseline Yield', `Your best single-number estimate under current settings. It blends all simulated days in a ${sampleDays}-day crop cycle.`],
        ['Low-Yield Risk', `A ${riskPct}% risk means about ${riskOutOf} out of 100 seasons could fall below ${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha.`],
        ['Most Likely Range', 'P5–P95 shows where most results fall. Think of it as the “typical” range for a season.'],
        ['Calibration', 'Scenario charts are scaled to match the live simulation baseline, so comparisons stay realistic.'],
        ['Buckets', `Low/Moderate/High are based on ${LOW_YIELD_THRESHOLD.toFixed(1)} and ${HIGH_YIELD_THRESHOLD.toFixed(1)} t/ha thresholds for easy planning.`],
        ['Units', `1 t/ha equals ${SACKS_PER_TON} sacks. Sacks are shown for farmer-friendly reading.`],
        ['Scenario Notes', 'Typhoon probability usually shifts yields more than irrigation or ENSO alone in this model.'],
      ]
    );

    appendSection(
      'Interpretation (Calibrated)',
      calibratedInterpretation,
      calibratedConclusion,
      calibratedRecommendation,
      ['Type', 'Detail'],
      interpretation.takeaways.map((takeaway) => (['Takeaway', takeaway]))
    );

    const sectionsPerFrame = 3;
    const sectionGapColumns = 1;
    const frames: SectionBlock[][] = [];
    for (let i = 0; i < sections.length; i += sectionsPerFrame) {
      frames.push(sections.slice(i, i + sectionsPerFrame));
    }

    const rows: string[][] = [];
    frames.forEach((frame, frameIndex) => {
      const maxRows = Math.max(0, ...frame.map((section) => section.rows.length));
      const frameWidth = frame.reduce(
        (acc, section, index) => acc + section.width + (index > 0 ? sectionGapColumns : 0),
        0
      );

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        const combined: string[] = [];
        frame.forEach((section, sectionIndex) => {
          const sectionRow = section.rows[rowIndex] ?? empty(section.width);
          combined.push(...sectionRow);
          if (sectionIndex < frame.length - 1) {
            combined.push(...empty(sectionGapColumns));
          }
        });
        rows.push(combined);
      }

      if (frameIndex < frames.length - 1) {
        rows.push(empty(frameWidth));
      }
    });

    const csvContent = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href = url;
    a.download = `rice_yield_analysis_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    baseline,
    calibration,
    cycleStartMonth,
    ensoNumbers,
    interpretation,
    irrigationNumbers,
    lowYieldProb,
    mcRange,
    mcTotals,
    modelBaseline,
    params,
    typhoonNumbers,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Live Scenario Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Comparisons update in real time and stay in sync with the Simulation tab.
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          Export Analysis CSV
        </Button>
      </div>

      <YieldCalculationCard
        irrigationType={params.irrigationType}
        ensoState={params.ensoState}
        isFarmer={isFarmer}
      />

      <Card className="border-border">
        <CardHeader>
        <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Baseline Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div>Baseline Yield: <strong>{formatYieldValue(baseline)}</strong></div>
        <div>Model Baseline: <strong>{formatYieldValue(modelBaseline)}</strong></div>
        <div>Calibration Factor: <strong>{calibration.toFixed(2)}x</strong></div>
        <div>Low-Yield Risk: <strong>{(lowYieldProb * 100).toFixed(1)}%</strong></div>
        <div>Season: <strong>{getSeason(cycleStartMonth)}</strong> (Cycle Start Month {cycleStartMonth})</div>
      </CardContent>
    </Card>


      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Monte Carlo Outlook (Live)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {mcRange ? (
            <div className="text-sm text-muted-foreground">
              Most likely range: <strong>{formatYieldRange(mcRange.p5, mcRange.p95)}</strong>.
              Mean so far: <strong>{formatYieldValue(mcRange.mean)}</strong>.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Start the simulation to build the Monte Carlo outlook.
            </div>
          )}
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={mcData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="Low" stackId="mc" fill="hsl(var(--destructive))" radius={[4, 0, 0, 4]} />
              <Bar dataKey="Moderate" stackId="mc" fill="hsl(var(--warning))" />
              <Bar dataKey="High" stackId="mc" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend
            items={[
              { label: mcLabels.low, color: 'hsl(var(--destructive))', variant: 'fill' },
              { label: mcLabels.mid, color: 'hsl(var(--warning))', variant: 'fill' },
              { label: mcLabels.high, color: 'hsl(var(--primary))', variant: 'fill' },
            ]}
          />
          {isFarmer && (
            <div className="text-xs text-muted-foreground">
              Farmer note: This shows the chance of low, moderate, or high harvests based on the live simulation.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div>Low: {mcPercents ? `${mcPercents.low.toFixed(1)}%` : '---'} ({mcTotals.low} cycles)</div>
            <div>Moderate: {mcPercents ? `${mcPercents.mid.toFixed(1)}%` : '---'} ({mcTotals.mid} cycles)</div>
            <div>High: {mcPercents ? `${mcPercents.high.toFixed(1)}%` : '---'} ({mcTotals.high} cycles)</div>
            <div>Total cycles: {mcTotals.total}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Based on {mcTotals.total} completed cycles from the live simulation.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Scenario Analysis
            </div>
            <div className="text-[11px] text-muted-foreground">{scenarioTierLabel}</div>
            <div className="text-[11px] text-muted-foreground">{scenarioMetaLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Samples</span>
            {SCENARIO_SAMPLE_OPTIONS.map((size) => (
              <Button
                key={size}
                size="sm"
                variant={scenarioSamples === size ? 'default' : 'outline'}
                onClick={() => setScenarioSamples(size)}
              >
                {size}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => setScenarioSeedSalt((v) => v + 1)}>
              Reseed
            </Button>
            {scenarioStatus === 'updating' && (
              <span className="text-[10px] text-muted-foreground">Updating...</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ScenarioCard
            title="Irrigated vs Rainfed"
            icon={<CloudRain className="w-4 h-4" />}
            data={scenarioAnalysis.irrigationData}
          />
          <ScenarioCard
            title="ENSO Phases"
            icon={<Activity className="w-4 h-4" />}
            data={scenarioAnalysis.ensoData}
          />
          <ScenarioCard
            title="Typhoon Sensitivity"
            icon={<Tornado className="w-4 h-4" />}
            data={scenarioAnalysis.typhoonData}
          />
        </div>
        <ChartLegend items={scenarioLegendItems} />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Interpretation (Calibrated)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <div className="font-semibold text-foreground">{interpretation.headline}</div>
          <p>{interpretation.note}</p>
          {interpretation.takeaways.map((t) => (
            <p key={t}>- {t}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

