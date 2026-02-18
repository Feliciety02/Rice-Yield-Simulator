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
      {/* Live indicator */}
      {status === 'running' && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          Live — results update as cycles complete
        </div>
      )}

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
