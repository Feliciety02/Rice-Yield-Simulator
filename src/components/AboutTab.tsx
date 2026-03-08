import { useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Cloud,
  CloudRain,
  FileDown,
  FlaskConical,
  Gauge,
  Layers,
  Leaf,
  MapPin,
  ShieldCheck,
  Sprout,
  Sun,
  Tornado,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import riceFieldHero from "@/assets/rice-field-hero.jpg";
import { useSimulationStore } from "@/store/simulationStore";
import {
  DEFAULT_DAYS_PER_CYCLE,
  LOW_YIELD_THRESHOLD,
  WeatherType,
  TyphoonSeverity,
  getTyphoonSeverityWeights,
  getWeatherWeights,
} from "@/lib/simulation";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const CYCLE_DAYS = DEFAULT_DAYS_PER_CYCLE;
const CYCLE_DAYS_LABEL = `${CYCLE_DAYS}-day`;
const LOW_YIELD_LABEL = `${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha`;

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: "hsl(var(--weather-dry))",
  Normal: "hsl(var(--weather-normal))",
  Wet: "hsl(var(--weather-wet))",
  Typhoon: "hsl(var(--weather-typhoon))",
};

const WEATHER_BG: Record<WeatherType, string> = {
  Dry: "hsl(var(--weather-dry) / 0.18)",
  Normal: "hsl(var(--weather-normal) / 0.18)",
  Wet: "hsl(var(--weather-wet) / 0.18)",
  Typhoon: "hsl(var(--weather-typhoon) / 0.18)",
};

const TYPHOON_SEVERITY_COLORS: Record<TyphoonSeverity, string> = {
  Moderate: "hsl(var(--warning))",
  Severe: "hsl(var(--destructive))",
};

const HERO_STATS = [
  {
    icon: Calendar,
    title: `${CYCLE_DAYS_LABEL} cycle`,
    desc: "Daily growth + weather",
  },
  {
    icon: Layers,
    title: "Up to 500 cycles",
    desc: "Fast Monte Carlo sweeps",
  },
  {
    icon: CloudRain,
    title: "ENSO + typhoon",
    desc: "Seasonal stress testing",
  },
  {
    icon: MapPin,
    title: "Region-aware",
    desc: "Localized weather weights",
  },
];

const CAPABILITIES = [
  {
    icon: CloudRain,
    title: "Climate Modeling",
    desc: "Stochastic weather based on Philippine seasonal patterns and ENSO states.",
  },
  {
    icon: BarChart3,
    title: "Monte Carlo Yield Risk",
    desc: "Run hundreds of crop cycles to estimate distributions and confidence bands.",
  },
  {
    icon: Tornado,
    title: "Typhoon Impact Analysis",
    desc: "Quantify storm exposure, severity, and yield loss sensitivity.",
  },
  {
    icon: ShieldCheck,
    title: "Farmer + Analytics Views",
    desc: "Switch between farmer-friendly sacks and technical t/ha output views.",
  },
];

const WORKFLOW = [
  {
    icon: Sprout,
    title: "Configure",
    desc: "Set planting month, irrigation, ENSO state, and typhoon probability.",
  },
  {
    icon: CloudRain,
    title: "Simulate",
    desc: "Run day-by-day growth or instant cycle sweeps to build a risk profile.",
  },
  {
    icon: FileDown,
    title: "Analyze",
    desc: "Review charts, confidence intervals, and export CSV for reporting.",
  },
];

const OUTPUTS = [
  { icon: BarChart3, title: "Mean Yield", desc: "Average harvest across completed cycles" },
  { icon: ShieldCheck, title: "Expected Range", desc: "P5 to P95 for safe planning" },
  { icon: Tornado, title: "Typhoon Impact", desc: "Storm exposure and severity tracking" },
  { icon: CloudRain, title: "Weather Frequency", desc: "Day-level weather distribution" },
  { icon: ArrowRight, title: "Low Yield Risk", desc: `P(yield < ${LOW_YIELD_LABEL}) downside risk` },
  { icon: FileDown, title: "CSV Export", desc: "Full data for thesis tables and figures" },
];

const IMPACT = [
  "Risk-aware planting month comparisons across wet and dry seasons.",
  "Quantifiable yield gaps between irrigated and rainfed systems.",
  "ENSO stress testing for El Niño and La Niña years.",
  "Typhoon probability sensitivity for storm readiness planning.",
];

