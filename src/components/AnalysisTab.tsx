import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ChartLegend from './ChartLegend';
import { useSimulationStore } from '@/store/simulationStore';
import { getSeason, IrrigationType, ENSOState, WeatherType } from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0,
  Normal: 3.0,
  Wet: 3.3,
  Typhoon: 1.2,
};

const IRRIGATION_ADJ: Record<IrrigationType, number> = {
  Irrigated: 0.3,
  Rainfed: 0,
};

const ENSO_ADJ: Record<ENSOState, number> = {
  'El Niño': -0.4,
  Neutral: 0,
  'La Niña': 0.3,
};

function expectedWeatherWeights(season: ReturnType<typeof getSeason>, typhoonProb: number) {
  const weights =
    season === 'Dry Season'
      ? { Dry: 0.5, Normal: 0.4, Wet: 0.1, Typhoon: 0.05 }
      : { Dry: 0.1, Normal: 0.4, Wet: 0.35, Typhoon: Math.max(0, typhoonProb) };
  const total = weights.Dry + weights.Normal + weights.Wet + weights.Typhoon;
  return {
    Dry: weights.Dry / total,
    Normal: weights.Normal / total,
    Wet: weights.Wet / total,
    Typhoon: weights.Typhoon / total,
  };
}

function expectedYield(params: {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;
}) {
  const season = getSeason(params.plantingMonth);
  const weights = expectedWeatherWeights(season, params.typhoonProbability / 100);
  const base =
    BASE_YIELDS.Dry * weights.Dry +
    BASE_YIELDS.Normal * weights.Normal +
    BASE_YIELDS.Wet * weights.Wet +
    BASE_YIELDS.Typhoon * weights.Typhoon;
  const adj = IRRIGATION_ADJ[params.irrigationType] + ENSO_ADJ[params.ensoState];
  return Math.max(0, base + adj);
}

