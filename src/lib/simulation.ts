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
}

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

function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
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

export function getWeather(month: number, typhoonProb: number): WeatherType {
  const weights = getWeatherWeights(month, typhoonProb);
  const r = Math.random();
  let acc = weights.Dry;
  if (r < acc) return 'Dry';
  acc += weights.Normal;
  if (r < acc) return 'Normal';
  acc += weights.Wet;
  if (r < acc) return 'Wet';
  return 'Typhoon';
}

export function getTyphoonSeverity(): TyphoonSeverity {
  const weights = DEFAULT_PROFILE.severity;
  const r = Math.random();
  return r < weights.Severe ? 'Severe' : 'Moderate';
}

export function getTyphoonSeverityWeights() {
  return DEFAULT_PROFILE.severity;
}

const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0,
  Normal: 3.0,
  Wet: 3.3,
  Typhoon: 1.2,
};

const TYPHOON_YIELDS: Record<TyphoonSeverity, number> = {
  Moderate: 1.4,
  Severe: 0.8,
};

const IRRIGATION_ADJ: Record<IrrigationType, number> = {
  Irrigated: 0.3,
  Rainfed: 0,
};

const ENSO_ADJ: Record<ENSOState, number> = {
  'El Niño': -0.4,
  Neutral: 0,
  'La Niña': 0.3,
};

const DAYS_PER_CYCLE = 120;

function monthForDay(startMonth: number, dayIndex: number) {
  const date = new Date(2020, startMonth - 1, 1);
  date.setDate(date.getDate() + dayIndex);
  return date.getMonth() + 1;
}

export function simulateCycle(
  cycle: number,
  params: SimulationParams
): CycleResult {
  const season = getSeason(params.plantingMonth);
  const weatherCounts: Record<WeatherType, number> = { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 };
  const typhoonSeverityCounts: Record<TyphoonSeverity, number> = { Moderate: 0, Severe: 0 };
  for (let d = 0; d < DAYS_PER_CYCLE; d++) {
    const month = monthForDay(params.plantingMonth, d);
    const w = getWeather(month, params.typhoonProbability / 100);
    weatherCounts[w]++;
    if (w === 'Typhoon') {
      const severity = getTyphoonSeverity();
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
  const baseYield = baseSum / DAYS_PER_CYCLE;
  const adj = IRRIGATION_ADJ[params.irrigationType] + ENSO_ADJ[params.ensoState];
  const noise = normalRandom(0, 0.2);
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
  for (let i = 0; i < params.numCycles; i++) {
    cycles.push(simulateCycle(i + 1, params));
  }
  return computeResults(cycles);
}

export function computeResults(cycles: CycleResult[]): SimulationResults {
  const yields = cycles.map((c) => c.finalYield);
  const n = yields.length;
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

  const p5 = sorted[Math.floor(n * 0.05)] ?? 0;
  const p95 = sorted[Math.floor(n * 0.95)] ?? 0;
  const se = stdDev / Math.sqrt(n);

  return {
    cycles,
    meanYield: mean,
    stdDev,
    minYield: Math.min(...yields),
    maxYield: Math.max(...yields),
    lowYieldProbability: yields.filter((y) => y < 2.0).length / n,
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
