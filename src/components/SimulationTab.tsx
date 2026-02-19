import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import WeatherScene from './WeatherScene';
import { useSimulation } from '@/context/SimulationContext';
import { IrrigationType, ENSOState } from '@/lib/simulation';
import { useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import MonteCarloPanel from './MonteCarloPanel';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const WEATHER_COLORS: Record<string, string> = {
  Dry: 'hsl(45, 95%, 55%)',
  Normal: 'hsl(200, 60%, 55%)',
  Wet: 'hsl(210, 60%, 50%)',
  Typhoon: 'hsl(0, 72%, 50%)',
};

const SPEED_LABELS: Record<number, string> = {
  0.5: '0.5×', 1: '1×', 2: '2×', 5: '5×', 10: '10×', 20: '20×',
};

// 1 ton/ha = 20 sacks of 50kg
const TONS_TO_SACKS = 20;
const SACK_THRESHOLD_LOW = 40;   // < 40 sacks → red
const SACK_THRESHOLD_MID = 60;   // 40–60 → yellow, > 60 → green

function getSackColor(sacks: number): string {
  if (sacks < SACK_THRESHOLD_LOW) return 'hsl(var(--destructive))';
  if (sacks < SACK_THRESHOLD_MID) return 'hsl(var(--warning))';
  return 'hsl(var(--primary))';
}

function SackIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="14" height="15" rx="3" fill={filled ? color : 'hsl(var(--muted))'} opacity={filled ? 0.9 : 0.3} />
      <path d="M6 5C6 5 6 2 9 2C12 2 12 5 12 5" stroke={filled ? color : 'hsl(var(--muted-foreground))'} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={filled ? 1 : 0.4} />
      <line x1="2" y1="11" x2="16" y2="11" stroke={filled ? 'white' : 'hsl(var(--border))'} strokeWidth="1" opacity={0.4} />
    </svg>
  );
}

