import {
  getSeason,
  getWeather,
  getTyphoonSeverity,
  WeatherType,
  TyphoonSeverity,
  IrrigationType,
  ENSOState,
  Season,
} from './simulation';

// --------------------------------------------------

export type SimStatus = 'idle' | 'running' | 'paused' | 'finished';
export type SimMode = 'day' | 'cycle';

export interface EngineParams {
  plantingMonth: number;       // 1-12
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;  // 0-40 (%)
  cyclesTarget: number;
  daysPerCycle: number;        // default 120
}

export interface HistogramBin {
  label: string;   // e.g. "2.0"
  count: number;
}

export interface CycleRecord {
  cycleIndex: number;
  yieldTons: number;
  yieldSacks: number;
  season: Season;
  weather: WeatherType;
  dominantTyphoonSeverity: TyphoonSeverity | null;
  typhoonDays: number;
  severeTyphoonDays: number;
  ensoState: ENSOState;
  irrigationType: IrrigationType;
  plantingMonth: number;
  typhoonProbability: number;
}

export interface EngineSnapshot {
  status: SimStatus;
  mode: SimMode;
  speedMultiplier: number;
  params: EngineParams;
  pendingParams: Partial<EngineParams>;

  // runtime
  currentCycleIndex: number;
  currentDay: number;
  dayProgress: number;   // 0-1 within cycle
  runProgress: number;   // 0-1 across all cycles

  // derived live
  currentWeather: WeatherType | null;
  currentYield: number | null;
  currentCycleWeatherTimeline: WeatherType[];

  // running stats (Welford)
  runningMean: number;
  runningSd: number;
  lowYieldProb: number;

  // history arrays (throttled)
  yieldHistoryOverTime: number[];     // mean yield up to each cycle
  recentYields: number[];             // last 60 raw yields
  yieldSeries: { cycle: number; yield: number }[];
  yieldBandSeries: { cycle: number; mean: number; p5: number; p95: number }[];
  cycleRecords: CycleRecord[];

  // weather counts
  weatherCounts: Record<WeatherType, number>;
  dailyWeatherCounts: Record<WeatherType, number>;
  dailyTyphoonSeverityCounts: Record<TyphoonSeverity, number>;

  // histogram bins
  histogramBins: HistogramBin[];

  // summary (cached on cycle completion)
  summary: {
    mean: number; std: number; min: number; max: number;
    percentile5: number; percentile95: number;
    ciLow: number; ciHigh: number; ciWidth: number;
    deterministicSd: number; noiseSd: number;
  } | null;
}

type Listener = (snap: EngineSnapshot) => void;

// --------------------------------------------------

const BINS_STEP = 0.5;
const BINS_MAX = 5.5;
const MAX_SERIES = 400;

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

// --------------------------------------------------

const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0, Normal: 3.0, Wet: 3.3, Typhoon: 1.2,
};
const TYPHOON_YIELDS: Record<TyphoonSeverity, number> = {
  Moderate: 1.4,
  Severe: 0.8,
};
const IRRIGATION_ADJ: Record<IrrigationType, number> = { Irrigated: 0.3, Rainfed: 0 };
const ENSO_ADJ: Record<ENSOState, number> = { 'El Niño': -0.4, Neutral: 0, 'La Niña': 0.3 };

function gaussianNoise(mean = 0, sd = 0.2): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function computeYield(weather: WeatherType, p: EngineParams, typhoonSeverity: TyphoonSeverity | null) {
  const base = weather === 'Typhoon' && typhoonSeverity
    ? TYPHOON_YIELDS[typhoonSeverity]
    : BASE_YIELDS[weather];
  const adj = IRRIGATION_ADJ[p.irrigationType] + ENSO_ADJ[p.ensoState];
  const deterministic = base + adj;
  const noise = gaussianNoise();
  const final = Math.max(0, deterministic + noise);
  return { final, deterministic, noise, base };
}

// --------------------------------------------------

class SimulationEngine {
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private accumulatedMs = 0;
  private cycleElapsedMs = 0;

