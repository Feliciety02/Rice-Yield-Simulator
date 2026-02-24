import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CloudRain,
  BarChart3,
  Sprout,
  ShieldCheck,
  Zap,
  MapPin,
  Calendar,
  Download,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f7f4] text-slate-800">
      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-10">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-medium">Philippine climate risk simulation</span>
            </div>

            <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
              Climate Driven Rice Yield Risk Simulator
            </h1>

            <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
              A farmer ready, thesis grade simulator that runs real time 120 day crop cycles and
              quantifies yield variability under planting month, irrigation, ENSO state, and typhoon probability.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-6">
                Open Simulation
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-6"
              >
                View Model Flow
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700">
                Persistent engine across tabs
              </Badge>
              <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700">
                Live charts and risk metrics
              </Badge>
              <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700">
                Farmer mode and Analytics mode
              </Badge>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">What you can do here</div>
                <span className="text-xs text-slate-500">Home overview</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={<Calendar className="w-4 h-4" />} label="Crop cycle" value="120 days" />
                <MiniStat icon={<Download className="w-4 h-4" />} label="Export" value="CSV report" />
                <MiniStat icon={<CloudRain className="w-4 h-4" />} label="Weather states" value="4 types" />
                <MiniStat icon={<BarChart3 className="w-4 h-4" />} label="Outputs" value="Mean, CI, P5 P95" />
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-900">Quick start</div>
                <p className="mt-1 text-sm text-emerald-900/80">
                  Go to Simulation, choose planting month, irrigation, ENSO, and typhoon probability, then press Start.
                  Switch tabs anytime, results stay live.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Zap className="w-5 h-5 text-emerald-700" />}
            title="Persistent real time engine"
            desc="Runs continuously across Home, Simulation, Analysis, and Model Flow without restarting the simulation."
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5 text-emerald-700" />}
            title="Distribution first analytics"
            desc="Reports mean yield, standard deviation, confidence interval, percentiles, and low yield probability."
          />
          <FeatureCard
            icon={<CloudRain className="w-5 h-5 text-emerald-700" />}
            title="Philippine climate logic"
            desc="Season classification, ENSO adjustments, and typhoon probability are integrated into weather selection and yield outcomes."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900">How it works</h2>
            <span className="text-xs text-slate-500">Discrete event simulation in Arena style logic</span>
          </div>

          <div className="mt-6 grid lg:grid-cols-4 gap-4">
            <Step
              icon={<Sprout className="w-5 h-5 text-emerald-700" />}
              title="1 Set inputs"
              desc="Planting month, irrigation type, ENSO state, region, typhoon probability."
            />
            <Step
              icon={<MapPin className="w-5 h-5 text-emerald-700" />}
              title="2 Season routing"
              desc="Month logic routes the cycle into wet season or dry season settings."
            />
            <Step
              icon={<CloudRain className="w-5 h-5 text-emerald-700" />}
              title="3 Weather and hazards"
              desc="Daily weather is sampled and typhoon severity is tracked as part of exposure."
            />
            <Step
              icon={<ShieldCheck className="w-5 h-5 text-emerald-700" />}
              title="4 Yield and risk"
              desc="Yield is computed with adjustments and noise, then low yield risk is measured."
            />
          </div>

          <div className="mt-7 grid md:grid-cols-2 gap-5">
            <InfoBlock
              title="Farmer mode"
              body="Shows yield in sacks, includes simple explanations and suggested actions based on risk and typhoon exposure."
            />
            <InfoBlock
              title="Analytics mode"
              body="Shows yield in t per hectare with percentiles, confidence interval, convergence, and exportable data tables."
            />
          </div>
        </div>
      </section>

      {/* WHY IT MATTERS */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-lg font-semibold text-slate-900">Why this matters</h3>
              <p className="mt-3 text-sm md:text-base text-slate-600 leading-relaxed">
                Climate variability creates yield uncertainty. This simulator helps you compare strategies using risk metrics,
                not just averages. It supports what if analysis for planting schedules, irrigation decisions, and hazard exposure.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Bullet>Quantifies downside risk using Yield less than 2.0 t per hectare</Bullet>
                <Bullet>Shows expected range using P5 to P95</Bullet>
                <Bullet>Tracks weather mix and typhoon frequency</Bullet>
                <Bullet>Exports a clean CSV for thesis tables and figures</Bullet>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-emerald-100 shadow-sm rounded-2xl bg-emerald-50">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-lg font-semibold text-emerald-950">Recommended next actions</h3>
              <p className="mt-3 text-sm md:text-base text-emerald-950/80 leading-relaxed">
                If you are building a full report, run at least 30 replications and export CSV.
                Use Analysis to cite mean, standard deviation, confidence interval, and low yield probability.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-6">
                  Go to Analysis
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-emerald-200 text-emerald-900 hover:bg-white px-6"
                >
                  Open About
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            © {new Date().getFullYear()} Climate Driven Rice Yield Risk Simulator
          </div>
          <div className="text-xs text-slate-500">
            Built for academic research and farmer friendly decision support in the Philippines
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white">
      <CardContent className="p-6 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          {icon}
        </div>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-600 leading-relaxed">{desc}</div>
      </CardContent>
    </Card>
  );
}

function Step({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-3 font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600 leading-relaxed">{desc}</div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-700">
        <span className="text-emerald-700">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      {children}
    </div>
  );
}