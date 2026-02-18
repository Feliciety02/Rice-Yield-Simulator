import { getSeason, getWeather, WeatherType, IrrigationType, ENSOState } from './simulation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface EngineParams {
  plantingMonth: number;       // 1–12
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;  // 0–40 (%)
  cyclesTarget: number;
  daysPerCycle: number;        // default 120
}

export interface HistogramBin {
  label: string;   // e.g. "2.0"
  count: number;
}

export interface EngineSnapshot {
  status: SimStatus;
  speedMultiplier: number;
  params: EngineParams;
  pendingParams: Partial<EngineParams>;

  // runtime
  currentCycleIndex: number;
  currentDay: number;
  dayProgress: number;   // 0–1 within cycle
  runProgress: number;   // 0–1 across all cycles

  // derived live
  currentWeather: WeatherType | null;
  currentYield: number | null;

  // running stats (Welford)
  runningMean: number;
  runningSd: number;
  lowYieldProb: number;

  // history arrays (throttled)
  yieldHistoryOverTime: number[];     // mean yield up to each cycle
  recentYields: number[];             // last 60 raw yields

  // weather counts
  weatherCounts: Record<WeatherType, number>;

  // histogram bins
  histogramBins: HistogramBin[];

  // summary (computed on finish or on demand)
  summary: {
    mean: number; std: number; min: number; max: number;
    percentile5: number; percentile95: number;
    ciLow: number; ciHigh: number;
  } | null;
}

type Listener = (snap: EngineSnapshot) => void;

// ─── Histogram helpers ────────────────────────────────────────────────────────

const BINS_STEP = 0.5;
const BINS_MAX = 5.5;

function initBins(): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let v = 0; v < BINS_MAX; v += BINS_STEP) {
    bins.push({ label: v.toFixed(1), count: 0 });
  }
  return bins;
}

function addToBin(bins: HistogramBin[], y: number) {
  const idx = Math.min(Math.floor(y / BINS_STEP), bins.length - 1);
  if (idx >= 0) bins[idx].count++;
}

// ─── Yield model ──────────────────────────────────────────────────────────────

const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0, Normal: 3.0, Wet: 3.3, Typhoon: 1.2,
};
const IRRIGATION_ADJ: Record<IrrigationType, number> = { Irrigated: 0.3, Rainfed: 0 };
const ENSO_ADJ: Record<ENSOState, number> = { 'El Niño': -0.4, Neutral: 0, 'La Niña': 0.3 };

