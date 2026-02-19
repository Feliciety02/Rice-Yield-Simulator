import { useState } from 'react';
import { Wheat, FlaskConical, GitBranch } from 'lucide-react';
import SimulationTab from '@/components/SimulationTab';
import AnalysisTab from '@/components/AnalysisTab';
import ModelFlowTab from '@/components/ModelFlowTab';
import { SimulationProvider } from '@/context/SimulationContext';

type Tab = 'simulation' | 'analysis' | 'model';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'simulation', label: 'Simulation', icon: <Wheat className="w-4 h-4" /> },
  { id: 'analysis',   label: 'Analysis',   icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'model',      label: 'Model Flow', icon: <GitBranch className="w-4 h-4" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('simulation');

  return (
    <SimulationProvider>
      <div className="min-h-screen bg-background">
        {/* Top nav header */}
        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 shadow-sm">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-6 h-16">
              {/* Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow">
                  <Wheat className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base font-bold leading-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    PH Rice Yield Simulator
                  </h1>
                  <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Monte Carlo · Agricultural Risk Analysis
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
            </div>
          </div>
        </header>

        <main className="container max-w-7xl mx-auto px-4 py-6">
          {activeTab === 'simulation' && <SimulationTab />}
          {activeTab === 'analysis'   && <AnalysisTab />}
          {activeTab === 'model'      && <ModelFlowTab />}
        </main>
      </div>
    </SimulationProvider>
  );
};

export default Index;