const REFERENCES = [
  { title: "PAGASA", body: "Seasonal advisories and ENSO context for Philippine rainfall and cyclone activity." },
  { title: "IPCC", body: "Climate extremes and risk-based planning frameworks for agricultural systems." },
  { title: "PhilRice & DA", body: "Philippine rice production data, planting guidance, and extension references." },
];

const FAQS = [
  {
    q: "What makes this a discrete event simulation?",
    a: `The model steps through distinct events: create cycle, assign weather, grow for ${CYCLE_DAYS} days, compute yield, and record results.`,
  },
  {
    q: "Is this stochastic?",
    a: "Yes. Weather selection, typhoon occurrence, and yield noise are all probabilistic, which is why results are summarized as distributions.",
  },
  {
    q: "What does low yield risk mean?",
    a: `It measures the probability that yield falls below ${LOW_YIELD_LABEL} - a downside risk metric, not just the average.`,
  },
  {
    q: "What are sacks in farmer mode?",
    a: "The app converts tons per hectare to 50 kg sacks so farmers can interpret results in familiar units.",
  },
  {
    q: "Does the simulation persist across tabs?",
    a: "Yes. The engine runs in the background. Switching tabs never stops or resets the simulation.",
  },
];

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function WeatherIcon({ weather, className }: { weather: WeatherType; className?: string }) {
  const cls = className ?? "w-3 h-3";
  if (weather === "Dry") return <Sun className={cls} style={{ color: WEATHER_COLORS.Dry }} />;
  if (weather === "Wet") return <CloudRain className={cls} style={{ color: WEATHER_COLORS.Wet }} />;
  if (weather === "Typhoon") return <Tornado className={cls} style={{ color: WEATHER_COLORS.Typhoon }} />;
  return <Cloud className={cls} style={{ color: WEATHER_COLORS.Normal }} />;
}

function WeatherWeightRow({
  weather,
  value,
  helper,
}: {
  weather: WeatherType;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: WEATHER_BG[weather] }}
        >
          <WeatherIcon weather={weather} className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-medium">{weather}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{value}</div>
        {helper && <div className="text-[10px] text-muted-foreground">{helper}</div>}
      </div>
    </div>
  );
}

function WeatherTyphoonGeneration({ typhoonProbability }: { typhoonProbability: number }) {
  const typhoonProb = typhoonProbability / 100;
  const dryMonth = 2;
  const wetMonth = 8;
  const dryWeights = useMemo(() => getWeatherWeights(dryMonth, typhoonProb), [dryMonth, typhoonProb]);
  const wetWeights = useMemo(() => getWeatherWeights(wetMonth, typhoonProb), [wetMonth, typhoonProb]);
  const severityWeights = useMemo(() => getTyphoonSeverityWeights(), []);
  const severityTotal = severityWeights.Moderate + severityWeights.Severe || 1;
  const moderatePct = Math.round((severityWeights.Moderate / severityTotal) * 100);
  const severePct = Math.max(0, 100 - moderatePct);
  const typhoonBase = Math.min(0.6, typhoonProb * 1.2);
  const donutStyle = useMemo(
    () => ({
      backgroundImage: `conic-gradient(${TYPHOON_SEVERITY_COLORS.Moderate} 0 ${moderatePct}%, ${TYPHOON_SEVERITY_COLORS.Severe} ${moderatePct}% 100%)`,
    }),
    [moderatePct]
  );

  return (
    <div
      className="rounded-3xl p-6 relative overflow-hidden agri-surface"
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% 12%, hsl(var(--primary) / 0.12), transparent 55%), radial-gradient(circle at 88% 10%, hsl(var(--chart-2) / 0.12), transparent 45%)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="h-11 w-1.5 rounded-full bg-primary/70" />
        <div>
          <div className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Weather &amp; Typhoon Generation
          </div>
          <div className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Daily weather sampled using month-based seasonal weights.
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-4">
        <div className="overflow-hidden rounded-2xl agri-surface shadow-sm">
          <div
            className="flex items-center justify-between px-4 py-2 bg-warning text-warning-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sun className="w-4 h-4" /> Dry Season Weights
            </div>
            <span className="text-[10px] font-medium opacity-80">Sample: {MONTH_NAMES[dryMonth - 1]}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Weather Type</span>
              <span>Probability</span>
            </div>
            <div className="space-y-3">
              <WeatherWeightRow weather="Dry" value={formatWeight(dryWeights.Dry)} />
              <WeatherWeightRow weather="Normal" value={formatWeight(dryWeights.Normal)} />
              <WeatherWeightRow weather="Wet" value={formatWeight(dryWeights.Wet)} />
              <WeatherWeightRow weather="Typhoon" value={formatWeight(dryWeights.Typhoon)} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl agri-surface shadow-sm">
          <div
            className="flex items-center justify-between px-4 py-2 bg-info text-info-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CloudRain className="w-4 h-4" /> Wet Season Weights
            </div>
            <span className="text-[10px] font-medium opacity-80">Sample: {MONTH_NAMES[wetMonth - 1]}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Weather Type</span>
              <span>Probability</span>
            </div>
            <div className="space-y-3">
              <WeatherWeightRow weather="Dry" value={formatWeight(wetWeights.Dry)} />
              <WeatherWeightRow weather="Normal" value={formatWeight(wetWeights.Normal)} />
              <WeatherWeightRow weather="Wet" value={formatWeight(wetWeights.Wet)} />
              <WeatherWeightRow
                weather="Typhoon"
                value="p(typhoon) x 1.2"
                helper={`Capped at 0.6, base ${formatWeight(typhoonBase)}, normalized ${formatWeight(wetWeights.Typhoon)}`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl agri-surface shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Tornado className="w-4 h-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Typhoon Severity
              </div>
              <div className="text-[11px] text-muted-foreground">Severity split used when typhoon days occur.</div>
            </div>
          </div>
          <div className="p-4 flex flex-col items-center gap-4">
            <div className="relative h-40 w-40">
              <div className="absolute inset-0 rounded-full" style={donutStyle} />
              <div className="absolute inset-6 rounded-full bg-card ring-1 ring-border/60 shadow-inner" />
            </div>
            <div className="w-full rounded-xl bg-surface/80 ring-1 ring-border/60 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPHOON_SEVERITY_COLORS.Moderate }} />
                  Moderate
                </div>
                <span className="text-foreground font-semibold">{moderatePct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPHOON_SEVERITY_COLORS.Severe }} />
                  Severe
                </div>
                <span className="text-foreground font-semibold">{severePct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground">
        Sample months: {MONTH_NAMES[dryMonth - 1]} (dry) and {MONTH_NAMES[wetMonth - 1]} (wet). Typhoon probability input: {typhoonProbability}%.
      </div>
    </div>
  );
}