function gaussianNoise(mean = 0, sd = 0.2): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function computeYield(weather: WeatherType, p: EngineParams): number {
  const base = BASE_YIELDS[weather];
  const adj = IRRIGATION_ADJ[p.irrigationType] + ENSO_ADJ[p.ensoState];
  return Math.max(0, base + adj + gaussianNoise());
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class SimulationEngine {
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private accumulatedMs = 0;

  // live state
  private status: SimStatus = 'idle';
  private speedMultiplier = 1;

  private params: EngineParams = {
    plantingMonth: 6,
    irrigationType: 'Irrigated',
    ensoState: 'Neutral',
    typhoonProbability: 15,
    cyclesTarget: 100,
    daysPerCycle: 120,
  };
  private pendingParams: Partial<EngineParams> = {};

  // runtime
  private currentCycleIndex = 0;
  private currentDay = 0;
  private currentWeather: WeatherType | null = null;
  private currentYield: number | null = null;

  // Welford running stats
  private welfordCount = 0;
  private welfordMean = 0;
  private welfordM2 = 0;
  private lowYieldCount = 0;
  private minYield = Infinity;
  private maxYield = -Infinity;

  // history
  private yieldHistoryOverTime: number[] = [];
  private recentYields: number[] = [];
  private allYields: number[] = [];

  // weather counts
  private weatherCounts: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };

  // histogram
  private histogramBins: HistogramBin[] = initBins();

  // per-cycle weather (accumulated over days)
  private cycleWeatherAccum: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };

  // throttle emissions
  private lastEmitTime = 0;
  private readonly EMIT_INTERVAL_MS = 50; // ~20 fps

  // ─── Public API ─────────────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EngineSnapshot {
    return this.snapshot();
  }

  start() {
    this.resetInternals();
    this.status = 'running';
    this.lastTime = null;
    this.accumulatedMs = 0;
    this.loop();
    this.emit(true);
  }

  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.emit(true);
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.lastTime = null;
    this.loop();
    this.emit(true);
  }

  reset() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.status = 'idle';
    this.resetInternals();
    this.emit(true);
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.1, multiplier);
    this.emit(true);
  }

  /** Some params apply immediately; lifecycle params apply on next cycle rollover */
  updateParams(partial: Partial<EngineParams>) {
    // Immediately applicable: typhoonProbability, speedMultiplier (already separate)
    const { typhoonProbability, ...rest } = partial;
    if (typhoonProbability !== undefined) {
      this.params = { ...this.params, typhoonProbability };
    }
    // Defer the rest to next cycle
    if (Object.keys(rest).length > 0) {
      this.pendingParams = { ...this.pendingParams, ...rest };
    }
    this.emit(true);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private resetInternals() {
    this.currentCycleIndex = 0;
    this.currentDay = 0;
    this.currentWeather = null;
    this.currentYield = null;
    this.welfordCount = 0;
    this.welfordMean = 0;
    this.welfordM2 = 0;
    this.lowYieldCount = 0;
    this.minYield = Infinity;
    this.maxYield = -Infinity;
    this.yieldHistoryOverTime = [];
    this.recentYields = [];
    this.allYields = [];
    this.weatherCounts = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.histogramBins = initBins();
    this.cycleWeatherAccum = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.accumulatedMs = 0;
    // commit pending
    this.params = { ...this.params, ...this.pendingParams };
    this.pendingParams = {};
  }

  private loop = () => {
    this.rafId = requestAnimationFrame((now: number) => {
      if (this.status !== 'running') return;

      const delta = this.lastTime === null ? 16 : now - this.lastTime;
      this.lastTime = now;

      // ms needed to advance one day: base is 1000ms/day at 1x
      const msPerDay = 1000 / this.speedMultiplier;
      this.accumulatedMs += delta;

      while (this.accumulatedMs >= msPerDay && this.status === 'running') {
        this.accumulatedMs -= msPerDay;
        this.tick();
      }

      const now2 = performance.now();
      if (now2 - this.lastEmitTime >= this.EMIT_INTERVAL_MS) {
        this.emit(false);
        this.lastEmitTime = now2;
      }

      if (this.status === 'running') this.loop();
    });
  };

  private tick() {
    if (this.currentCycleIndex >= this.params.cyclesTarget) {
      this.finish();
      return;
    }

    const season = getSeason(this.params.plantingMonth);
    const weather = getWeather(season, this.params.typhoonProbability / 100);

    this.currentDay++;
    this.currentWeather = weather;
    this.cycleWeatherAccum[weather]++;

    if (this.currentDay >= this.params.daysPerCycle) {
      // Finalize cycle
      const dominantWeather = this.getDominantWeather();
      const yld = computeYield(dominantWeather, this.params);
      this.currentYield = yld;

      // Update weather counts
      this.weatherCounts[dominantWeather]++;

      // Welford update
      this.welfordCount++;
      const delta = yld - this.welfordMean;
      this.welfordMean += delta / this.welfordCount;
      const delta2 = yld - this.welfordMean;
      this.welfordM2 += delta * delta2;

      if (yld < 2.0) this.lowYieldCount++;
      if (yld < this.minYield) this.minYield = yld;
      if (yld > this.maxYield) this.maxYield = yld;

      this.allYields.push(yld);
      addToBin(this.histogramBins, yld);

      this.yieldHistoryOverTime.push(this.welfordMean);
      this.recentYields = [...this.recentYields.slice(-59), yld];

      // Commit pending params on cycle rollover
      this.params = { ...this.params, ...this.pendingParams };
      this.pendingParams = {};

      this.currentCycleIndex++;
      this.currentDay = 0;
      this.cycleWeatherAccum = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    }
  }

  private getDominantWeather(): WeatherType {
    const counts = this.cycleWeatherAccum;
    return (Object.keys(counts) as WeatherType[]).reduce((a, b) =>
      counts[a] >= counts[b] ? a : b
    );
  }

  private finish() {
    this.status = 'finished';
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.emit(true);
  }

  private welfordSd(): number {
    if (this.welfordCount < 2) return 0;
    return Math.sqrt(this.welfordM2 / this.welfordCount);
  }

  private computeSummary() {
    if (this.allYields.length === 0) return null;
    const sorted = [...this.allYields].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = this.welfordMean;
    const sd = this.welfordSd();
    const se = n > 0 ? sd / Math.sqrt(n) : 0;
    return {
      mean,
      std: sd,
      min: this.minYield === Infinity ? 0 : this.minYield,
      max: this.maxYield === -Infinity ? 0 : this.maxYield,
      percentile5: sorted[Math.floor(n * 0.05)] ?? 0,
      percentile95: sorted[Math.floor(n * 0.95)] ?? 0,
      ciLow: mean - 1.96 * se,
      ciHigh: mean + 1.96 * se,
    };
  }

  private snapshot(): EngineSnapshot {
    const n = this.welfordCount;
    return {
      status: this.status,
      speedMultiplier: this.speedMultiplier,
      params: { ...this.params },
      pendingParams: { ...this.pendingParams },

      currentCycleIndex: this.currentCycleIndex,
      currentDay: this.currentDay,
      dayProgress: this.params.daysPerCycle > 0 ? this.currentDay / this.params.daysPerCycle : 0,
      runProgress: this.params.cyclesTarget > 0 ? this.currentCycleIndex / this.params.cyclesTarget : 0,

      currentWeather: this.currentWeather,
      currentYield: this.currentYield,

      runningMean: this.welfordMean,
      runningSd: this.welfordSd(),
      lowYieldProb: n > 0 ? this.lowYieldCount / n : 0,

      yieldHistoryOverTime: [...this.yieldHistoryOverTime],
      recentYields: [...this.recentYields],

      weatherCounts: { ...this.weatherCounts },
      histogramBins: this.histogramBins.map(b => ({ ...b })),

      summary: this.computeSummary(),
    };
  }

  private emit(force: boolean) {
    const snap = this.snapshot();
    this.listeners.forEach(l => l(snap));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const engine = new SimulationEngine();
