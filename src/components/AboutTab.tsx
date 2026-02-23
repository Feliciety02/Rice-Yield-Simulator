import { useMemo } from "react";
import {
  BarChart3,
  CheckCircle2,
  CloudRain,
  Database,
  FileDown,
  Leaf,
  ShieldCheck,
  Sprout,
  Timer,
  Tornado,
  Users,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSimulationStore } from "@/store/simulationStore";

const TONS_TO_SACKS = 20;
function toSacks(tons: number) {
  return Math.round(tons * TONS_TO_SACKS);
}

export default function HomeTab() {
  const { snap, viewMode } = useSimulationStore();
  const {
    status,
    currentCycleIndex,
    currentDay,
    currentWeather,
    runningMean,
    lowYieldProb,
    dailyWeatherCounts,
    dailyTyphoonSeverityCounts,
    cycleRecords,
    summary,
  } = snap;

  const isFarmer = viewMode === "farmer";
  const hasRun = status !== "idle";
  const completedCycles = cycleRecords?.length ?? 0;

  const confidence = useMemo(() => {
    if (completedCycles >= 50) return { label: "High confidence", tone: "text-emerald-700" };
    if (completedCycles >= 20) return { label: "Medium confidence", tone: "text-amber-700" };
    if (completedCycles > 0) return { label: "Low confidence", tone: "text-slate-600" };
    return { label: "No run yet", tone: "text-slate-500" };
  }, [completedCycles]);

  const totalWeather = Object.values(dailyWeatherCounts ?? {}).reduce((a, b) => a + b, 0);
  const typhoonDays = dailyWeatherCounts?.Typhoon ?? 0;
  const severeTyphoonDays = dailyTyphoonSeverityCounts?.Severe ?? 0;

  const meanText = isFarmer
    ? `${toSacks(runningMean)} sacks`
    : `${runningMean.toFixed(2)} t/ha`;

  const riskText = `${(lowYieldProb * 100).toFixed(1)}%`;
  const p5 = summary?.percentile5 ?? 0;
  const p95 = summary?.percentile95 ?? 0;

  const rangeText = isFarmer
    ? `${toSacks(p5)} to ${toSacks(p95)} sacks`
    : `${p5.toFixed(2)} to ${p95.toFixed(2)} t/ha`;

  const dominantWeather = useMemo(() => {
    if (!totalWeather) return "No weather yet";
    const entries = Object.entries(dailyWeatherCounts ?? {}).sort((a, b) => b[1] - a[1]);
    const [key, count] = entries[0];
    const pct = ((count / totalWeather) * 100).toFixed(0);
    return `${key} (${pct}%)`;
  }, [dailyWeatherCounts, totalWeather]);

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-slate-900">
      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="absolute inset-0">
            <img
              src="/images/ricefield-hero.jpg"
              alt="Rice field in the Philippines"
              className="h-full w-full object-cover"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/75 via-emerald-900/55 to-emerald-700/35" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
          </div>

          <div className="relative p-8 md:p-12">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/85 text-emerald-900 border border-white/60">Philippines focused</Badge>
              <Badge className="bg-white/85 text-emerald-900 border border-white/60">Stochastic risk simulation</Badge>
              <Badge className="bg-white/85 text-emerald-900 border border-white/60">Persistent real time engine</Badge>
            </div>

            <h1 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-white">
              Climate Driven Rice Yield Risk Simulator
            </h1>

            <p className="mt-4 max-w-2xl text-white/85 text-sm md:text-base leading-relaxed">
              Simulate 120 day crop cycles and understand yield outcomes under planting month, irrigation,
              ENSO state, and typhoon probability. Switch tabs anytime and the simulation stays live.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                Start Simulation
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/10 text-white hover:bg-white/15 px-6"
              >
                View Model Flow
              </Button>
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-3">
              <HeroMini icon={<Timer className="w-4 h-4" />} label="Crop cycle length" value="120 days" />
              <HeroMini icon={<Tornado className="w-4 h-4" />} label="Typhoon control" value="0% to 40%" />
              <HeroMini icon={<BarChart3 className="w-4 h-4" />} label="Outputs" value="Mean, CI, P5 P95, risk" />
            </div>
          </div>
        </div>
      </section>

      {/* QUICK START */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <QuickStep
                icon={<Sprout className="w-5 h-5 text-emerald-700" />}
                title="1 Choose inputs"
                desc="Planting month, irrigation, ENSO, typhoon probability."
              />
              <QuickStep
                icon={<CloudRain className="w-5 h-5 text-emerald-700" />}
                title="2 Run simulation"
                desc="Day by day or instant cycle sweep, both stay live."
              />
              <QuickStep
                icon={<FileDown className="w-5 h-5 text-emerald-700" />}
                title="3 Read results"
                desc="Check mean, expected range, low yield risk, export CSV."
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-emerald-950/80">
                {hasRun
                  ? "This snapshot updates from the running simulation."
                  : "Start a run to activate the live snapshot."}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Cycle" value={hasRun ? `${currentCycleIndex + 1}` : "0"} />
                <MiniStat label="Day" value={hasRun ? `${currentDay}` : "0"} />
                <MiniStat label="Running mean" value={hasRun ? meanText : "---"} />
                <MiniStat label="Low yield risk" value={hasRun ? riskText : "---"} />
              </div>

              <div className="rounded-xl border border-emerald-100 bg-white p-3">
                <div className="text-xs text-slate-600">Confidence</div>
                <div className={`text-sm font-semibold ${confidence.tone}`}>{confidence.label}</div>
                <div className="mt-2 text-xs text-slate-600">
                  Completed cycles: {completedCycles}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Typhoon days" value={hasRun ? `${typhoonDays}` : "0"} />
                <MiniStat label="Severe typhoon days" value={hasRun ? `${severeTyphoonDays}` : "0"} />
              </div>

              <div className="text-xs text-slate-600">
                Dominant weather mix: {hasRun ? dominantWeather : "---"}
              </div>
              <div className="text-xs text-slate-600">
                Current weather: {hasRun ? currentWeather ?? "Normal" : "---"}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* KEY OUTPUTS */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-5">
          <Feature
            icon={<BarChart3 className="w-5 h-5 text-emerald-700" />}
            title="Mean yield"
            desc="Average harvest level across completed cycles, updated in real time."
          />
          <Feature
            icon={<ShieldCheck className="w-5 h-5 text-emerald-700" />}
            title="Expected range"
            desc="P5 to P95 shows where most yields fall, useful for safe planning."
          />
          <Feature
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />}
            title="Low yield risk"
            desc="P(Yield < 2.0 t/ha) indicates downside risk under current conditions."
          />
          <Feature
            icon={<CloudRain className="w-5 h-5 text-emerald-700" />}
            title="Weather frequency"
            desc="Counts of dry, normal, wet, and typhoon days over all cycles."
          />
          <Feature
            icon={<Tornado className="w-5 h-5 text-emerald-700" />}
            title="Typhoon days"
            desc="Total typhoon exposure and severe days for storm preparedness."
          />
          <Feature
            icon={<FileDown className="w-5 h-5 text-emerald-700" />}
            title="Exportable CSV"
            desc="Cycle records and summary stats for thesis tables and figures."
          />
        </div>

        <Card className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-600">Expected range example</div>
                <div className="text-lg font-semibold text-slate-900">
                  {hasRun && summary ? rangeText : "Run simulation to compute P5 to P95 range"}
                </div>
              </div>
              <Button className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6">
                Go to Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* WHY IT MATTERS */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-3xl font-bold text-center text-green-900 mb-8">
          Why This Matters
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-3 text-sm text-slate-600">
              <div>Risk aware planting month comparisons across seasons.</div>
              <div>Irrigated vs rainfed stability with quantifiable yield gaps.</div>
              <div>ENSO stress testing for El Niño and La Niña years.</div>
              <div>Typhoon probability stress tests for storm readiness.</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
            <CardContent className="p-6 space-y-3 text-sm text-emerald-950/80">
              This simulator turns climate uncertainty into measurable risk, helping
              farmers and researchers plan planting strategies with clear expectations.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* DATA AND REFERENCES */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Data and References</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <RefBlock
              title="PAGASA"
              body="Seasonal advisories and ENSO related context for Philippine rainfall and cyclone activity."
            />
            <RefBlock
              title="IPCC"
              body="Scientific framing for climate extremes and risk based planning, including heavy rainfall trends."
            />
            <RefBlock
              title="PhilRice and DA"
              body="Philippine rice production context, planting guidance, and extension oriented references."
            />
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">FAQ</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger>What is discrete in this simulation</AccordionTrigger>
                <AccordionContent className="text-slate-700">
                  The model moves through distinct steps such as create a crop cycle, assign season,
                  assign weather state, apply a 120 day growth delay, compute yield, record results,
                  and dispose. Each step is a discrete event in the flow.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q2">
                <AccordionTrigger>Is this stochastic</AccordionTrigger>
                <AccordionContent className="text-slate-700">
                  Yes. Weather state selection is probabilistic, typhoon occurrence is probabilistic,
                  and yield includes random noise. This is why results are summarized using distributions
                  and confidence.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q3">
                <AccordionTrigger>What does low yield risk mean</AccordionTrigger>
                <AccordionContent className="text-slate-700">
                  Low yield risk is the probability that yield falls below 2.0 t per hectare.
                  It measures downside risk, not just the average.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q4">
                <AccordionTrigger>What is sacks in farmer mode</AccordionTrigger>
                <AccordionContent className="text-slate-700">
                  The app converts tons per hectare to sacks of 50 kg so farmers can interpret results quickly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q5">
                <AccordionTrigger>Does it keep running across tabs</AccordionTrigger>
                <AccordionContent className="text-slate-700">
                  Yes. The simulation engine is persistent, so switching tabs does not restart the run.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-emerald-700 text-white p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-sm text-emerald-100">Ready for your thesis tables</div>
            <div className="text-2xl font-semibold">Run a 30 cycle sweep and export CSV</div>
          </div>
          <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
            Start 30 Cycle Sweep
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            (c) {new Date().getFullYear()} Philippine Rice Yield Weather Simulator
          </div>
          <div className="text-xs text-slate-500">
            Built for farmer friendly decision support and academic reporting in the Philippines
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-2 text-white/90">
        {icon}
        <div className="text-xs font-medium">{label}</div>
      </div>
      <div className="mt-1 text-white text-base font-semibold">{value}</div>
    </div>
  );
}

function QuickStep({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600 leading-relaxed">{desc}</div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6 space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          {icon}
        </div>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-600 leading-relaxed">{desc}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function RefBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</div>
    </div>
  );
}
