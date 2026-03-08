export type WeatherType = 'Dry' | 'Normal' | 'Wet' | 'Typhoon';
export type TyphoonSeverity = 'Moderate' | 'Severe';
export type Season = 'Dry Season' | 'Wet Season' | 'Transition Season';
export type IrrigationType = 'Irrigated' | 'Rainfed';
export type ENSOState = 'El Niño' | 'Neutral' | 'La Niña';
export interface SimulationParams {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;
  numCycles: number;
  daysPerCycle?: number;
  seed?: number;
}

export const DEFAULT_DAYS_PER_CYCLE = 120;
export const NOISE_SD = 0.2;
export const SACKS_PER_TON = 20;
export const LOW_YIELD_THRESHOLD = 2.0;
export const HIGH_YIELD_THRESHOLD = 3.0;

export const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0,
  Normal: 3.0,
  Wet: 3.3,
  Typhoon: 1.2,
};

export const TYPHOON_YIELDS: Record<TyphoonSeverity, number> = {
  Moderate: 1.4,
  Severe: 0.8,
};

export const IRRIGATION_ADJ: Record<IrrigationType, number> = {
  Irrigated: 0.3,
  Rainfed: 0,
};

export const ENSO_ADJ: Record<ENSOState, number> = {
  'El Niño': -0.4,
  Neutral: 0,
  'La Niña': 0.3,
};

export interface CycleResult {
  cycle: number;
  weather: WeatherType;
  season: Season;
  typhoonSeverity: TyphoonSeverity | null;
  baseYield: number;
  finalYield: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
}

export interface SimulationResults {
  cycles: CycleResult[];
  meanYield: number;
  stdDev: number;
  minYield: number;
  maxYield: number;
  lowYieldProbability: number;
  weatherFrequencies: Record<WeatherType, number>;
  percentile5: number;
  percentile95: number;
  confidenceInterval: [number, number];
}

const DEFAULT_PROFILE: { wetStart: number; wetEnd: number; typhoonMultiplier: number; severity: Record<TyphoonSeverity, number> } = {
  wetStart: 6,
  wetEnd: 10,
  typhoonMultiplier: 1.2,
  severity: { Moderate: 0.6, Severe: 0.4 },
};

function wrapMonth(month: number) {
  if (month < 1) return month + 12;
  if (month > 12) return month - 12;
  return month;
}

export function getSeasonBlend(month: number) {
  const profile = DEFAULT_PROFILE;
  const inWet = month >= profile.wetStart && month <= profile.wetEnd;
  if (inWet) {
    return { dryWeight: 0, wetWeight: 1, label: 'Wet Season' as Season };
  }

  const transitions = new Map<number, number>([
    [wrapMonth(profile.wetStart - 1), 0.5],
    [wrapMonth(profile.wetStart - 2), 0.25],
    [wrapMonth(profile.wetEnd + 1), 0.5],
    [wrapMonth(profile.wetEnd + 2), 0.25],
  ]);

  const wetWeight = transitions.get(month) ?? 0;
  const dryWeight = 1 - wetWeight;
  const label: Season =
    wetWeight >= 0.6 ? 'Wet Season' :
    wetWeight <= 0.4 ? 'Dry Season' :
    'Transition Season';
  return { dryWeight, wetWeight, label };
}

export function getSeason(month: number): Season {
  return getSeasonBlend(month).label;
}

type RandomSource = () => number;