export default function HomeTab() {
  const typhoonProbability = useSimulationStore((state) => state.snap.params.typhoonProbability);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero */}
      <section className="relative left-1/2 right-1/2 -mx-[50vw] -mt-8 w-screen overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={riceFieldHero}
            alt="Lush Philippine rice paddy terraces at golden hour"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/75 to-primary/40" />
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top_left,_hsl(var(--accent))_0%,_transparent_55%)]" />
          <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_80%_10%,_hsl(var(--sun))_0%,_transparent_45%)]" />
          <div className="absolute -right-24 -bottom-32 w-80 h-80 rounded-full bg-accent/30 blur-3xl float-slow" />
        </div>

        <div className="relative z-10 px-4 md:px-8 py-16 md:py-24 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 backdrop-blur px-4 py-1.5 text-xs font-medium text-primary-foreground/80 fade-up">
                <Leaf className="w-3.5 h-3.5" />
                Philippine Climate Risk Simulator
              </div>

              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-primary-foreground leading-[1.1] fade-up fade-up-1">
                Philippine Rice Yield
                <br />
                Weather Simulator
              </h1>

              <p className="text-primary-foreground/75 text-base md:text-lg max-w-xl leading-relaxed fade-up fade-up-2">
                Data-driven crop modeling for climate-aware rice production.
                Run {CYCLE_DAYS_LABEL} cycles with configurable weather, ENSO, and typhoon parameters.
              </p>

              <div className="flex flex-wrap gap-3 fade-up fade-up-2">
                <button
                  onClick={() => {
                    const evt = new CustomEvent("navigate-tab", { detail: "simulation" });
                    window.dispatchEvent(evt);
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-accent text-accent-foreground font-semibold text-sm transition-colors hover:bg-accent/90 inline-flex items-center gap-2"
                >
                  Start Simulation
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const evt = new CustomEvent("navigate-tab", { detail: "model" });
                    window.dispatchEvent(evt);
                  }}
                  className="px-6 py-2.5 rounded-2xl border border-primary-foreground/30 text-primary-foreground font-semibold text-sm transition-colors hover:bg-primary-foreground/10"
                >
                  View Model Flow
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 fade-up fade-up-3">
                {HERO_STATS.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.title}
                      className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur px-3 py-3 text-primary-foreground"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Icon className="w-4 h-4 text-accent" />
                        {stat.title}
                      </div>
                      <div className="text-[11px] text-primary-foreground/70 mt-1">
                        {stat.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur p-6 space-y-6 text-primary-foreground shadow-[0_20px_60px_rgba(0,0,0,0.25)] fade-up fade-up-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60">
                <span>Decision Briefing</span>
                <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px]">Live</span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    icon: Gauge,
                    label: "Cycle duration",
                    value: `${CYCLE_DAYS} days`,
                    note: "Day-by-day growth",
                  },
                  {
                    icon: FlaskConical,
                    label: "Scenario levers",
                    value: "ENSO + irrigation",
                    note: "Stress test conditions",
                  },
                  {
                    icon: Tornado,
                    label: "Storm exposure",
                    value: "0% to 40%",
                    note: "Typhoon probability",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl bg-primary-foreground/10 px-4 py-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="text-xs text-primary-foreground/60">{item.label}</div>
                        <div className="text-sm font-semibold">{item.value}</div>
                        <div className="text-[10px] text-primary-foreground/60">{item.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-primary-foreground/10 p-4 space-y-3">
                <div className="text-sm font-semibold">Quick Start</div>
                <div className="space-y-2 text-xs text-primary-foreground/70">
                  {[
                    "Pick a planting month",
                    "Choose irrigated or rainfed",
                    "Adjust ENSO and typhoon settings",
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-semibold">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const evt = new CustomEvent("navigate-tab", { detail: "simulation" });
                    window.dispatchEvent(evt);
                  }}
                  className="w-full px-4 py-2 rounded-xl bg-primary-foreground text-primary text-xs font-semibold hover:bg-white"
                >
                  Open Simulation Controls
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capability Stack */}
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen py-16 agri-section">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Core Capabilities
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Built for climate stress testing and decision support
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
              Combine real-world agronomy variables with stochastic weather to see how rice harvests respond
              across months, ENSO states, and typhoon intensities.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl agri-surface p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-gradient-to-br from-accent/40 via-white/80 to-transparent p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Scenario Lab
              </div>
              <div className="mt-3 text-lg font-semibold text-foreground">
                Stress test decisions before the season starts.
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-xl agri-surface px-3 py-2">Planting month</div>
                <div className="rounded-xl agri-surface px-3 py-2">Irrigation type</div>
                <div className="rounded-xl agri-surface px-3 py-2">ENSO state</div>
                <div className="rounded-xl agri-surface px-3 py-2">Typhoon probability</div>
              </div>
            </div>

            <div className="rounded-3xl agri-surface p-6 space-y-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Research Ready
              </div>
              <div className="text-lg font-semibold text-foreground">
                Exportable outputs for theses and reports.
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                Capture yield distributions, confidence intervals, and daily weather breakdowns in a
                single CSV export for quick analysis.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weather & Typhoon Generation */}
      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <WeatherTyphoonGeneration typhoonProbability={typhoonProbability} />
      </section>

      {/* Workflow */}
      <section className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
          <p className="text-sm text-muted-foreground">Three steps from setup to insight</p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute left-6 right-6 top-7 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="grid md:grid-cols-3 gap-6">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative rounded-3xl agri-surface p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="text-xs font-bold text-muted-foreground/60">0{index + 1}</div>
                  <div className="w-11 h-11 rounded-2xl bg-accent/50 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Outputs */}
      <section className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Key Outputs</h2>
          <p className="text-sm text-muted-foreground">Everything you need for risk-aware decisions</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OUTPUTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl agri-surface p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why It Matters */}
      <section className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Why It Matters</h2>
        </div>

        <div className="rounded-2xl agri-surface p-6 md:p-8 space-y-4">
          {IMPACT.map((item) => (
            <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Band */}
      <section className="max-w-7xl mx-auto">
        <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-accent/30 to-transparent p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Ready to explore
            </div>
            <div className="text-2xl font-semibold text-foreground mt-2">
              Run a scenario and see the harvest outlook.
            </div>
          </div>
          <button
            onClick={() => {
              const evt = new CustomEvent("navigate-tab", { detail: "simulation" });
              window.dispatchEvent(evt);
            }}
            className="px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-colors hover:bg-primary/90"
          >
            Launch Simulation
          </button>
        </div>
      </section>

      {/* References */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-foreground text-center">References</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {REFERENCES.map((ref) => (
            <div key={ref.title} className="rounded-2xl agri-surface p-5 space-y-2">
              <div className="text-sm font-semibold text-foreground">{ref.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{ref.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-foreground text-center">FAQ</h2>
        <div className="rounded-2xl agri-surface">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`} className="px-5">
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