  // live state
  private status: SimStatus = 'idle';
  private mode: SimMode = 'day';
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
  private currentCycleWeatherTimeline: WeatherType[] = [];
  private cycleWeatherSequence: WeatherType[] = [];

  // Welford running stats
  private welfordCount = 0;
  private welfordMean = 0;
  private welfordM2 = 0;
  private deterministicMean = 0;
  private deterministicM2 = 0;
  private noiseMean = 0;
  private noiseM2 = 0;
  private lowYieldCount = 0;
  private minYield = Infinity;
  private maxYield = -Infinity;

  // history
  private yieldHistoryOverTime: number[] = [];
  private recentYields: number[] = [];
  private allYields: number[] = [];
  private yieldSeries: { cycle: number; yield: number }[] = [];
  private yieldBandSeries: { cycle: number; mean: number; p5: number; p95: number }[] = [];
  private cycleRecords: CycleRecord[] = [];

  // weather counts
  private weatherCounts: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
  private dailyWeatherCounts: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
  private dailyTyphoonSeverityCounts: Record<TyphoonSeverity, number> = { Moderate: 0, Severe: 0 };

  // histogram
  private histogramBins: HistogramBin[] = initBins();

  private summaryCache: EngineSnapshot['summary'] = null;

  // per-cycle weather (accumulated over days)
  private cycleWeatherAccum: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
  private cycleTyphoonSeverityCounts: Record<TyphoonSeverity, number> = { Moderate: 0, Severe: 0 };
  private cycleTyphoonSeveritySequence: (TyphoonSeverity | null)[] = [];

  // throttle emissions
  private lastEmitTime = 0;
  private readonly EMIT_INTERVAL_MS = 50; // ~20 fps

// --------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EngineSnapshot {
    return this.snapshot();
  }

  start() {
    this.mode = 'day';
    this.resetInternals();
    this.status = 'running';
    this.lastTime = null;
    this.accumulatedMs = 0;
    this.loop();
    this.emit(true);
  }

  startInstant() {
    this.mode = 'cycle';
    this.resetInternals();
    this.status = 'running';
    this.lastTime = null;
    this.accumulatedMs = 0;
    this.cycleElapsedMs = 0;
    this.prepareCycle();
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
    this.speedMultiplier = Math.max(0.5, multiplier);
    this.emit(true);
  }

  /** Some params apply immediately; lifecycle params apply on next cycle rollover */
  updateParams(partial: Partial<EngineParams>) {
    // Immediately applicable: typhoonProbability, speedMultiplier (already separate)
    const { typhoonProbability, ...rest } = partial;
    if (typhoonProbability !== undefined) {
      this.params = { ...this.params, typhoonProbability };
    }
    const isActive = this.status === 'running' || this.status === 'paused';
    if (!isActive) {
      this.params = { ...this.params, ...rest };
      this.pendingParams = {};
    } else if (Object.keys(rest).length > 0) {
      // Defer the rest to next cycle
      this.pendingParams = { ...this.pendingParams, ...rest };
    }
    this.emit(true);
  }