function createSeededRng(seed: number): RandomSource {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(mean: number, stdDev: number, rng: RandomSource = Math.random): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function getWeatherWeights(month: number, typhoonProb: number) {
  const profile = DEFAULT_PROFILE;
  const blend = getSeasonBlend(month);
  const tProb = Math.max(0, Math.min(0.6, typhoonProb * profile.typhoonMultiplier));
  const dryWeights = { Dry: 0.5, Normal: 0.4, Wet: 0.1, Typhoon: 0.05 };
  const wetWeights = { Dry: 0.1, Normal: 0.4, Wet: 0.35, Typhoon: tProb };

  const weights = {
    Dry: dryWeights.Dry * blend.dryWeight + wetWeights.Dry * blend.wetWeight,
    Normal: dryWeights.Normal * blend.dryWeight + wetWeights.Normal * blend.wetWeight,
    Wet: dryWeights.Wet * blend.dryWeight + wetWeights.Wet * blend.wetWeight,
    Typhoon: dryWeights.Typhoon * blend.dryWeight + wetWeights.Typhoon * blend.wetWeight,
  };
  const total = weights.Dry + weights.Normal + weights.Wet + weights.Typhoon;
  return {
    Dry: weights.Dry / total,
    Normal: weights.Normal / total,
    Wet: weights.Wet / total,
    Typhoon: weights.Typhoon / total,
  };
}

export function getWeather(month: number, typhoonProb: number, rng: RandomSource = Math.random): WeatherType {
  const weights = getWeatherWeights(month, typhoonProb);
  const r = rng();
  let acc = weights.Dry;
  if (r < acc) return 'Dry';
  acc += weights.Normal;
  if (r < acc) return 'Normal';
  acc += weights.Wet;
  if (r < acc) return 'Wet';
  return 'Typhoon';
}

export function getTyphoonSeverity(rng: RandomSource = Math.random): TyphoonSeverity {
  const weights = DEFAULT_PROFILE.severity;
  const r = rng();
  return r < weights.Severe ? 'Severe' : 'Moderate';
}

export function getTyphoonSeverityWeights() {
  return DEFAULT_PROFILE.severity;
}

function monthForDay(startMonth: number, dayIndex: number) {
  const date = new Date(2020, startMonth - 1, 1);
  date.setDate(date.getDate() + dayIndex);
  return date.getMonth() + 1;
}

export function simulateCycle(
  cycle: number,
  params: SimulationParams,
  rng: RandomSource = Math.random
): CycleResult {
  const season = getSeason(params.plantingMonth);
  const weatherCounts: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
  const typhoonSeverityCounts: Record<TyphoonSeverity, number> = { Moderate: 0, Severe: 0 };
  const daysPerCycle = params.daysPerCycle ?? DEFAULT_DAYS_PER_CYCLE;
  for (let d = 0; d < daysPerCycle; d++) {
    const month = monthForDay(params.plantingMonth, d);
    const w = getWeather(month, params.typhoonProbability / 100, rng);
    weatherCounts[w]++;
    if (w === 'Typhoon') {
      const severity = getTyphoonSeverity(rng);
      typhoonSeverityCounts[severity]++;
    }
  }
  const dominantWeather = (Object.keys(weatherCounts) as WeatherType[]).reduce((a, b) =>
    weatherCounts[a] >= weatherCounts[b] ? a : b
  );
  const typhoonDays = typhoonSeverityCounts.Moderate + typhoonSeverityCounts.Severe;
  const typhoonSeverity = typhoonDays > 0
    ? (typhoonSeverityCounts.Severe >= typhoonSeverityCounts.Moderate ? 'Severe' : 'Moderate')
    : null;
  const unclassifiedTyphoon = Math.max(0, weatherCounts.Typhoon - typhoonSeverityCounts.Moderate - typhoonSeverityCounts.Severe);
  const baseSum =
    weatherCounts.Dry * BASE_YIELDS.Dry +
    weatherCounts.Normal * BASE_YIELDS.Normal +
    weatherCounts.Wet * BASE_YIELDS.Wet +
    typhoonSeverityCounts.Moderate * TYPHOON_YIELDS.Moderate +
    typhoonSeverityCounts.Severe * TYPHOON_YIELDS.Severe +
    unclassifiedTyphoon * BASE_YIELDS.Typhoon;
  const baseYield = baseSum / daysPerCycle;
  const adj = IRRIGATION_ADJ[params.irrigationType] + ENSO_ADJ[params.ensoState];
  const noise = normalRandom(0, NOISE_SD, rng);
  const finalYield = Math.max(0, baseYield + adj + noise);

  return {
    cycle,
    weather: dominantWeather,
    season,
    typhoonSeverity,
    baseYield,
    finalYield,
    irrigationType: params.irrigationType,
    ensoState: params.ensoState,
  };
}

export function runSimulation(params: SimulationParams): SimulationResults {
  const cycles: CycleResult[] = [];
  const rng = params.seed !== undefined ? createSeededRng(params.seed) : Math.random;
  for (let i = 0; i < params.numCycles; i++) {
    cycles.push(simulateCycle(i + 1, params, rng));
  }
  return computeResults(cycles);
}

function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function computeResults(cycles: CycleResult[]): SimulationResults {
  const yields = cycles.map((c) => c.finalYield);
  const n = yields.length;
  const emptyWeather: Record<WeatherType, number> = {
    Dry: 0,
    Normal: 0,
    Wet: 0,
    Typhoon: 0,
  };
  if (n === 0) {
    return {
      cycles,
      meanYield: 0,
      stdDev: 0,
      minYield: 0,
      maxYield: 0,
      lowYieldProbability: 0,
      weatherFrequencies: emptyWeather,
      percentile5: 0,
      percentile95: 0,
      confidenceInterval: [0, 0],
    };
  }
  const mean = yields.reduce((a, b) => a + b, 0) / n;
  const variance = yields.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const sorted = [...yields].sort((a, b) => a - b);

  const weatherFrequencies: Record<WeatherType, number> = {
    Dry: 0,
    Normal: 0,
    Wet: 0,
    Typhoon: 0,
  };
  cycles.forEach((c) => weatherFrequencies[c.weather]++);

  const p5 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  const se = stdDev / Math.sqrt(n);

  return {
    cycles,
    meanYield: mean,
    stdDev,
    minYield: Math.min(...yields),
    maxYield: Math.max(...yields),
    lowYieldProbability: yields.filter((y) => y < LOW_YIELD_THRESHOLD).length / n,
    weatherFrequencies,
    percentile5: p5,
    percentile95: p95,
    confidenceInterval: [mean - 1.96 * se, mean + 1.96 * se],
  };
}

export function runMonteCarloComparison(
  baseParams: SimulationParams,
  overrides: Partial<SimulationParams>
): SimulationResults {
  return runSimulation({ ...baseParams, ...overrides, numCycles: 1000 });
}
