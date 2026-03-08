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

export type DecisionReason = {
  title: string;
  value: string;
  tone: DecisionTone | 'info';
  text: string;
};

export type DecisionSupportResult = {
  label: DecisionLabel;
  tone: DecisionTone;
  reasons: DecisionReason[];
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

  const reasons: DecisionReason[] = [];
  reasons.push({
    title: 'Low-yield risk',
    value: `${(lowYieldProb * 100).toFixed(1)}%`,
    tone: lowYieldProb >= 0.35 ? 'risk' : lowYieldProb >= 0.2 ? 'caution' : 'safe',
    text:
      lowYieldProb >= 0.35
        ? 'Too many seasons fall below the low-harvest line.'
        : lowYieldProb >= 0.2
        ? 'Low harvest is possible often enough to require caution.'
        : 'Only a small share of seasons fall into low harvest.',
  });
  reasons.push({
    title: 'Expected range',
    value: expectedRange ? `${expectedRange.p5.toFixed(2)} to ${expectedRange.p95.toFixed(2)} t/ha` : 'Not ready',
    tone: rangeWidth >= 1.8 ? 'risk' : rangeWidth >= 1.2 ? 'caution' : expectedRange ? 'safe' : 'info',
    text:
      !expectedRange
        ? 'More completed cycles are needed before the harvest range is reliable.'
        : rangeWidth >= 1.8
        ? 'The harvest range is wide, so outcomes are unstable.'
        : rangeWidth >= 1.2
        ? 'The harvest range is moderately wide, so expect uneven seasons.'
        : 'The harvest range is fairly tight, so seasons are more consistent.',
  });
  reasons.push({
    title: 'Typhoon frequency',
    value: `${(typhoonFrequency * 100).toFixed(1)}% of days`,
    tone: typhoonFrequency >= 0.25 ? 'risk' : typhoonFrequency >= 0.15 ? 'caution' : 'safe',
    text:
      typhoonFrequency >= 0.25
        ? 'Storm-heavy runs are pushing the recommendation into high risk.'
        : typhoonFrequency >= 0.15
        ? 'Storm days are frequent enough to weaken planning confidence.'
        : 'Storm exposure is present but not dominating the run.',
  });
  reasons.push({
    title: 'Completed cycles',
    value: `${cycles}`,
    tone: cycles < 20 ? 'info' : cycles < 50 ? 'caution' : 'safe',
    text:
      cycles < 20
        ? 'The sample is still small, so treat the recommendation as early guidance.'
        : cycles < 50
        ? 'The sample is usable, but more cycles would tighten confidence.'
        : 'The sample size is strong enough to support a firmer recommendation.',
  });

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

  return { label, tone, reasons, actions, alerts };
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
