import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSimulation } from '@/context/SimulationContext';
import { getSeason, getWeather } from '@/lib/simulation';

const TONS_TO_SACKS = 20;

const BASE_YIELDS: Record<string, number> = { Dry: 2.0, Normal: 3.0, Wet: 3.3, Typhoon: 1.2 };
const IRRIGATION_ADJ: Record<string, number> = { Irrigated: 0.3, Rainfed: 0 };
const ENSO_ADJ: Record<string, number> = { 'El Niño': -0.4, Neutral: 0, 'La Niña': 0.3 };

function gaussianNoise(sd = 0.2): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function runBatch(
  n: number,
  plantingMonth: number,
  irrigationType: string,
  ensoState: string,
  typhoonProbability: number,
  daysPerCycle: number
): { yields: number[]; lowCount: number } {
  const yields: number[] = [];
  let lowCount = 0;
  const season = getSeason(plantingMonth);
  const tProb = typhoonProbability / 100;
  for (let i = 0; i < n; i++) {
    // Accumulate weather over daysPerCycle
    const accum: Record<string, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    for (let d = 0; d < daysPerCycle; d++) {
      const w = getWeather(season, tProb);
      accum[w]++;
    }
    const dominant = (Object.keys(accum) as string[]).reduce((a, b) => accum[a] >= accum[b] ? a : b);
    const base = BASE_YIELDS[dominant] ?? 3.0;
    const adj  = (IRRIGATION_ADJ[irrigationType] ?? 0) + (ENSO_ADJ[ensoState] ?? 0);
    const yld  = Math.max(0, base + adj + gaussianNoise());
    yields.push(yld);
    if (yld < 2.0) lowCount++;
  }
  return { yields, lowCount };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.max(Math.floor(sorted.length * p), 0), sorted.length - 1);
  return sorted[idx] ?? 0;
}

interface MCStats {
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  p5: number;
  p95: number;
  ciLow: number;
  ciHigh: number;
  lowRisk: number;
}

function computeStats(yields: number[], lowCount: number): MCStats {
  const n = yields.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, min: 0, max: 0, p5: 0, p95: 0, ciLow: 0, ciHigh: 0, lowRisk: 0 };
  const mean = yields.reduce((a, b) => a + b, 0) / n;
  const variance = yields.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const sorted = [...yields].sort((a, b) => a - b);
  return {
    n,
    mean,
    sd,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: percentile(sorted, 0.05),
    p95: percentile(sorted, 0.95),
    ciLow: mean - 1.96 * se,
    ciHigh: mean + 1.96 * se,
    lowRisk: lowCount / n,
  };
}

type MCStatus = 'idle' | 'running' | 'paused' | 'done';

const CHUNK_SIZE = 50;
const TARGET_CYCLES = 2000;
const CHUNK_INTERVAL_MS = 30;

