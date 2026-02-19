import { create } from 'zustand';
import { engine, EngineSnapshot, EngineParams } from '@/lib/simulationEngine';

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
  const setSnap = (snap: EngineSnapshot) => set({ snap });
  engine.subscribe(setSnap);

  return {
    snap: engine.getSnapshot(),
    start: () => engine.start(),
    startInstant: () => engine.startInstant(),
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    reset: () => engine.reset(),
    setSpeed: (m: number) => engine.setSpeed(m),
    updateParams: (p: Partial<EngineParams>) => engine.updateParams(p),
    viewMode: 'farmer',
    setViewMode: (mode) => set({ viewMode: mode }),
  };
});
