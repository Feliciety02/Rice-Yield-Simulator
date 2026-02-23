import { create } from 'zustand';
import type { EngineSnapshot, EngineParams } from '@/lib/simulationEngine';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

function initBins() {
  const bins = [];
  for (let v = 0; v < 5.5; v += 0.5) {
    bins.push({ label: v.toFixed(1), count: 0 });
  }
  return bins;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const initialCycleStartDate = new Date(new Date().getFullYear(), 5, 1);

const initialSnapshot: EngineSnapshot = {
  status: 'idle',
  mode: 'day',
  speedMultiplier: 1,
  params: {
    plantingMonth: 6,
    irrigationType: 'Irrigated',
    ensoState: 'Neutral',
    typhoonProbability: 15,
    cyclesTarget: 100,
    daysPerCycle: 120,
  },
  pendingParams: {},
  currentCycleIndex: 0,
  currentDay: 0,
  dayProgress: 0,
  runProgress: 0,
  currentWeather: null,
  currentYield: null,
  currentCycleWeatherTimeline: [],
  currentCycleTyphoonSeverityTimeline: [],
  cycleStartDate: formatDate(initialCycleStartDate),
  firstCycleStartDate: formatDate(initialCycleStartDate),
  lastCompletedCycleStartDate: null,
  runningMean: 0,
  runningSd: 0,
  lowYieldProb: 0,
  yieldHistoryOverTime: [],
  recentYields: [],
  yieldSeries: [],
  yieldBandSeries: [],
  cycleRecords: [],
  weatherCounts: { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 },
  dailyWeatherCounts: { Dry: 0, Normal: 0, Wet: 0, Typhoon: 0 },
  dailyTyphoonSeverityCounts: { Moderate: 0, Severe: 0 },
  histogramBins: initBins(),
  summary: null,
};

async function post(path: string, body: unknown) {
  await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface SimulationStore {
  snap: EngineSnapshot;
  start: () => void;
  startInstant: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setSpeed: (multiplier: number) => void;
  updateParams: (partial: Partial<EngineParams>) => void;
  viewMode: 'farmer' | 'analytics';
  setViewMode: (mode: 'farmer' | 'analytics') => void;
}

export const useSimulationStore = create<SimulationStore>((set) => {
  let polling = false;

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const res = await fetch(`${API_BASE}/snapshot`);
      if (res.ok) {
        const snap = (await res.json()) as EngineSnapshot;
        set({ snap });
      }
    } catch {
      // ignore network errors; keep last snapshot
    } finally {
      polling = false;
    }
  };

  const startPolling = () => {
    poll();
    setInterval(poll, 100);
  };

  startPolling();

  return {
    snap: initialSnapshot,
    start: () => post('/control', { action: 'start' }),
    startInstant: () => post('/control', { action: 'start_instant' }),
    pause: () => post('/control', { action: 'pause' }),
    resume: () => post('/control', { action: 'resume' }),
    reset: () => post('/control', { action: 'reset' }),
    setSpeed: (m: number) => post('/speed', { multiplier: m }),
    updateParams: (p: Partial<EngineParams>) => post('/params', p),
    viewMode: 'farmer',
    setViewMode: (mode) => set({ viewMode: mode }),
  };
});
