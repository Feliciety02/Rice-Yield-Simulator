export type WeatherType = 'Dry' | 'Normal' | 'Wet' | 'Typhoon';
export type Season = 'Dry Season' | 'Wet Season';
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

export function getSeason(month: number): Season {
  return month >= 6 && month <= 10 ? 'Wet Season' : 'Dry Season';
}

function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function getWeather(season: Season, typhoonProb: number): WeatherType {
  const r = Math.random();
  if (season === 'Dry Season') {
    if (r < 0.05) return 'Typhoon';
    if (r < 0.15) return 'Wet';
    if (r < 0.55) return 'Normal';
    return 'Dry';
  } else {
    if (r < typhoonProb) return 'Typhoon';
    if (r < typhoonProb + 0.35) return 'Wet';
    if (r < typhoonProb + 0.75) return 'Normal';
    return 'Dry';
  }
}

const BASE_YIELDS: Record<WeatherType, number> = {
  Dry: 2.0,
  Normal: 3.0,
  Wet: 3.3,
  Typhoon: 1.2,
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

export function simulateCycle(
  cycle: number,
  params: SimulationParams
): CycleResult {
  const season = getSeason(params.plantingMonth);
  const weather = getWeather(season, params.typhoonProbability / 100);
  const baseYield = BASE_YIELDS[weather];
  const adj = IRRIGATION_ADJ[params.irrigationType] + ENSO_ADJ[params.ensoState];
  const noise = normalRandom(0, 0.2);
  const finalYield = Math.max(0, baseYield + adj + noise);

  return {
    cycle,
    weather,
    season,
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
