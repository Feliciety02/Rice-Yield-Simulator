import {
  runSimulation,
  type ENSOState,
  type IrrigationType,
  type SimulationParams,
} from './simulation';

export type DecisionLabel = 'Safe to plant' | 'Caution' | 'High risk';
export type DecisionTone = 'safe' | 'caution' | 'risk';

export type DecisionAlert = {
  level: 'info' | 'warning' | 'high';
  text: string;
};

export type DecisionSupportResult = {
  label: DecisionLabel;
  tone: DecisionTone;
  actions: string[];
  alerts: DecisionAlert[];
};

export type ScenarioRank = {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  meanYield: number;
  lowYieldProb: number;
  score: number;
};

export function buildDecisionSupport(input: {
  lowYieldProb: number;
  typhoonFrequency: number;
  expectedRange?: { p5: number; p95: number } | null;
  cycles: number;
  irrigationType: IrrigationType;
}): DecisionSupportResult {
  const { lowYieldProb, typhoonFrequency, expectedRange, cycles, irrigationType } = input;
  const rangeWidth = expectedRange ? Math.max(0, expectedRange.p95 - expectedRange.p5) : 0;

  let tone: DecisionTone = 'safe';
  if (lowYieldProb >= 0.35 || typhoonFrequency >= 0.25 || rangeWidth >= 1.8) {
    tone = 'risk';
  } else if (lowYieldProb >= 0.2 || typhoonFrequency >= 0.15 || rangeWidth >= 1.2) {
    tone = 'caution';
  }

  const label: DecisionLabel =
    tone === 'risk' ? 'High risk' :
    tone === 'caution' ? 'Caution' :
    'Safe to plant';

  const actions: string[] = [];
  if (tone === 'risk') {
    actions.push('Consider shifting the planting window to avoid peak storm months.');
  }
  if (typhoonFrequency >= 0.2) {
    actions.push('Prepare drainage, secure field edges, and plan for storm recovery.');
  }
  if (irrigationType === 'Rainfed') {
    actions.push('If possible, add backup water or irrigation to protect yield during dry spells.');
  }
  if (actions.length === 0) {
    actions.push('Maintain the current plan and keep monitoring forecasts.');
  }

  const alerts: DecisionAlert[] = [];
  if (cycles < 20) {
    alerts.push({ level: 'info', text: 'Few cycles completed; confidence is still low.' });
  }
  if (lowYieldProb >= 0.3) {
    alerts.push({ level: 'high', text: 'High chance of low harvest based on current settings.' });
  }
  if (typhoonFrequency >= 0.2) {
    alerts.push({ level: 'warning', text: 'Storm days are frequent in this run.' });
  }
  if (rangeWidth >= 1.5) {
    alerts.push({ level: 'warning', text: 'Harvest range is wide, so results are uncertain.' });
  }

  return { label, tone, actions, alerts };
}

export function rankScenarios(input: {
  months: number[];
  irrigationTypes: IrrigationType[];
  ensoStates: ENSOState[];
  typhoonProbability: number; // percent 0-40
  daysPerCycle: number;
  numCycles: number;
  seedBase?: number;
}): ScenarioRank[] {
  const {
    months,
    irrigationTypes,
    ensoStates,
    typhoonProbability,
    daysPerCycle,
    numCycles,
    seedBase = 2024,
  } = input;

  const results: ScenarioRank[] = [];
  let idx = 0;
  for (const plantingMonth of months) {
    for (const irrigationType of irrigationTypes) {
      for (const ensoState of ensoStates) {
        const seed = seedBase + plantingMonth * 100 + idx;
        const params: SimulationParams = {
          plantingMonth,
          irrigationType,
          ensoState,
          typhoonProbability,
          numCycles,
          daysPerCycle,
          seed,
        };
        const sim = runSimulation(params);
        const meanYield = sim.meanYield;
        const lowYieldProb = sim.lowYieldProbability;
        const score = meanYield * (1 - lowYieldProb);
        results.push({ plantingMonth, irrigationType, ensoState, meanYield, lowYieldProb, score });
        idx += 1;
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