// --------------------------------------------------

  private resetInternals() {
    this.currentCycleIndex = 0;
    this.currentDay = 0;
    this.currentWeather = null;
    this.currentYield = null;
    this.currentCycleWeatherTimeline = [];
    this.cycleWeatherSequence = [];
    this.welfordCount = 0;
    this.welfordMean = 0;
    this.welfordM2 = 0;
    this.deterministicMean = 0;
    this.deterministicM2 = 0;
    this.noiseMean = 0;
    this.noiseM2 = 0;
    this.lowYieldCount = 0;
    this.minYield = Infinity;
    this.maxYield = -Infinity;
    this.yieldHistoryOverTime = [];
    this.recentYields = [];
    this.allYields = [];
    this.yieldSeries = [];
    this.yieldBandSeries = [];
    this.cycleRecords = [];
    this.summaryCache = null;
    this.weatherCounts = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.dailyWeatherCounts = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.dailyTyphoonSeverityCounts = { Moderate: 0, Severe: 0 };
    this.histogramBins = initBins();
    this.cycleWeatherAccum = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.cycleTyphoonSeverityCounts = { Moderate: 0, Severe: 0 };
    this.cycleTyphoonSeveritySequence = [];
    this.accumulatedMs = 0;
    this.cycleElapsedMs = 0;
    // commit pending
    this.params = { ...this.params, ...this.pendingParams };
    this.pendingParams = {};
  }

  private loop = () => {
    this.rafId = requestAnimationFrame((now: number) => {
      if (this.status !== 'running') return;

      const delta = this.lastTime === null ? 16 : now - this.lastTime;
      this.lastTime = now;

      if (this.mode === 'day') {
        // ms needed to advance one day: base is 1000ms/day at 1x
        const msPerDay = 1000 / this.speedMultiplier;
        this.accumulatedMs += delta;

        while (this.accumulatedMs >= msPerDay && this.status === 'running') {
          this.accumulatedMs -= msPerDay;
          this.tickDay();
        }
      } else {
        this.tickCycle(delta);
      }

      const now2 = performance.now();
      if (now2 - this.lastEmitTime >= this.EMIT_INTERVAL_MS) {
        this.emit(false);
        this.lastEmitTime = now2;
      }

      if (this.status === 'running') this.loop();
    });
  };

  private tickDay() {
    if (this.currentCycleIndex >= this.params.cyclesTarget) {
      this.finish();
      return;
    }

    const season = getSeason(this.params.plantingMonth);
    const weather = getWeather(this.params.plantingMonth, this.params.typhoonProbability / 100);
    let typhoonSeverity: TyphoonSeverity | null = null;
    if (weather === 'Typhoon') {
      typhoonSeverity = getTyphoonSeverity();
      this.cycleTyphoonSeverityCounts[typhoonSeverity]++;
      this.dailyTyphoonSeverityCounts[typhoonSeverity]++;
    }

    this.currentDay++;
    this.currentWeather = weather;
    this.cycleWeatherAccum[weather]++;
    this.dailyWeatherCounts[weather]++;
    this.currentCycleWeatherTimeline.push(weather);
    if (this.currentCycleWeatherTimeline.length > this.params.daysPerCycle) {
      this.currentCycleWeatherTimeline.shift();
    }

    if (this.currentDay >= this.params.daysPerCycle) {
      const dominantWeather = this.getDominantWeather();
      this.finalizeCycle(season, dominantWeather);
    }
  }

  private tickCycle(deltaMs: number) {
    if (this.currentCycleIndex >= this.params.cyclesTarget) {
      this.finish();
      return;
    }

    if (this.cycleWeatherSequence.length === 0) {
      this.prepareCycle();
    }

    const cycleMs = this.cycleDurationMs();
    this.cycleElapsedMs += deltaMs;

    while (this.cycleElapsedMs >= cycleMs && this.status === 'running') {
      this.currentDay = this.params.daysPerCycle;
      this.currentCycleWeatherTimeline = [...this.cycleWeatherSequence];
      const dominantWeather = this.getDominantWeather();
      const season = getSeason(this.params.plantingMonth);
      this.finalizeCycle(season, dominantWeather);

      if (this.currentCycleIndex >= this.params.cyclesTarget) {
        this.finish();
        return;
      }

      this.cycleElapsedMs -= cycleMs;
      this.prepareCycle();
    }

    const progress = Math.min(1, this.cycleElapsedMs / cycleMs);
    const dayIndex = Math.min(this.params.daysPerCycle, Math.floor(progress * this.params.daysPerCycle));
    if (dayIndex !== this.currentDay) {
      this.currentDay = dayIndex;
      const idx = Math.max(0, dayIndex - 1);
      this.currentWeather = this.cycleWeatherSequence[idx] ?? this.currentWeather;
      this.currentCycleWeatherTimeline = this.cycleWeatherSequence.slice(0, dayIndex);
    }
  }

  private getDominantWeather(): WeatherType {
    const counts = this.cycleWeatherAccum;
    return (Object.keys(counts) as WeatherType[]).reduce((a, b) =>
      counts[a] >= counts[b] ? a : b
    );
  }

  private cycleDurationMs() {
    const base = 300;
    const adjusted = base / this.speedMultiplier;
    return Math.min(500, Math.max(200, adjusted));
  }

  private prepareCycle() {
    const tProb = this.params.typhoonProbability / 100;
    this.cycleWeatherSequence = [];
    this.cycleWeatherAccum = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.cycleTyphoonSeverityCounts = { Moderate: 0, Severe: 0 };
    this.cycleTyphoonSeveritySequence = [];
    for (let d = 0; d < this.params.daysPerCycle; d++) {
      const w = getWeather(this.params.plantingMonth, tProb);
      this.cycleWeatherSequence.push(w);
      this.cycleWeatherAccum[w]++;
      if (w === 'Typhoon') {
        const severity = getTyphoonSeverity();
        this.cycleTyphoonSeverityCounts[severity]++;
        this.cycleTyphoonSeveritySequence.push(severity);
      } else {
        this.cycleTyphoonSeveritySequence.push(null);
      }
    }
    this.currentDay = 0;
    this.currentWeather = this.cycleWeatherSequence[0] ?? null;
    this.currentCycleWeatherTimeline = [];
  }

  private finalizeCycle(season: Season, dominantWeather: WeatherType) {
    const typhoonDays = this.cycleTyphoonSeverityCounts.Moderate + this.cycleTyphoonSeverityCounts.Severe;
    const dominantTyphoonSeverity =
      dominantWeather === 'Typhoon' && typhoonDays > 0
        ? (this.cycleTyphoonSeverityCounts.Severe >= this.cycleTyphoonSeverityCounts.Moderate ? 'Severe' : 'Moderate')
        : null;

    const { final: yld, deterministic, noise } = computeYield(dominantWeather, this.params, dominantTyphoonSeverity);
    this.currentYield = yld;

    this.weatherCounts[dominantWeather]++;
    if (this.mode === 'cycle') {
      (Object.keys(this.cycleWeatherAccum) as WeatherType[]).forEach((key) => {
        this.dailyWeatherCounts[key] += this.cycleWeatherAccum[key];
      });
      (Object.keys(this.cycleTyphoonSeverityCounts) as TyphoonSeverity[]).forEach((key) => {
        this.dailyTyphoonSeverityCounts[key] += this.cycleTyphoonSeverityCounts[key];
      });
    }

    this.welfordCount++;
    const delta = yld - this.welfordMean;
    this.welfordMean += delta / this.welfordCount;
    const delta2 = yld - this.welfordMean;
    this.welfordM2 += delta * delta2;

    const dDelta = deterministic - this.deterministicMean;
    this.deterministicMean += dDelta / this.welfordCount;
    const dDelta2 = deterministic - this.deterministicMean;
    this.deterministicM2 += dDelta * dDelta2;

    const nDelta = noise - this.noiseMean;
    this.noiseMean += nDelta / this.welfordCount;
    const nDelta2 = noise - this.noiseMean;
    this.noiseM2 += nDelta * nDelta2;

    if (yld < 2.0) this.lowYieldCount++;
    if (yld < this.minYield) this.minYield = yld;
    if (yld > this.maxYield) this.maxYield = yld;

    this.allYields.push(yld);
    addToBin(this.histogramBins, yld);

    this.yieldHistoryOverTime = [...this.yieldHistoryOverTime, this.welfordMean].slice(-MAX_SERIES);
    this.yieldSeries = [...this.yieldSeries, { cycle: this.currentCycleIndex + 1, yield: yld }].slice(-MAX_SERIES);
    this.recentYields = [...this.recentYields.slice(-59), yld];

    const cycleRecord: CycleRecord = {
      cycleIndex: this.currentCycleIndex + 1,
      yieldTons: yld,
      yieldSacks: yld * 20,
      season,
      weather: dominantWeather,
      dominantTyphoonSeverity,
      typhoonDays,
      severeTyphoonDays: this.cycleTyphoonSeverityCounts.Severe,
      ensoState: this.params.ensoState,
      irrigationType: this.params.irrigationType,
      plantingMonth: this.params.plantingMonth,
      typhoonProbability: this.params.typhoonProbability,
    };
    this.cycleRecords = [...this.cycleRecords, cycleRecord];
    this.summaryCache = this.computeSummary();
    if (this.summaryCache) {
      const { mean, percentile5, percentile95 } = this.summaryCache;
      this.yieldBandSeries = [...this.yieldBandSeries, {
        cycle: this.currentCycleIndex + 1,
        mean,
        p5: percentile5,
        p95: percentile95,
      }].slice(-MAX_SERIES);
    }

    // Commit pending params on cycle rollover
    this.params = { ...this.params, ...this.pendingParams };
    this.pendingParams = {};

    this.currentCycleIndex++;
    this.currentDay = 0;
    this.cycleWeatherAccum = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
    this.cycleTyphoonSeverityCounts = { Moderate: 0, Severe: 0 };
    this.cycleTyphoonSeveritySequence = [];
    this.currentCycleWeatherTimeline = [];
    this.cycleWeatherSequence = [];
  }

  private finish() {
    this.status = 'finished';
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.summaryCache = this.computeSummary();
    this.emit(true);
  }

  private welfordSd(): number {
    if (this.welfordCount < 2) return 0;
    return Math.sqrt(this.welfordM2 / this.welfordCount);
  }

  private deterministicSd(): number {
    if (this.welfordCount < 2) return 0;
    return Math.sqrt(this.deterministicM2 / this.welfordCount);
  }

  private noiseSd(): number {
    if (this.welfordCount < 2) return 0;
    return Math.sqrt(this.noiseM2 / this.welfordCount);
  }

  private computeSummary() {
    if (this.allYields.length === 0) return null;
    const sorted = [...this.allYields].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = this.welfordMean;
    const sd = this.welfordSd();
    const se = n > 0 ? sd / Math.sqrt(n) : 0;
    const ciLow = mean - 1.96 * se;
    const ciHigh = mean + 1.96 * se;
    return {
      mean,
      std: sd,
      min: this.minYield === Infinity ? 0 : this.minYield,
      max: this.maxYield === -Infinity ? 0 : this.maxYield,
      percentile5: sorted[Math.floor(n * 0.05)] ?? 0,
      percentile95: sorted[Math.floor(n * 0.95)] ?? 0,
      ciLow,
      ciHigh,
      ciWidth: ciHigh - ciLow,
      deterministicSd: this.deterministicSd(),
      noiseSd: this.noiseSd(),
    };
  }

  private snapshot(): EngineSnapshot {
    const n = this.welfordCount;
    return {
      status: this.status,
      mode: this.mode,
      speedMultiplier: this.speedMultiplier,
      params: { ...this.params },
      pendingParams: { ...this.pendingParams },

      currentCycleIndex: this.currentCycleIndex,
      currentDay: this.currentDay,
      dayProgress: this.params.daysPerCycle > 0 ? this.currentDay / this.params.daysPerCycle : 0,
      runProgress: this.params.cyclesTarget > 0 ? this.currentCycleIndex / this.params.cyclesTarget : 0,

      currentWeather: this.currentWeather,
      currentYield: this.currentYield,
      currentCycleWeatherTimeline: [...this.currentCycleWeatherTimeline],

      runningMean: this.welfordMean,
      runningSd: this.welfordSd(),
      lowYieldProb: n > 0 ? this.lowYieldCount / n : 0,

      yieldHistoryOverTime: [...this.yieldHistoryOverTime],
      recentYields: [...this.recentYields],
      yieldSeries: this.yieldSeries.map((p) => ({ ...p })),
      yieldBandSeries: this.yieldBandSeries.map((p) => ({ ...p })),
      cycleRecords: this.cycleRecords.map((r) => ({ ...r })),

      weatherCounts: { ...this.weatherCounts },
      dailyWeatherCounts: { ...this.dailyWeatherCounts },
      dailyTyphoonSeverityCounts: { ...this.dailyTyphoonSeverityCounts },
      histogramBins: this.histogramBins.map(b => ({ ...b })),

      summary: this.summaryCache,
    };
  }

  private emit(force: boolean) {
    const snap = this.snapshot();
    this.listeners.forEach(l => l(snap));
  }
}

// --------------------------------------------------

export const engine = new SimulationEngine();
