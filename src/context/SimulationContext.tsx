import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { engine, EngineSnapshot, EngineParams } from '@/lib/simulationEngine';

interface SimulationContextValue {
  snap: EngineSnapshot;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setSpeed: (multiplier: number) => void;
  updateParams: (partial: Partial<EngineParams>) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<EngineSnapshot>(engine.getSnapshot());

  useEffect(() => {
    const unsub = engine.subscribe(setSnap);
    return unsub;
  }, []);

  const start = useCallback(() => engine.start(), []);
  const pause = useCallback(() => engine.pause(), []);
  const resume = useCallback(() => engine.resume(), []);
  const reset = useCallback(() => engine.reset(), []);
  const setSpeed = useCallback((m: number) => engine.setSpeed(m), []);
  const updateParams = useCallback((p: Partial<EngineParams>) => engine.updateParams(p), []);

  return (
    <SimulationContext.Provider value={{ snap, start, pause, resume, reset, setSpeed, updateParams }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
}
