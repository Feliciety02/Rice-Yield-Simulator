import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimulationResults, WeatherType } from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface ResultsTabProps {
  results: SimulationResults | null;
}

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: 'hsl(45, 95%, 55%)',
  Normal: 'hsl(200, 60%, 55%)',
  Wet: 'hsl(210, 60%, 50%)',
  Typhoon: 'hsl(0, 72%, 50%)',
};

function buildHistogramData(results: SimulationResults) {
  const bins: Record<string, number> = {};
  const step = 0.5;
  for (let b = 0; b <= 5; b += step) {
    bins[b.toFixed(1)] = 0;
  }
  results.cycles.forEach((c) => {
    const bin = (Math.floor(c.finalYield / step) * step);
    const key = Math.min(bin, 5).toFixed(1);
    if (bins[key] !== undefined) bins[key]++;
  });
  return Object.entries(bins).map(([yield_, count]) => ({
    yield: yield_,
    count,
  }));
}

export default function ResultsTab({ results }: ResultsTabProps) {
  if (!results) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-lg">Run a simulation first to see results.</p>
      </div>
    );
  }

  const histData = buildHistogramData(results);
  const pieData = Object.entries(results.weatherFrequencies).map(([name, value]) => ({
    name,
    value,
  }));

  const statCards = [
    { label: 'Mean Yield', value: `${results.meanYield.toFixed(3)} t/ha`, color: 'text-primary' },
    { label: 'Std Deviation', value: `${results.stdDev.toFixed(3)}`, color: 'text-muted-foreground' },
    { label: 'Min Yield', value: `${results.minYield.toFixed(3)} t/ha`, color: 'text-destructive' },
    { label: 'Max Yield', value: `${results.maxYield.toFixed(3)} t/ha`, color: 'text-accent' },
    { label: 'P(Yield < 2.0)', value: `${(results.lowYieldProbability * 100).toFixed(1)}%`, color: 'text-destructive' },
    { label: '95% CI', value: `[${results.confidenceInterval[0].toFixed(2)}, ${results.confidenceInterval[1].toFixed(2)}]`, color: 'text-info' },
    { label: '5th Percentile', value: `${results.percentile5.toFixed(3)} t/ha`, color: 'text-warning' },
    { label: '95th Percentile', value: `${results.percentile95.toFixed(3)} t/ha`, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
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
          <CardHeader><CardTitle className="text-base">Yield Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="yield" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Yield (t/ha)', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Weather Frequency</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
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
      </div>
    </div>
  );
}