export default function AnalysisTab() {
  const { snap, viewMode } = useSimulationStore();
  const { params, runningMean, lowYieldProb, summary, cycleRecords } = snap;
  const isFarmer = viewMode === 'farmer';

  const modelBaseline = useMemo(() => expectedYield(params), [params]);
  const baseline = runningMean > 0 ? runningMean : modelBaseline;
  const calibration = modelBaseline > 0 ? baseline / modelBaseline : 1;
  const formatYieldValue = (value: number) =>
    isFarmer ? `${Math.round(value * 20)} sacks` : `${value.toFixed(2)} t/ha`;
  const formatYieldRange = (low: number, high: number) =>
    isFarmer
      ? `${Math.round(low * 20)} to ${Math.round(high * 20)} sacks`
      : `${low.toFixed(2)} to ${high.toFixed(2)} t/ha`;

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
      plantingMonth: params.plantingMonth,
      irrigationType: params.irrigationType,
      ensoState: params.ensoState,
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
  }, [calibration, params]);
  const typhoonNumbers = typhoonData[0];

  const interpretation = useMemo(() => {
    const riskPct = (lowYieldProb * 100).toFixed(1);
    const riskBand = lowYieldProb > 0.30 ? 'High' : lowYieldProb > 0.15 ? 'Moderate' : 'Low';
    return {
      headline: `Risk Band: ${riskBand} (${riskPct}%)`,
      note: 'All values below are calibrated estimates anchored to the live run, using model deltas for irrigation, ENSO, and typhoon sensitivity. No separate simulations were launched here.',
      takeaways: [
        `Irrigation shifts yield by about 0.3 t/ha (around 6 sacks) compared to rainfed conditions.`,
        `ENSO state changes yield by -0.4 to +0.3 t/ha across scenarios.`,
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
      if (r.yieldTons < 2.0) low++;
      else if (r.yieldTons <= 3.0) mid++;
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
        low: 'Low (<40 sacks)',
        mid: 'Moderate (40-60 sacks)',
        high: 'High (>60 sacks)',
      }
    : {
        low: 'Low (<2.0 t/ha)',
        mid: 'Moderate (2.0-3.0 t/ha)',
        high: 'High (>3.0 t/ha)',
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

  const handleExport = useCallback(() => {
    const rows: string[] = [];
    rows.push('ANALYSIS_EXPORT');
    rows.push('Metric,Value');
    rows.push(`Baseline Yield (t/ha),${baseline.toFixed(4)}`);
    rows.push(`Low Yield Risk (%),${(lowYieldProb * 100).toFixed(2)}`);
    rows.push(`Season,${getSeason(params.plantingMonth)}`);
    rows.push(`Planting Month,${params.plantingMonth}`);
    rows.push(`Irrigation Type,${params.irrigationType}`);
    rows.push(`ENSO State,${params.ensoState}`);
    rows.push(`Typhoon Probability (%),${params.typhoonProbability.toFixed(1)}`);

    rows.push('');
    rows.push('Irrigation Comparison');
    rows.push('Scenario,Yield (t/ha)');
    rows.push(`Irrigated,${irrigationNumbers.Irrigated.toFixed(2)}`);
    rows.push(`Rainfed,${irrigationNumbers.Rainfed.toFixed(2)}`);

    rows.push('');
    rows.push('ENSO Comparison');
    rows.push('Scenario,Yield (t/ha)');
    rows.push(`El Niño,${ensoNumbers['El Niño'].toFixed(2)}`);
    rows.push(`Neutral,${ensoNumbers.Neutral.toFixed(2)}`);
    rows.push(`La Niña,${ensoNumbers['La Niña'].toFixed(2)}`);

    rows.push('');
    rows.push('Typhoon Sensitivity');
    rows.push('Scenario,Yield (t/ha)');
    rows.push(`Low (5%),${typhoonNumbers['Low (5%)'].toFixed(2)}`);
    rows.push(`Mid (current),${typhoonNumbers['Mid (current)'].toFixed(2)}`);
    rows.push(`High (35%),${typhoonNumbers['High (35%)'].toFixed(2)}`);

    rows.push('');
    rows.push('Monte Carlo Outlook');
    rows.push('Bucket,Percent,Count');
    const total = mcTotals.total || 1;
    rows.push(`Low (<2.0 t/ha),${((mcTotals.low / total) * 100).toFixed(2)},${mcTotals.low}`);
    rows.push(`Moderate (2.0-3.0 t/ha),${((mcTotals.mid / total) * 100).toFixed(2)},${mcTotals.mid}`);
    rows.push(`High (>3.0 t/ha),${((mcTotals.high / total) * 100).toFixed(2)},${mcTotals.high}`);
    if (mcRange) {
      rows.push(`P5 (t/ha),${mcRange.p5.toFixed(4)}`);
      rows.push(`P95 (t/ha),${mcRange.p95.toFixed(4)}`);
      rows.push(`Mean (t/ha),${mcRange.mean.toFixed(4)}`);
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href = url;
    a.download = `rice_yield_analysis_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    baseline, lowYieldProb, params, irrigationNumbers, ensoNumbers, typhoonNumbers, mcTotals, mcRange,
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

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Baseline Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <div>Baseline Yield: <strong>{formatYieldValue(baseline)}</strong></div>
          <div>Low-Yield Risk: <strong>{(lowYieldProb * 100).toFixed(1)}%</strong></div>
          <div>Season: <strong>{getSeason(params.plantingMonth)}</strong> (Planting Month {params.plantingMonth})</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Irrigated vs Rainfed</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={irrigationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="Irrigated" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Rainfed" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                { label: 'Irrigated', color: 'hsl(var(--primary))', variant: 'fill' },
                { label: 'Rainfed', color: 'hsl(var(--chart-3))', variant: 'fill' },
              ]}
            />
            {isFarmer && (
              <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Farmer note: This compares expected yields if the same field is irrigated versus rainfed, based on current conditions.
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <div>Irrigated: {formatYieldValue(irrigationNumbers.Irrigated)}</div>
              <div>Rainfed: {formatYieldValue(irrigationNumbers.Rainfed)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">ENSO State Comparison</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ensoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="El Niño" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Neutral" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="La Niña" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                { label: 'El Niño', color: 'hsl(var(--chart-5))', variant: 'fill' },
                { label: 'Neutral', color: 'hsl(var(--chart-4))', variant: 'fill' },
                { label: 'La Niña', color: 'hsl(var(--chart-2))', variant: 'fill' },
              ]}
            />
            {isFarmer && (
              <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Farmer note: ENSO shifts rainfall patterns, which changes yield. This shows the expected yield under each ENSO state.
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <div>El Niño: {formatYieldValue(ensoNumbers['El Niño'])}</div>
              <div>Neutral: {formatYieldValue(ensoNumbers.Neutral)}</div>
              <div>La Niña: {formatYieldValue(ensoNumbers['La Niña'])}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Typhoon Probability Sensitivity</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typhoonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="Low (5%)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Mid (current)" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="High (35%)" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                { label: 'Low (5%)', color: 'hsl(var(--primary))', variant: 'fill' },
                { label: 'Mid (current)', color: 'hsl(var(--chart-4))', variant: 'fill' },
                { label: 'High (35%)', color: 'hsl(var(--chart-5))', variant: 'fill' },
              ]}
            />
            {isFarmer && (
              <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Farmer note: Higher typhoon chances reduce expected yield. This chart shows how sensitive your outcome is to storms.
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <div>Low (5%): {formatYieldValue(typhoonNumbers['Low (5%)'])}</div>
              <div>Mid (current): {formatYieldValue(typhoonNumbers['Mid (current)'])}</div>
              <div>High (35%): {formatYieldValue(typhoonNumbers['High (35%)'])}</div>
            </div>
          </CardContent>
        </Card>
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
