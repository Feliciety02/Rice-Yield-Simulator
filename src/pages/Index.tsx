import { useState, useEffect } from 'react';
import { Wheat, FlaskConical, GitBranch, Leaf } from 'lucide-react';
import SimulationTab from '@/components/SimulationTab';
import AnalysisTab from '@/components/AnalysisTab';
import ModelFlowTab from '../components/ModelFlowTab';
import AboutTab from '../components/AboutTab';
import { useSimulationStore } from '@/store/simulationStore';

type Tab = 'home' | 'simulation' | 'analysis' | 'model';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',       label: 'Home',       icon: <Leaf className="w-4 h-4" /> },
  { id: 'simulation', label: 'Simulation', icon: <Wheat className="w-4 h-4" /> },
  { id: 'analysis',   label: 'Analysis',   icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'model',      label: 'Model Flow', icon: <GitBranch className="w-4 h-4" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const { viewMode, setViewMode } = useSimulationStore();

  // Listen for navigation events from hero CTAs
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as Tab;
      if (['home', 'simulation', 'analysis', 'model'].includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('navigate-tab', handler);
    return () => window.removeEventListener('navigate-tab', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary sticky top-0 z-30 relative overflow-hidden border-b border-primary-foreground/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.65)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -inset-x-16 -inset-y-10 header-shimmer" />
          <div className="absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-primary-foreground/15 blur-2xl float-slow" />
          <div
            className="absolute right-16 -top-6 h-20 w-20 rounded-full bg-accent/30 blur-2xl float-slow"
            style={{ animationDelay: '1.5s' }}
          />
        </div>
        <div className="max-w-6xl mx-auto px-5 relative">
          <div className="flex items-center h-14">
            {/* Brand */}
            <div
              className="flex items-center gap-2.5 shrink-0 pr-6 mr-6 border-r border-primary-foreground/20 fade-up"
              style={{ animationDelay: '60ms' }}
            >
              <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center overflow-hidden shadow-inner ring-1 ring-primary-foreground/20 logo-float">
                <img
                  src="/LeafGuardLogo.png"
                  alt="LeafGuard logo"
                  className="w-7 h-7 object-contain brightness-0 invert"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold leading-tight text-primary-foreground tracking-[0.01em]">
                  Rice Yield Simulator
                </h1>
                <p className="text-[10px] text-primary-foreground/60">
                  Philippine climate risk tool
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 flex items-center gap-1">
              {TABS.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 fade-up ${
                    activeTab === tab.id
                      ? 'text-primary-foreground bg-primary-foreground/15 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.6)]'
                      : 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 hover:-translate-y-0.5'
                  }`}
                  style={{ animationDelay: `${140 + index * 70}ms` }}
                >
                  <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6">
                    {tab.icon}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span
                    className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent transition-transform duration-300 origin-left ${
                      activeTab === tab.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </button>
              ))}
            </nav>

            {/* View toggle */}
            <div className="shrink-0 fade-up" style={{ animationDelay: '460ms' }}>
              <div className="flex items-center rounded-full bg-primary-foreground/10 p-0.5 shadow-inner">
                {(['farmer', 'analytics'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-300 capitalize ${
                      viewMode === mode
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'text-primary-foreground/60 hover:text-primary-foreground hover:-translate-y-0.5'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8">
        {activeTab === 'home'       && <AboutTab />}
        {activeTab === 'simulation' && <SimulationTab />}
        {activeTab === 'analysis'   && <AnalysisTab />}
        {activeTab === 'model'      && <ModelFlowTab />}
      </main>
    </div>
  );
};

export default Index;