export default function MonteCarloPanel() {
  const { snap } = useSimulation();
  const [mcStatus, setMcStatus] = useState<MCStatus>('idle');
  const [stats, setStats] = useState<MCStats | null>(null);

  const yieldsRef = useRef<number[]>([]);
  const lowCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Locked params at start
  const lockedParams = useRef(snap.params);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const runChunk = useCallback(() => {
    const p = lockedParams.current;
    const remaining = TARGET_CYCLES - yieldsRef.current.length;
    if (remaining <= 0) {
      setMcStatus('done');
      stopTimer();
      return;
    }
    const batchN = Math.min(CHUNK_SIZE, remaining);
    const { yields: newYields, lowCount: newLow } = runBatch(
      batchN,
      p.plantingMonth,
      p.irrigationType,
      p.ensoState,
      p.typhoonProbability,
      p.daysPerCycle
    );
    yieldsRef.current = [...yieldsRef.current, ...newYields];
    lowCountRef.current += newLow;
    setStats(computeStats(yieldsRef.current, lowCountRef.current));

    if (yieldsRef.current.length >= TARGET_CYCLES) {
      setMcStatus('done');
      stopTimer();
    }
  }, []);

  const handleStart = useCallback(() => {
    yieldsRef.current = [];
    lowCountRef.current = 0;
    lockedParams.current = { ...snap.params };
    setStats(null);
    setMcStatus('running');
    stopTimer();
    timerRef.current = setInterval(runChunk, CHUNK_INTERVAL_MS);
  }, [snap.params, runChunk]);

  const handlePause = useCallback(() => {
    stopTimer();
    setMcStatus('paused');
  }, []);

  const handleResume = useCallback(() => {
    setMcStatus('running');
    timerRef.current = setInterval(runChunk, CHUNK_INTERVAL_MS);
  }, [runChunk]);

  const handleReset = useCallback(() => {
    stopTimer();
    yieldsRef.current = [];
    lowCountRef.current = 0;
    setStats(null);
    setMcStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), []);

  const pct = stats ? Math.round((stats.n / TARGET_CYCLES) * 100) : 0;
  const locked = mcStatus === 'running' || mcStatus === 'paused';
  const p = locked ? lockedParams.current : snap.params;

  return (
    <div className="border-t border-border pt-6 mt-2">
      <Card className="border-border border-2" style={{ borderColor: 'hsl(var(--primary) / 0.4)' }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                ⚡ Monte Carlo Mode A
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Fast risk estimation — runs {TARGET_CYCLES.toLocaleString()} cycles using current parameters
              </p>
            </div>
            <div className="flex gap-2">
              {mcStatus === 'idle' || mcStatus === 'done' ? (
                <Button onClick={handleStart} size="sm" className="gap-2">
                  <Zap className="w-3.5 h-3.5" /> Run Monte Carlo
                </Button>
              ) : mcStatus === 'running' ? (
                <Button onClick={handlePause} size="sm" variant="outline" className="gap-2">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </Button>
              ) : (
                <Button onClick={handleResume} size="sm" className="gap-2">
                  <Play className="w-3.5 h-3.5" /> Resume
                </Button>
              )}
              <Button onClick={handleReset} size="sm" variant="outline" className="gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {locked && (
            <div className="text-[11px] text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
              🔒 Parameters locked for this run: {p.irrigationType} · {p.ensoState} · Month {p.plantingMonth} · Typhoon {p.typhoonProbability}%
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          {(mcStatus === 'running' || mcStatus === 'paused' || mcStatus === 'done') && stats && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <span>
                  {mcStatus === 'done' ? 'Complete' : mcStatus === 'paused' ? 'Paused' : 'Running'}
                  {' — '}{stats.n.toLocaleString()} / {TARGET_CYCLES.toLocaleString()} cycles
                  {mcStatus === 'running' && <span className="ml-1 text-primary animate-pulse">●</span>}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats grid */}
          {stats && stats.n > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Mean Yield',      value: `${stats.mean.toFixed(3)} t/ha`, sub: `${Math.round(stats.mean * TONS_TO_SACKS)} sacks`, color: 'text-primary' },
                { label: 'Std Deviation',   value: stats.sd.toFixed(3),              sub: '±σ',                                             color: 'text-muted-foreground' },
                { label: 'Low Yield Risk',  value: `${(stats.lowRisk * 100).toFixed(1)}%`, sub: '< 2.0 t/ha',                             color: 'text-destructive' },
                { label: '95% CI',          value: `[${stats.ciLow.toFixed(2)}, ${stats.ciHigh.toFixed(2)}]`, sub: 'confidence interval', color: 'text-info' },
                { label: '5th Percentile',  value: `${stats.p5.toFixed(3)} t/ha`,   sub: `${Math.round(stats.p5 * TONS_TO_SACKS)} sacks`, color: 'text-warning' },
                { label: '95th Percentile', value: `${stats.p95.toFixed(3)} t/ha`,  sub: `${Math.round(stats.p95 * TONS_TO_SACKS)} sacks`, color: 'text-primary' },
                { label: 'Minimum',         value: `${stats.min.toFixed(3)} t/ha`,  sub: `${Math.round(stats.min * TONS_TO_SACKS)} sacks`, color: 'text-destructive' },
                { label: 'Maximum',         value: `${stats.max.toFixed(3)} t/ha`,  sub: `${Math.round(stats.max * TONS_TO_SACKS)} sacks`, color: 'text-accent' },
              ].map((sc) => (
                <div key={sc.label} className="bg-muted/50 rounded-lg p-3 border border-border">
                  <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>{sc.label}</div>
                  <div className={`text-sm font-bold ${sc.color}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{sc.value}</div>
                  <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>{sc.sub}</div>
                </div>
              ))}
            </div>
          )}

          {mcStatus === 'idle' && (
            <p className="text-sm text-muted-foreground text-center py-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Click <strong>Run Monte Carlo</strong> to estimate risk across {TARGET_CYCLES.toLocaleString()} rapid cycles using current settings.
              This runs independently from the animated simulation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
