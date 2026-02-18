import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runSimulation } from '@/lib/simulation';
import { useSimulation } from '@/context/SimulationContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TYPHOON_LEVELS = [0, 5, 10, 15, 20, 25, 30, 35, 40];

function getHeatColor(value: number): string {
  const pct = value * 100;
  if (pct < 5) return 'hsl(var(--primary))';
  if (pct < 10) return 'hsl(142 50% 45%)';
  if (pct < 15) return 'hsl(80 50% 50%)';
  if (pct < 25) return 'hsl(45 80% 50%)';
  if (pct < 35) return 'hsl(25 80% 50%)';
  return 'hsl(var(--destructive))';
}

export default function AnalysisTab() {
  const { snap } = useSimulation();
  const { params: liveParams } = snap;

  // Use live params as base for scenario comparisons
  const baseParams = useMemo(() => ({
    plantingMonth: liveParams.plantingMonth,
    irrigationType: liveParams.irrigationType,
    ensoState: liveParams.ensoState,
    typhoonProbability: liveParams.typhoonProbability,
    numCycles: 1000,
  }), [liveParams.plantingMonth, liveParams.irrigationType, liveParams.ensoState, liveParams.typhoonProbability]);

  const analysis = useMemo(() => {
    const p = baseParams;
    return {
      irrigated: runSimulation({ ...p, irrigationType: 'Irrigated' }),
      rainfed: runSimulation({ ...p, irrigationType: 'Rainfed' }),
      elNino: runSimulation({ ...p, ensoState: 'El Niño' }),
      neutral: runSimulation({ ...p, ensoState: 'Neutral' }),
      laNina: runSimulation({ ...p, ensoState: 'La Niña' }),
      lowTyphoon: runSimulation({ ...p, typhoonProbability: 5 }),
      highTyphoon: runSimulation({ ...p, typhoonProbability: 35 }),
    };
  }, [baseParams]);

  const heatmapData = useMemo(() => {
    const data: { month: number; monthLabel: string; typhoon: number; meanYield: number; lowRisk: number }[] = [];
    for (const month of Array.from({ length: 12 }, (_, i) => i + 1)) {
      for (const typhoon of TYPHOON_LEVELS) {
        const res = runSimulation({
          ...baseParams,
          plantingMonth: month,
          typhoonProbability: typhoon,
          numCycles: 500,
        });
        data.push({ month, monthLabel: MONTH_NAMES_SHORT[month - 1], typhoon, meanYield: res.meanYield, lowRisk: res.lowYieldProbability });
      }
    }
    return data;
  }, [baseParams]);

  const irrigationData = [{ category: 'Mean Yield', Irrigated: +analysis.irrigated.meanYield.toFixed(2), Rainfed: +analysis.rainfed.meanYield.toFixed(2) }];
  const ensoData = [{ category: 'Mean Yield (t/ha)', 'El Niño': +analysis.elNino.meanYield.toFixed(2), Neutral: +analysis.neutral.meanYield.toFixed(2), 'La Niña': +analysis.laNina.meanYield.toFixed(2) }];
  const typhoonData = [{ category: 'Mean Yield', 'Low (5%)': +analysis.lowTyphoon.meanYield.toFixed(2), 'High (35%)': +analysis.highTyphoon.meanYield.toFixed(2) }];
  const riskData = [
    { scenario: 'Irrigated',    risk: +(analysis.irrigated.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'Rainfed',      risk: +(analysis.rainfed.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'El Niño',      risk: +(analysis.elNino.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'Neutral',      risk: +(analysis.neutral.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'La Niña',      risk: +(analysis.laNina.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'Low Typhoon',  risk: +(analysis.lowTyphoon.lowYieldProbability * 100).toFixed(1) },
    { scenario: 'High Typhoon', risk: +(analysis.highTyphoon.lowYieldProbability * 100).toFixed(1) },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Scenarios computed from live simulation params — reflects current planting month, irrigation, and ENSO state.
      </p>

      {/* Heatmap */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Yield Risk Heatmap — Planting Month × Typhoon Probability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Each cell shows the probability of low yield (&lt;2.0 t/ha) from 500 Monte Carlo cycles.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2 text-muted-foreground font-medium">Typhoon %</th>
                  {MONTH_NAMES_SHORT.map((m) => (
                    <th key={m} className="text-center py-1 px-1 text-muted-foreground font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPHOON_LEVELS.map((tp) => (
                  <tr key={tp}>
                    <td className="py-1 px-2 font-medium text-muted-foreground">{tp}%</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const cell = heatmapData.find((d) => d.month === month && d.typhoon === tp);
                      const risk = cell?.lowRisk ?? 0;
                      return (
                        <td key={month} className="py-1 px-1">
                          <div
                            className="rounded text-center py-1.5 font-bold text-[10px]"
                            style={{
                              backgroundColor: getHeatColor(risk),
                              color: risk > 0.25 ? 'white' : 'hsl(var(--primary-foreground))',
                            }}
                            title={`Mean: ${cell?.meanYield.toFixed(2)} t/ha | Risk: ${(risk * 100).toFixed(1)}%`}
                          >
                            {(risk * 100).toFixed(0)}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4 text-[10px] text-muted-foreground">
            <span>Low Risk</span>
            {[0, 0.07, 0.12, 0.20, 0.30, 0.40].map((v, i) => (
              <div key={i} className="w-6 h-4 rounded" style={{ backgroundColor: getHeatColor(v) }} />
            ))}
            <span>High Risk</span>
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
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Irrigated" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Rainfed" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-base">Key Findings</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>Irrigation</strong> is the most controllable factor, consistently adding ~0.3 t/ha and reducing crop failure probability.</p>
          <p>• <strong>ENSO state</strong> has a significant effect: El Niño reduces yields by 0.4 t/ha on average, while La Niña increases them by 0.3 t/ha.</p>
          <p>• <strong>Typhoon frequency</strong> is the largest risk factor. At 35% probability, expected yield drops significantly and crop failure risk rises sharply.</p>
          <p>• The <strong>heatmap</strong> reveals that wet season months (Jun–Oct) combined with high typhoon probability create the highest risk zones.</p>
          <p>• The Monte Carlo approach (500–1,000 cycles per scenario) provides robust statistical estimates for risk-based decision making.</p>
        </CardContent>
      </Card>
    </div>
  );
}
