import {
  BarChart3,
  CloudRain,
  FileDown,
  ShieldCheck,
  Sprout,
  Tornado,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HomeTab() {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto pt-8 space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Leaf className="w-3.5 h-3.5 text-primary" />
          Philippine Climate Risk Simulator
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
          Simulate Rice Yields Under
          <br />
          <span className="text-primary">Weather Uncertainty</span>
        </h1>

        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          Run 120-day crop cycles with configurable planting month, irrigation,
          ENSO state, and typhoon probability. Results update in real time.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            120-day cycles
          </span>
          <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            Stochastic model
          </span>
          <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            Persistent engine
          </span>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
          <p className="text-sm text-muted-foreground">Three steps from setup to insight</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Sprout className="w-5 h-5" />,
              title: "Configure",
              desc: "Set planting month, irrigation type, ENSO state, and typhoon probability.",
            },
            {
              icon: <CloudRain className="w-5 h-5" />,
              title: "Simulate",
              desc: "Watch day-by-day crop growth or run instant cycle sweeps.",
            },
            {
              icon: <FileDown className="w-5 h-5" />,
              title: "Analyze",
              desc: "Read real-time statistics, charts, and export CSV for your thesis.",
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className="group relative rounded-xl border border-border bg-card p-6 space-y-3 transition-shadow hover:shadow-md"
            >
              <div className="text-xs font-bold text-muted-foreground/50">0{i + 1}</div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key Outputs */}
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Key Outputs</h2>
          <p className="text-sm text-muted-foreground">Everything you need for risk-aware decisions</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: <BarChart3 className="w-4 h-4" />, title: "Mean Yield", desc: "Average harvest across completed cycles" },
            { icon: <ShieldCheck className="w-4 h-4" />, title: "Expected Range", desc: "P5 to P95 for safe planning" },
            { icon: <Tornado className="w-4 h-4" />, title: "Typhoon Impact", desc: "Storm exposure and severity tracking" },
            { icon: <CloudRain className="w-4 h-4" />, title: "Weather Frequency", desc: "Day-level weather distribution" },
            { icon: <ArrowRight className="w-4 h-4" />, title: "Low Yield Risk", desc: "P(yield < 2.0 t/ha) downside risk" },
            { icon: <FileDown className="w-4 h-4" />, title: "CSV Export", desc: "Full data for thesis tables and figures" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <div className="mt-0.5 w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center text-primary shrink-0">
                {item.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why It Matters */}
      <section className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Why It Matters</h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-4">
          {[
            "Risk-aware planting month comparisons across wet and dry seasons.",
            "Quantifiable yield gaps between irrigated and rainfed systems.",
            "ENSO stress testing for El Niño and La Niña years.",
            "Typhoon probability sensitivity for storm readiness planning.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* References */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-foreground text-center">References</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: "PAGASA", body: "Seasonal advisories and ENSO context for Philippine rainfall and cyclone activity." },
            { title: "IPCC", body: "Climate extremes and risk-based planning frameworks for agricultural systems." },
            { title: "PhilRice & DA", body: "Philippine rice production data, planting guidance, and extension references." },
          ].map((ref) => (
            <div key={ref.title} className="rounded-lg border border-border bg-card p-5 space-y-2">
              <div className="text-sm font-semibold text-foreground">{ref.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{ref.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-foreground text-center">FAQ</h2>
        <div className="rounded-xl border border-border bg-card">
          <Accordion type="single" collapsible className="w-full">
            {[
              { q: "What makes this a discrete event simulation?", a: "The model steps through distinct events: create cycle, assign weather, grow for 120 days, compute yield, and record results." },
              { q: "Is this stochastic?", a: "Yes. Weather selection, typhoon occurrence, and yield noise are all probabilistic, which is why results are summarized as distributions." },
              { q: "What does low yield risk mean?", a: "It measures the probability that yield falls below 2.0 t/ha — a downside risk metric, not just the average." },
              { q: "What are sacks in farmer mode?", a: "The app converts tons per hectare to 50 kg sacks so farmers can interpret results in familiar units." },
              { q: "Does the simulation persist across tabs?", a: "Yes. The engine runs in the background. Switching tabs never stops or resets the simulation." },
            ].map((item, i) => (
              <AccordionItem key={i} value={`q${i}`} className="px-5">
                <AccordionTrigger className="text-sm text-foreground">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Philippine Rice Yield Weather Simulator</span>
        <span>Built for farmer-friendly decision support and academic reporting</span>
      </footer>
    </div>
  );
}
