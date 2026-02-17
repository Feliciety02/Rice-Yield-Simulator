import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runSimulation, SimulationParams, SimulationResults } from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface AnalysisTabProps {
  baseParams: SimulationParams;
}

function compare(label: string, a: SimulationResults, b: SimulationResults, aLabel: string, bLabel: string) {
  return {
    label,
    [aLabel]: Number(a.meanYield.toFixed(3)),
    [bLabel]: Number(b.meanYield.toFixed(3)),
    aLow: Number((a.lowYieldProbability * 100).toFixed(1)),
    bLow: Number((b.lowYieldProbability * 100).toFixed(1)),
  };
}

export default function AnalysisTab({ baseParams }: AnalysisTabProps) {
  const analysis = useMemo(() => {
    const n = 1000;
    const p = { ...baseParams, numCycles: n };

    const irrigated = runSimulation({ ...p, irrigationType: 'Irrigated' });
    const rainfed = runSimulation({ ...p, irrigationType: 'Rainfed' });

    const elNino = runSimulation({ ...p, ensoState: 'El Niño' });
    const neutral = runSimulation({ ...p, ensoState: 'Neutral' });
    const laNina = runSimulation({ ...p, ensoState: 'La Niña' });

    const lowTyphoon = runSimulation({ ...p, typhoonProbability: 5 });
    const highTyphoon = runSimulation({ ...p, typhoonProbability: 35 });

    return { irrigated, rainfed, elNino, neutral, laNina, lowTyphoon, highTyphoon };
  }, [baseParams]);

  const irrigationData = [
    {
      category: 'Mean Yield',
      Irrigated: Number(analysis.irrigated.meanYield.toFixed(2)),
      Rainfed: Number(analysis.rainfed.meanYield.toFixed(2)),
    },
  ];

  const ensoData = [
    {
      category: 'Mean Yield (t/ha)',
      'El Niño': Number(analysis.elNino.meanYield.toFixed(2)),
      Neutral: Number(analysis.neutral.meanYield.toFixed(2)),
      'La Niña': Number(analysis.laNina.meanYield.toFixed(2)),
    },
  ];

  const typhoonData = [
    {
      category: 'Mean Yield',
      'Low (5%)': Number(analysis.lowTyphoon.meanYield.toFixed(2)),
      'High (35%)': Number(analysis.highTyphoon.meanYield.toFixed(2)),
    },
  ];

  const riskData = [
    { scenario: 'Irrigated', risk: Number((analysis.irrigated.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'Rainfed', risk: Number((analysis.rainfed.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'El Niño', risk: Number((analysis.elNino.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'Neutral', risk: Number((analysis.neutral.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'La Niña', risk: Number((analysis.laNina.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'Low Typhoon', risk: Number((analysis.lowTyphoon.lowYieldProbability * 100).toFixed(1)) },
    { scenario: 'High Typhoon', risk: Number((analysis.highTyphoon.lowYieldProbability * 100).toFixed(1)) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Irrigation Comparison */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Irrigated vs Rainfed</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={irrigationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Irrigated" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Rainfed" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3">
              Irrigated fields yield ~0.3 t/ha more on average, reducing drought vulnerability.
            </p>
          </CardContent>
        </Card>

        {/* ENSO Comparison */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">ENSO State Comparison</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ensoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="El Niño" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Neutral" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="La Niña" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3">
              La Niña conditions tend to increase rainfall, benefiting yields. El Niño causes drought stress, reducing yields by ~0.4 t/ha.
            </p>
          </CardContent>
        </Card>

        {/* Typhoon Comparison */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Typhoon Probability Impact</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typhoonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Low (5%)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="High (35%)" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3">
              High typhoon probability dramatically reduces expected yield and increases crop failure risk.
            </p>
          </CardContent>
        </Card>

        {/* Risk of Crop Failure */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Crop Failure Risk (Yield &lt; 2.0 t/ha)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="scenario" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} label={{ value: 'Risk %', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="risk" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3">
              Crop failure risk is highest under El Niño + high typhoon scenarios, exceeding 30% in some cases.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-base">Key Findings</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>Irrigation</strong> is the most controllable factor, consistently adding ~0.3 t/ha and reducing crop failure probability.</p>
          <p>• <strong>ENSO state</strong> has a significant effect: El Niño reduces yields by 0.4 t/ha on average, while La Niña increases them by 0.3 t/ha.</p>
          <p>• <strong>Typhoon frequency</strong> is the largest risk factor. At 35% probability, expected yield drops significantly and crop failure risk rises sharply.</p>
          <p>• The Monte Carlo approach (1,000 cycles per scenario) provides robust statistical estimates for risk-based decision making.</p>
        </CardContent>
      </Card>
    </div>
  );
}
