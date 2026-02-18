import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import WeatherScene from './WeatherScene';
import { useSimulation } from '@/context/SimulationContext';
import { IrrigationType, ENSOState } from '@/lib/simulation';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const SPEED_LABELS: Record<number, string> = {
  0.5: '0.5×',
  1: '1×',
  2: '2×',
  5: '5×',
  10: '10×',
  20: '20×',
};

export default function SimulationTab() {
  const { snap, start, pause, resume, reset, setSpeed, updateParams } = useSimulation();
  const { status, params, pendingParams, speedMultiplier, currentCycleIndex,
    currentDay, dayProgress, runProgress, currentWeather, currentYield,
    runningMean, recentYields } = snap;

  const isRunning = status === 'running';
  const isPaused  = status === 'paused';
  const isActive  = isRunning || isPaused;
  const isIdle    = status === 'idle';
  const isFinished = status === 'finished';

  // Resolved display params (pending overrides shown for non-live fields)
  const displayParams = { ...params, ...pendingParams };

  const handleInstant = () => {
    // Use high speed (effectively instant by running the engine at max speed)
    // Actually, for instant we run a batch. Reuse engine's normal flow at 1000x.
    reset();
    setSpeed(1000);
    start();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls */}
      <Card className="lg:col-span-1 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Simulation Controls</CardTitle>
          {isActive && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
              {isRunning ? 'Running — switch tabs freely' : 'Paused'}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Planting Month */}
          <div className="space-y-2">
            <Label>Planting Month
              {isActive && pendingParams.plantingMonth !== undefined && (
                <span className="ml-2 text-[10px] text-warning">(queued)</span>
              )}
            </Label>
            <Select
              value={String(displayParams.plantingMonth)}
              onValueChange={(v) => updateParams({ plantingMonth: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Irrigation */}
          <div className="space-y-2">
            <Label>Irrigation Type
              {isActive && pendingParams.irrigationType !== undefined && (
                <span className="ml-2 text-[10px] text-warning">(queued)</span>
              )}
            </Label>
            <Select
              value={displayParams.irrigationType}
              onValueChange={(v) => updateParams({ irrigationType: v as IrrigationType })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Irrigated">Irrigated</SelectItem>
                <SelectItem value="Rainfed">Rainfed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ENSO */}
          <div className="space-y-2">
            <Label>ENSO State
              {isActive && pendingParams.ensoState !== undefined && (
                <span className="ml-2 text-[10px] text-warning">(queued)</span>
              )}
            </Label>
            <Select
              value={displayParams.ensoState}
              onValueChange={(v) => updateParams({ ensoState: v as ENSOState })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="El Niño">El Niño</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="La Niña">La Niña</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Typhoon Prob — live */}
          <div className="space-y-2">
            <Label>Typhoon Probability: {params.typhoonProbability}%
              <span className="ml-2 text-[10px] text-primary">(live)</span>
            </Label>
            <Slider
              value={[params.typhoonProbability]}
              onValueChange={([v]) => updateParams({ typhoonProbability: v })}
              min={0} max={40} step={1}
            />
          </div>

          {/* Cycles */}
          <div className="space-y-2">
            <Label>Crop Cycles: {displayParams.cyclesTarget}
              {isActive && pendingParams.cyclesTarget !== undefined && (
                <span className="ml-2 text-[10px] text-warning">(queued)</span>
              )}
            </Label>
            <Slider
              value={[displayParams.cyclesTarget]}
              onValueChange={([v]) => updateParams({ cyclesTarget: v })}
              min={10} max={1000} step={10}
              disabled={isActive}
            />
          </div>

          {/* Speed */}
          <div className="space-y-2">
            <Label>Speed: {speedMultiplier}× ({speedMultiplier} day/s)</Label>
            <Slider
              value={[speedMultiplier]}
              onValueChange={([v]) => setSpeed(v)}
              min={0.5} max={20} step={0.5}
            />
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
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cycle progress (day {currentDay}/{params.daysPerCycle})</span>
                  <span>{Math.round(dayProgress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-100 rounded-full"
                    style={{ width: `${dayProgress * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Run progress ({currentCycleIndex}/{params.cyclesTarget} cycles)</span>
                  <span>{Math.round(runProgress * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-150 rounded-full"
                    style={{ width: `${runProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2 flex-wrap">
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

      {/* Visualization */}
      <div className="lg:col-span-2 space-y-4">
        <WeatherScene
          weather={currentWeather}
          growthProgress={dayProgress}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {[
              { label: 'Cycle', value: isActive || isFinished ? `${currentCycleIndex} / ${params.cyclesTarget}` : '—' },
              { label: 'Season', value: currentWeather ?? '—' },
              { label: 'Current Yield', value: currentYield != null ? `${currentYield.toFixed(2)} t/ha` : '—' },
              { label: 'Running Mean', value: runningMean > 0 ? `${runningMean.toFixed(2)} t/ha` : '—' },
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

        {/* Recent yield history */}
        {recentYields.length > 0 && (
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-2">
                Yield History — last {recentYields.length} cycles
                {isRunning && <span className="ml-2 text-primary animate-pulse">● live</span>}
              </div>
              <div className="flex items-end gap-[2px] h-20">
                {recentYields.map((y, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-100"
                    style={{
                      height: `${Math.min((y / 5) * 100, 100)}%`,
                      backgroundColor:
                        y < 2
                          ? 'hsl(var(--destructive))'
                          : y < 3
                          ? 'hsl(var(--warning))'
                          : 'hsl(var(--primary))',
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isIdle && (
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground text-sm">Press Animate or Instant to begin the simulation</p>
          </div>
        )}
      </div>
    </div>
  );
}