function SackConversionPanel({ meanYield, lowYieldProb }: { meanYield: number; lowYieldProb: number }) {
  const sacks = Math.round(meanYield * TONS_TO_SACKS);
  const sackColor = getSackColor(sacks);
  const maxSacks = 100;
  const displaySacks = Math.min(sacks, maxSacks);

  const iconGrid = Array.from({ length: maxSacks }, (_, i) => i < displaySacks);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          🌾 Harvest Equivalent in 50 kg Sacks
        </CardTitle>
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          1 ton/ha = 20 sacks · Formula: Sacks = Yield × 20
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <div className="text-3xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: sackColor }}>
              {sacks} sacks
            </div>
            <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              from {meanYield.toFixed(2)} t/ha average yield
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'hsl(var(--destructive))' }} />
              &lt;40 sacks — Low harvest
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'hsl(var(--warning))' }} />
              40–59 sacks — Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'hsl(var(--primary))' }} />
              60+ sacks — Good harvest
            </span>
          </div>
        </div>

        {/* Visual sack grid — rows of 10 */}
        <div>
          <div className="flex flex-wrap gap-[3px]">
            {iconGrid.map((filled, i) => (
              <SackIcon key={i} filled={filled} color={sackColor} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Each icon = 1 sack (50 kg) · showing up to 100 sacks
            {sacks > 100 && ` · actual: ${sacks} sacks`}
          </p>
        </div>

        {/* Low-yield sack warning */}
        {lowYieldProb > 0 && (
          <div
            className="rounded-lg px-3 py-2 text-xs border"
            style={{
              background: 'hsl(var(--muted))',
              borderColor: 'hsl(var(--border))',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            ⚠️ In <strong>{(lowYieldProb * 100).toFixed(1)}%</strong> of simulated seasons, harvest falls below{' '}
            <strong>{2.0 * TONS_TO_SACKS} sacks</strong> (2.0 t/ha threshold).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FarmerInterpretation({ meanYield, lowYieldProb, typhoonProb, irrigationType }: {
  meanYield: number; lowYieldProb: number; typhoonProb: number; irrigationType: string;
}) {
  const sacks = Math.round(meanYield * TONS_TO_SACKS);
  const riskPct = (lowYieldProb * 100).toFixed(1);
  const riskLevel = lowYieldProb < 0.15 ? 'low' : lowYieldProb < 0.30 ? 'moderate' : 'high';

  const situation =
    `Average harvest is ${meanYield.toFixed(2)} tons per hectare, equivalent to about ${sacks} sacks of 50 kg rice. ` +
    `Low yield risk is ${riskPct} percent under current conditions.`;

  const meaning =
    riskLevel === 'low'
      ? `Under these conditions, about ${riskPct} out of 100 seasons may produce below 40 sacks. Harvest is relatively stable and favorable.`
      : riskLevel === 'moderate'
      ? `About ${riskPct} out of 100 seasons may result in low harvest. There is noticeable risk that needs monitoring, especially during typhoon season.`
      : `A high risk of low harvest — about ${riskPct} out of 100 seasons may fall below 40 sacks. Immediate attention to farm practices is recommended.`;

  const action =
    typhoonProb > 25
      ? 'Typhoon probability is elevated. Strengthen drainage, consider early harvesting, and assess insurance options.'
      : irrigationType === 'Rainfed'
      ? 'Consider shifting to irrigated farming if water access is available. Irrigation consistently adds 6–7 sacks per hectare.'
      : riskLevel === 'high'
      ? 'Adjust planting month away from peak typhoon season (June–October). Consult local agricultural extension officers.'
      : 'Current conditions are manageable. Continue monitoring weather forecasts and maintain soil health for consistent yields.';

  const borderColor =
    riskLevel === 'low' ? 'hsl(var(--primary))' :
    riskLevel === 'moderate' ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))';

  return (
    <Card className="border-border" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          📋 Farmer Interpretation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div>
          <div className="font-semibold text-foreground mb-1">Current Situation</div>
          <p className="text-muted-foreground leading-relaxed">{situation}</p>
        </div>
        <div>
          <div className="font-semibold text-foreground mb-1">What This Means</div>
          <p className="text-muted-foreground leading-relaxed">{meaning}</p>
        </div>
        <div>
          <div className="font-semibold text-foreground mb-1">Suggested Action</div>
          <p className="text-muted-foreground leading-relaxed">{action}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveResultsDashboard() {
  const { snap } = useSimulation();
  const {
    status, histogramBins, weatherCounts, yieldHistoryOverTime,
    runningMean, runningSd, lowYieldProb, summary, currentCycleIndex, params,
  } = snap;

  const hasData = currentCycleIndex > 0;

  const handleExport = useCallback(() => {
    const MNAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const s = snap.summary;
    const n = snap.currentCycleIndex;
    const ciLowVal  = s?.ciLow  ?? (snap.runningMean - 1.96 * snap.runningSd / Math.sqrt(Math.max(1, n)));
    const ciHighVal = s?.ciHigh ?? (snap.runningMean + 1.96 * snap.runningSd / Math.sqrt(Math.max(1, n)));
    const meanSacks = Math.round(snap.runningMean * TONS_TO_SACKS);

    const rows: string[] = [];
    rows.push('SIMULATION PARAMETERS');
    rows.push('Parameter,Value');
    rows.push(`Planting Month,${MNAMES[snap.params.plantingMonth - 1]}`);
    rows.push(`Irrigation Type,${snap.params.irrigationType}`);
    rows.push(`ENSO State,${snap.params.ensoState}`);
    rows.push(`Typhoon Probability,${snap.params.typhoonProbability}%`);
    rows.push(`Target Cycles,${snap.params.cyclesTarget}`);
    rows.push(`Days Per Cycle,${snap.params.daysPerCycle}`);
    rows.push('');
    rows.push('SUMMARY STATISTICS');
    rows.push('Metric,Value (t/ha),Sacks (50kg)');
    rows.push(`Completed Cycles,${n},—`);
    rows.push(`Mean Yield,${snap.runningMean.toFixed(4)},${meanSacks}`);
    rows.push(`Std Deviation,${snap.runningSd.toFixed(4)},—`);
    rows.push(`Min Yield,${s ? s.min.toFixed(4) : 'N/A'},${s ? Math.round(s.min * TONS_TO_SACKS) : 'N/A'}`);
    rows.push(`Max Yield,${s ? s.max.toFixed(4) : 'N/A'},${s ? Math.round(s.max * TONS_TO_SACKS) : 'N/A'}`);
    rows.push(`5th Percentile,${s ? s.percentile5.toFixed(4) : 'N/A'},${s ? Math.round(s.percentile5 * TONS_TO_SACKS) : 'N/A'}`);
    rows.push(`95th Percentile,${s ? s.percentile95.toFixed(4) : 'N/A'},${s ? Math.round(s.percentile95 * TONS_TO_SACKS) : 'N/A'}`);
    rows.push(`95% CI Lower,${ciLowVal.toFixed(4)},—`);
    rows.push(`95% CI Upper,${ciHighVal.toFixed(4)},—`);
    rows.push(`P(Yield < 2.0 t/ha),${(snap.lowYieldProb * 100).toFixed(2)}%,—`);
    rows.push('');
    rows.push('WEATHER FREQUENCIES');
    rows.push('Weather Type,Count,Proportion (%)');
    const totalW = Object.values(snap.weatherCounts).reduce((a, b) => a + b, 0);
    (Object.keys(snap.weatherCounts) as string[]).forEach((k) => {
      const cnt = (snap.weatherCounts as Record<string, number>)[k];
      rows.push(`${k},${cnt},${totalW > 0 ? ((cnt / totalW) * 100).toFixed(2) : '0.00'}`);
    });
    rows.push('');
    rows.push('YIELD DISTRIBUTION HISTOGRAM');
    rows.push('Bin (t/ha),Count,Proportion (%)');
    const totalH = snap.histogramBins.reduce((a, b) => a + b.count, 0);
    snap.histogramBins.forEach((b) => {
      rows.push(`${b.label},${b.count},${totalH > 0 ? ((b.count / totalH) * 100).toFixed(2) : '0.00'}`);
    });
    rows.push('');
    rows.push('RUNNING MEAN CONVERGENCE');
    rows.push('Cycle,Running Mean (t/ha),Sacks');
    snap.yieldHistoryOverTime.forEach((v, i) => {
      rows.push(`${i + 1},${v.toFixed(4)},${Math.round(v * TONS_TO_SACKS)}`);
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href = url;
    a.download = `rice_yield_simulation_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snap]);

  if (!hasData) return null;

  const s = summary;
  const ciLow  = s?.ciLow  ?? (runningMean - 1.96 * runningSd / Math.sqrt(Math.max(1, currentCycleIndex)));
  const ciHigh = s?.ciHigh ?? (runningMean + 1.96 * runningSd / Math.sqrt(Math.max(1, currentCycleIndex)));

  const pieData = (Object.keys(weatherCounts) as string[])
    .filter((k) => (weatherCounts as Record<string, number>)[k] > 0)
    .map((k) => ({ name: k, value: (weatherCounts as Record<string, number>)[k] }));

  const meanHistory = yieldHistoryOverTime.map((v, i) => ({ cycle: i + 1, mean: +v.toFixed(3) }));
  const downsampled = meanHistory.length > 200
    ? meanHistory.filter((_, i) => i % Math.ceil(meanHistory.length / 200) === 0)
    : meanHistory;

  const statCards = [
    { label: 'Mean Yield',      value: `${runningMean.toFixed(3)} t/ha`,                          sub: `${Math.round(runningMean * TONS_TO_SACKS)} sacks`,  color: 'text-primary' },
    { label: 'Std Deviation',   value: `${runningSd.toFixed(3)}`,                                  sub: '±σ variation',                                      color: 'text-muted-foreground' },
    { label: 'Min Yield',       value: s ? `${s.min.toFixed(3)} t/ha` : '—',                       sub: s ? `${Math.round(s.min * TONS_TO_SACKS)} sacks` : '', color: 'text-destructive' },
    { label: 'Max Yield',       value: s ? `${s.max.toFixed(3)} t/ha` : '—',                       sub: s ? `${Math.round(s.max * TONS_TO_SACKS)} sacks` : '', color: 'text-accent' },
    { label: 'P(Yield < 2.0)', value: `${(lowYieldProb * 100).toFixed(1)}%`,                      sub: 'Low yield risk',                                    color: 'text-destructive' },
    { label: '95% CI',          value: `[${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}]`,               sub: 'Confidence interval',                               color: 'text-info' },
    { label: '5th Percentile',  value: s ? `${s.percentile5.toFixed(3)} t/ha` : '—',               sub: s ? `${Math.round(s.percentile5 * TONS_TO_SACKS)} sacks` : '', color: 'text-warning' },
    { label: '95th Percentile', value: s ? `${s.percentile95.toFixed(3)} t/ha` : '—',              sub: s ? `${Math.round(s.percentile95 * TONS_TO_SACKS)} sacks` : '', color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-t border-border pt-6">
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Live Results Dashboard
          </h2>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {status === 'running' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
                Live — updates as cycles complete · {currentCycleIndex} cycles recorded
              </span>
            )}
            {status !== 'running' && `${currentCycleIndex} cycles recorded`}
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((sc) => (
          <Card key={sc.label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground mb-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>{sc.label}</div>
              <div className={`text-lg font-bold ${sc.color}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{sc.value}</div>
              {sc.sub && <div className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>{sc.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sack Conversion */}
      <SackConversionPanel meanYield={runningMean} lowYieldProb={lowYieldProb} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Yield Distribution ({currentCycleIndex} cycles)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={histogramBins}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Yield (t/ha)', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'Poppins, sans-serif', fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Weather Frequency</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={WEATHER_COLORS[entry.name] ?? 'hsl(var(--muted))'} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {downsampled.length > 1 && (
          <Card className="border-border lg:col-span-2">
            <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Running Mean Convergence</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={downsampled}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cycle" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Cycle', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 't/ha', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'Poppins, sans-serif', fontSize: 12 }} />
                  <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Farmer Interpretation */}
      <FarmerInterpretation
        meanYield={runningMean}
        lowYieldProb={lowYieldProb}
        typhoonProb={params.typhoonProbability}
        irrigationType={params.irrigationType}
      />
    </div>
  );
}

export default function SimulationTab() {
  const { snap, start, pause, resume, reset, setSpeed, updateParams } = useSimulation();
  const {
    status, params, pendingParams, speedMultiplier, currentCycleIndex,
    currentDay, dayProgress, runProgress, currentWeather, currentYield, runningMean, recentYields,
  } = snap;

  const isRunning  = status === 'running';
  const isPaused   = status === 'paused';
  const isActive   = isRunning || isPaused;
  const isIdle     = status === 'idle';
  const isFinished = status === 'finished';

  const displayParams = { ...params, ...pendingParams };

  const handleInstant = () => {
    reset();
    setSpeed(1000);
    start();
  };

  return (
    <div className="space-y-6">
      {/* ── Section 1: Controls + Live View side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameter Control */}
        <Card className="lg:col-span-1 border-border">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Parameter Control</CardTitle>
            {isActive && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
                {isRunning ? 'Running — switch tabs freely' : 'Paused'}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Planting Month */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
                Planting Month
                {isActive && pendingParams.plantingMonth !== undefined && (
                  <span className="ml-2 text-[10px] text-warning">(queued)</span>
                )}
              </Label>
              <Select value={String(displayParams.plantingMonth)} onValueChange={(v) => updateParams({ plantingMonth: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)} style={{ fontFamily: "'Poppins', sans-serif" }}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Irrigation */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
                Irrigation Type
                {isActive && pendingParams.irrigationType !== undefined && (
                  <span className="ml-2 text-[10px] text-warning">(queued)</span>
                )}
              </Label>
              <Select value={displayParams.irrigationType} onValueChange={(v) => updateParams({ irrigationType: v as IrrigationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Irrigated" style={{ fontFamily: "'Poppins', sans-serif" }}>Irrigated (+6 sacks)</SelectItem>
                  <SelectItem value="Rainfed" style={{ fontFamily: "'Poppins', sans-serif" }}>Rainfed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ENSO */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
                ENSO State
                {isActive && pendingParams.ensoState !== undefined && (
                  <span className="ml-2 text-[10px] text-warning">(queued)</span>
                )}
              </Label>
              <Select value={displayParams.ensoState} onValueChange={(v) => updateParams({ ensoState: v as ENSOState })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="El Niño" style={{ fontFamily: "'Poppins', sans-serif" }}>El Niño (−8 sacks)</SelectItem>
                  <SelectItem value="Neutral" style={{ fontFamily: "'Poppins', sans-serif" }}>Neutral</SelectItem>
                  <SelectItem value="La Niña" style={{ fontFamily: "'Poppins', sans-serif" }}>La Niña (+6 sacks)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Typhoon Prob */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
                Typhoon Probability: {params.typhoonProbability}%
                <span className="ml-2 text-[10px] text-primary">(live)</span>
              </Label>
              <Slider value={[params.typhoonProbability]} onValueChange={([v]) => updateParams({ typhoonProbability: v })} min={0} max={40} step={1} />
            </div>

            {/* Cycles */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
                Crop Cycles: {displayParams.cyclesTarget}
                {isActive && pendingParams.cyclesTarget !== undefined && (
                  <span className="ml-2 text-[10px] text-warning">(queued)</span>
                )}
              </Label>
              <Slider value={[displayParams.cyclesTarget]} onValueChange={([v]) => updateParams({ cyclesTarget: v })} min={10} max={1000} step={10} disabled={isActive} />
            </div>

            {/* Speed */}
            <div className="space-y-1.5">
              <Label style={{ fontFamily: "'Poppins', sans-serif" }}>Speed: {speedMultiplier}×</Label>
              <Slider value={[speedMultiplier]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={20} step={0.5} />
              <div className="flex gap-1 flex-wrap">
                {[0.5, 1, 2, 5, 10, 20].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      speedMultiplier === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary'
                    }`}
                  >
                    {SPEED_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bars */}
            {isActive && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    <span>Day {currentDay}/{params.daysPerCycle}</span>
                    <span>{Math.round(dayProgress * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-100 rounded-full" style={{ width: `${dayProgress * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    <span>{currentCycleIndex}/{params.cyclesTarget} cycles</span>
                    <span>{Math.round(runProgress * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-150 rounded-full" style={{ width: `${runProgress * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {isIdle || isFinished ? (
                <>
                  <Button onClick={start} className="flex-1 gap-2">
                    <Play className="w-4 h-4" /> Animate
                  </Button>
                  <Button onClick={handleInstant} variant="secondary" className="flex-1 gap-2">
                    <Zap className="w-4 h-4" /> Instant
                  </Button>
                </>
              ) : isRunning ? (
                <Button onClick={pause} variant="outline" className="flex-1 gap-2">
                  <Pause className="w-4 h-4" /> Pause
                </Button>
              ) : (
                <Button onClick={resume} className="flex-1 gap-2">
                  <Play className="w-4 h-4" /> Resume
                </Button>
              )}
              <Button onClick={reset} variant="outline" className="gap-2" size="icon">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Live Simulation View ── */}
        <div className="lg:col-span-2 space-y-4">
          <WeatherScene weather={currentWeather} growthProgress={dayProgress} />

          {/* Live stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {[
                { label: 'Cycle',         value: isActive || isFinished ? `${currentCycleIndex} / ${params.cyclesTarget}` : '—' },
                { label: 'Season',        value: currentWeather ?? '—' },
                { label: 'Current Yield', value: currentYield != null ? `${currentYield.toFixed(2)} t/ha` : '—' },
                { label: 'Running Mean',  value: runningMean > 0 ? `${runningMean.toFixed(2)} t/ha` : '—' },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-lg p-3 border border-border"
                >
                  <div className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>{stat.label}</div>
                  <div className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</div>
                  {stat.label === 'Current Yield' && currentYield != null && (
                    <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {Math.round(currentYield * TONS_TO_SACKS)} sacks
                    </div>
                  )}
                  {stat.label === 'Running Mean' && runningMean > 0 && (
                    <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      ≈{Math.round(runningMean * TONS_TO_SACKS)} sacks avg
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Recent yield history mini chart */}
          {recentYields.length > 0 && (
            <Card className="border-border">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Yield History — last {recentYields.length} cycles
                  {isRunning && <span className="ml-2 text-primary animate-pulse">● live</span>}
                </div>
                <div className="flex items-end gap-[2px] h-16">
                  {recentYields.map((y, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all duration-100"
                      style={{
                        height: `${Math.min((y / 5) * 100, 100)}%`,
                        backgroundColor: y < 2 ? 'hsl(var(--destructive))' : y < 3 ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isIdle && (
            <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Press Animate or Instant to begin the simulation
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Live Results Dashboard (embedded) ── */}
      <LiveResultsDashboard />

      {/* ── Section 4: Monte Carlo Mode A ── */}
      <MonteCarloPanel />
    </div>
  );
}
