import { useCallback } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimulation } from '@/context/SimulationContext';
import { WeatherType } from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: 'hsl(45, 95%, 55%)',
  Normal: 'hsl(200, 60%, 55%)',
  Wet: 'hsl(210, 60%, 50%)',
  Typhoon: 'hsl(0, 72%, 50%)',
};

export default function ResultsTab() {
  const { snap } = useSimulation();
  const { status, histogramBins, weatherCounts, yieldHistoryOverTime,
    runningMean, runningSd, lowYieldProb, summary, currentCycleIndex,
    params } = snap;

  const hasData = currentCycleIndex > 0;

  const handleExport = useCallback(() => {
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const s = snap.summary;
    const ciLowVal  = s?.ciLow  ?? (snap.runningMean - 1.96 * snap.runningSd / Math.sqrt(Math.max(1, snap.currentCycleIndex)));
    const ciHighVal = s?.ciHigh ?? (snap.runningMean + 1.96 * snap.runningSd / Math.sqrt(Math.max(1, snap.currentCycleIndex)));

    const sections: string[] = [];

    // ── Section 1: Simulation Parameters ──
    sections.push('SIMULATION PARAMETERS');
    sections.push('Parameter,Value');
    sections.push(`Planting Month,${MONTH_NAMES[snap.params.plantingMonth - 1]}`);
    sections.push(`Irrigation Type,${snap.params.irrigationType}`);
    sections.push(`ENSO State,${snap.params.ensoState}`);
    sections.push(`Typhoon Probability,${snap.params.typhoonProbability}%`);
    sections.push(`Target Cycles,${snap.params.cyclesTarget}`);
    sections.push(`Days Per Cycle,${snap.params.daysPerCycle}`);
    sections.push('');

    // ── Section 2: Summary Statistics ──
    sections.push('SUMMARY STATISTICS');
    sections.push('Metric,Value,Unit');
    sections.push(`Completed Cycles,${snap.currentCycleIndex},cycles`);
    sections.push(`Mean Yield,${snap.runningMean.toFixed(4)},t/ha`);
    sections.push(`Std Deviation,${snap.runningSd.toFixed(4)},t/ha`);
    sections.push(`Min Yield,${s ? s.min.toFixed(4) : 'N/A'},t/ha`);
    sections.push(`Max Yield,${s ? s.max.toFixed(4) : 'N/A'},t/ha`);
    sections.push(`5th Percentile,${s ? s.percentile5.toFixed(4) : 'N/A'},t/ha`);
    sections.push(`95th Percentile,${s ? s.percentile95.toFixed(4) : 'N/A'},t/ha`);
    sections.push(`95% CI Lower,${ciLowVal.toFixed(4)},t/ha`);
    sections.push(`95% CI Upper,${ciHighVal.toFixed(4)},t/ha`);
    sections.push(`P(Yield < 2.0 t/ha),${(snap.lowYieldProb * 100).toFixed(2)},%`);
    sections.push('');

    // ── Section 3: Weather Frequencies ──
    sections.push('WEATHER FREQUENCIES');
    sections.push('Weather Type,Count,Proportion (%)');
    const totalW = Object.values(snap.weatherCounts).reduce((a, b) => a + b, 0);
    (Object.keys(snap.weatherCounts) as WeatherType[]).forEach((k) => {
      const cnt = snap.weatherCounts[k];
      sections.push(`${k},${cnt},${totalW > 0 ? ((cnt / totalW) * 100).toFixed(2) : '0.00'}`);
    });
    sections.push('');

    // ── Section 4: Yield Distribution Histogram ──
    sections.push('YIELD DISTRIBUTION HISTOGRAM');
    sections.push('Bin (t/ha),Count,Proportion (%)');
    const totalH = snap.histogramBins.reduce((a, b) => a + b.count, 0);
    snap.histogramBins.forEach((b) => {
      sections.push(`${b.label},${b.count},${totalH > 0 ? ((b.count / totalH) * 100).toFixed(2) : '0.00'}`);
    });
    sections.push('');

    // ── Section 5: Running Mean Convergence ──
    sections.push('RUNNING MEAN CONVERGENCE');
    sections.push('Cycle,Running Mean (t/ha)');
    snap.yieldHistoryOverTime.forEach((v, i) => {
      sections.push(`${i + 1},${v.toFixed(4)}`);
    });

    const csvContent = sections.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    link.href = url;
    link.download = `rice_yield_simulation_${ts}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [snap]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-muted-foreground text-lg">No data yet — run the simulation to see live results.</p>
        <p className="text-muted-foreground text-sm">This tab updates in real time while the simulation runs.</p>
      </div>
    );
  }

  const pieData = (Object.keys(weatherCounts) as WeatherType[])
    .filter((k) => weatherCounts[k] > 0)
    .map((k) => ({ name: k, value: weatherCounts[k] }));

  const meanHistory = yieldHistoryOverTime.map((v, i) => ({ cycle: i + 1, mean: Number(v.toFixed(3)) }));
  // Downsample if very large
  const downsampled = meanHistory.length > 200
    ? meanHistory.filter((_, i) => i % Math.ceil(meanHistory.length / 200) === 0)
    : meanHistory;

  const s = summary;
  const ciLow  = s?.ciLow  ?? (runningMean - 1.96 * runningSd / Math.sqrt(Math.max(1, currentCycleIndex)));
  const ciHigh = s?.ciHigh ?? (runningMean + 1.96 * runningSd / Math.sqrt(Math.max(1, currentCycleIndex)));

  const statCards = [
    { label: 'Mean Yield', value: `${runningMean.toFixed(3)} t/ha`, color: 'text-primary' },
    { label: 'Std Deviation', value: `${runningSd.toFixed(3)}`, color: 'text-muted-foreground' },
    { label: 'Min Yield', value: s ? `${s.min.toFixed(3)} t/ha` : '—', color: 'text-destructive' },
    { label: 'Max Yield', value: s ? `${s.max.toFixed(3)} t/ha` : '—', color: 'text-accent' },
    { label: 'P(Yield < 2.0)', value: `${(lowYieldProb * 100).toFixed(1)}%`, color: 'text-destructive' },
    { label: '95% CI', value: `[${ciLow.toFixed(2)}, ${ciHigh.toFixed(2)}]`, color: 'text-info' },
    { label: '5th Percentile', value: s ? `${s.percentile5.toFixed(3)} t/ha` : '—', color: 'text-warning' },
    { label: '95th Percentile', value: s ? `${s.percentile95.toFixed(3)} t/ha` : '—', color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {status === 'running' && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
              Live — results update as cycles complete
            </div>
          )}
          {status === 'finished' && (
            <p className="text-sm text-muted-foreground">
              Simulation complete — {currentCycleIndex} cycles recorded.
            </p>
          )}
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-xl font-bold font-['Space_Grotesk'] ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histogram */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Yield Distribution ({currentCycleIndex} cycles)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogramBins}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Yield (t/ha)', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weather Pie */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Weather Frequency</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={WEATHER_COLORS[entry.name as WeatherType]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Running Mean convergence */}
        {downsampled.length > 1 && (
          <Card className="border-border lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Running Mean Convergence</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={downsampled}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cycle" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Cycle', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={['auto', 'auto']} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 't/ha', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
