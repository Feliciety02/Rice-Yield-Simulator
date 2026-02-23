import { useState } from 'react';
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center h-14">
            {/* Brand */}
            <div className="flex items-center gap-2.5 shrink-0 pr-6 mr-6 border-r border-border/60">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                <img
                  src="/LeafGuardLogo.png"
                  alt="LeafGuard logo"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold leading-tight text-foreground">
                  Rice Yield Simulator
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  Philippine climate risk tool
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* View toggle */}
            <div className="shrink-0">
              <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5">
                {(['farmer', 'analytics'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${
                      viewMode === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
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
