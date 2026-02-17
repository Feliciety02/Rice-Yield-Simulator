import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import WeatherScene from './WeatherScene';
import {
  SimulationParams,
  CycleResult,
  simulateCycle,
  IrrigationType,
  ENSOState,
  SimulationResults,
  computeResults,
} from '@/lib/simulation';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface SimulationTabProps {
  onComplete: (results: SimulationResults) => void;
}

export default function SimulationTab({ onComplete }: SimulationTabProps) {
  const [params, setParams] = useState<SimulationParams>({
    plantingMonth: 6,
    irrigationType: 'Irrigated',
    ensoState: 'Neutral',
    typhoonProbability: 15,
    numCycles: 100,
  });

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(200); // ms per cycle
  const [cycles, setCycles] = useState<CycleResult[]>([]);
  const [currentCycle, setCurrentCycle] = useState<CycleResult | null>(null);
  const [growthProgress, setGrowthProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const avgYield = cycles.length > 0
    ? cycles.reduce((s, c) => s + c.finalYield, 0) / cycles.length
    : 0;

  const stop = useCallback(() => {
    if (intervalRef.current) clearTimeout(intervalRef.current as unknown as number);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setCycles([]);
    setCurrentCycle(null);
    setGrowthProgress(0);
  }, [stop]);

  const start = useCallback(() => {
    reset();
    setRunning(true);
    let i = 0;
    const allCycles: CycleResult[] = [];

    const tick = () => {
      if (i >= params.numCycles) {
        setRunning(false);
        onComplete(computeResults(allCycles));
        return;
      }
      const cycle = simulateCycle(i + 1, params);
      allCycles.push(cycle);
      setCycles([...allCycles]);
      setCurrentCycle(cycle);
      setGrowthProgress((i % 10) / 10);
      i++;
      intervalRef.current = setTimeout(tick, speedRef.current) as unknown as ReturnType<typeof setInterval>;
    };
    tick();
  }, [params, reset, onComplete]);

  const runInstant = useCallback(() => {
    reset();
    const allCycles: CycleResult[] = [];
    for (let i = 0; i < params.numCycles; i++) {
      allCycles.push(simulateCycle(i + 1, params));
    }
    setCycles(allCycles);
    setCurrentCycle(allCycles[allCycles.length - 1]);
    setGrowthProgress(1);
    onComplete(computeResults(allCycles));
  }, [params, reset, onComplete]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls */}
      <Card className="lg:col-span-1 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Simulation Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Planting Month</Label>
            <Select
              value={String(params.plantingMonth)}
              onValueChange={(v) => setParams((p) => ({ ...p, plantingMonth: Number(v) }))}
              disabled={running}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Irrigation Type</Label>
            <Select
              value={params.irrigationType}
              onValueChange={(v) => setParams((p) => ({ ...p, irrigationType: v as IrrigationType }))}
              disabled={running}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Irrigated">Irrigated</SelectItem>
                <SelectItem value="Rainfed">Rainfed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ENSO State</Label>
            <Select
              value={params.ensoState}
              onValueChange={(v) => setParams((p) => ({ ...p, ensoState: v as ENSOState }))}
              disabled={running}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="El Niño">El Niño</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="La Niña">La Niña</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Typhoon Probability: {params.typhoonProbability}%</Label>
            <Slider
              value={[params.typhoonProbability]}
              onValueChange={([v]) => setParams((p) => ({ ...p, typhoonProbability: v }))}
              min={0}
              max={40}
              step={1}
              disabled={running}
            />
          </div>

          <div className="space-y-2">
            <Label>Crop Cycles: {params.numCycles}</Label>
            <Slider
              value={[params.numCycles]}
              onValueChange={([v]) => setParams((p) => ({ ...p, numCycles: v }))}
              min={1}
              max={500}
              step={1}
              disabled={running}
            />
          </div>

          <div className="space-y-2">
            <Label>Speed: {speed <= 20 ? 'Max' : speed >= 400 ? 'Slow' : speed <= 100 ? 'Fast' : 'Normal'} ({speed}ms/cycle)</Label>
            <Slider
              value={[speed]}
              onValueChange={([v]) => setSpeed(v)}
              min={10}
              max={500}
              step={10}
            />
          </div>

          {running && cycles.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round((cycles.length / params.numCycles) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150 rounded-full"
                  style={{ width: `${(cycles.length / params.numCycles) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={start} disabled={running} className="flex-1 gap-2">
              <Play className="w-4 h-4" /> Animate
            </Button>
            <Button onClick={runInstant} disabled={running} variant="secondary" className="flex-1 gap-2">
              <Zap className="w-4 h-4" /> Instant
            </Button>
          </div>
          <div className="flex gap-2">
            {running && (
              <Button onClick={stop} variant="destructive" className="flex-1 gap-2">
                <Pause className="w-4 h-4" /> Stop
              </Button>
            )}
            <Button onClick={reset} variant="outline" className="flex-1 gap-2">
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visualization */}
      <div className="lg:col-span-2 space-y-4">
        <WeatherScene
          weather={currentCycle?.weather ?? null}
          growthProgress={growthProgress}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {[
              { label: 'Cycle', value: currentCycle ? `${currentCycle.cycle} / ${params.numCycles}` : '—' },
              { label: 'Season', value: currentCycle?.season ?? '—' },
              { label: 'Current Yield', value: currentCycle ? `${currentCycle.finalYield.toFixed(2)} t/ha` : '—' },
              { label: 'Avg Yield', value: cycles.length > 0 ? `${avgYield.toFixed(2)} t/ha` : '—' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-lg p-3 border border-border"
              >
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="text-lg font-bold font-['Space_Grotesk']">{stat.value}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Mini yield history */}
        {cycles.length > 0 && (
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-2">Yield History (last 50 cycles)</div>
              <div className="flex items-end gap-[2px] h-20">
                {cycles.slice(-50).map((c, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${(c.finalYield / 5) * 100}%`,
                      backgroundColor:
                        c.finalYield < 2
                          ? 'hsl(var(--destructive))'
                          : c.finalYield < 3
                          ? 'hsl(var(--warning))'
                          : 'hsl(var(--primary))',
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
