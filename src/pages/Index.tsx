import { useState } from 'react';
import { Wheat, FlaskConical, GitBranch } from 'lucide-react';
import SimulationTab from '@/components/SimulationTab';
import AnalysisTab from '@/components/AnalysisTab';
import ModelFlowTab from '@/components/ModelFlowTab';
import { useSimulationStore } from '@/store/simulationStore';

type Tab = 'simulation' | 'analysis' | 'model';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'simulation', label: 'Simulation', icon: <Wheat className="w-4 h-4" /> },
  { id: 'analysis',   label: 'Analysis',   icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'model',      label: 'Model Flow', icon: <GitBranch className="w-4 h-4" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('simulation');
  const { viewMode, setViewMode } = useSimulationStore();

  return (
    <div className="min-h-screen bg-background">
        {/* Top nav header */}
        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 shadow-sm">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-6 h-16">
              {/* Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-card border border-border shadow flex items-center justify-center overflow-hidden">
                  <img
                    src="/LeafGuardLogo.png"
                    alt="LeafGuard logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base font-bold leading-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Philippine Rice Yield Weather Simulator
                  </h1>
                  <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Farmer-ready yield risk simulation machine
                  </p>
                </div>
              </div>

              {/* Tab navigation */}
              <nav className="flex items-center gap-1 ml-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="ml-auto flex items-center">
                <div className="flex items-center rounded-full border border-border bg-muted p-1">
                  <button
                    onClick={() => setViewMode('farmer')}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      viewMode === 'farmer'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Farmer
                  </button>
                  <button
                    onClick={() => setViewMode('analytics')}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      viewMode === 'analytics'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Analytics
                  </button>
                </div>
              </div>

            </div>
          </div>
        </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'simulation' && <SimulationTab />}
        {activeTab === 'analysis'   && <AnalysisTab />}
        {activeTab === 'model'      && <ModelFlowTab />}
      </main>
    </div>
  );
};

export default Index;
