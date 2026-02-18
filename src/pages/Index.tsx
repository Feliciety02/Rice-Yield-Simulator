import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wheat, BarChart3, FlaskConical, GitBranch } from 'lucide-react';
import SimulationTab from '@/components/SimulationTab';
import ResultsTab from '@/components/ResultsTab';
import AnalysisTab from '@/components/AnalysisTab';
import ModelFlowTab from '@/components/ModelFlowTab';
import { SimulationProvider } from '@/context/SimulationContext';

const Index = () => {
  const [activeTab, setActiveTab] = useState('simulation');

  return (
    <SimulationProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
          <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Wheat className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Philippine Rice Yield Weather Simulator</h1>
              <p className="text-xs text-muted-foreground">Monte Carlo simulation for agricultural risk analysis</p>
            </div>
          </div>
        </header>

        <main className="container max-w-7xl mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-muted">
              <TabsTrigger value="simulation" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Wheat className="w-4 h-4" /> Simulation
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="w-4 h-4" /> Results
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FlaskConical className="w-4 h-4" /> Analysis
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <GitBranch className="w-4 h-4" /> Model Flow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simulation">
              <SimulationTab />
            </TabsContent>
            <TabsContent value="results">
              <ResultsTab />
            </TabsContent>
            <TabsContent value="analysis">
              <AnalysisTab />
            </TabsContent>
            <TabsContent value="model">
              <ModelFlowTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </SimulationProvider>
  );
};

export default Index;
