import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CloudRain,
  Leaf,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  MapPin,
  Gauge,
  Database,
  GraduationCap,
  BookOpen,
  FileDown,
  SlidersHorizontal,
  Activity,
} from "lucide-react";

type Faq = { q: string; a: string; tag?: string };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
      <span className="font-semibold">{label}</span>
      <span className="mx-1 text-primary/60">•</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: Faq;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left rounded-xl border border-border bg-card/70 p-4 shadow-sm transition",
        "hover:bg-card/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
      )}
      aria-expanded={isOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground">{item.q}</div>
            {item.tag ? (
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {item.tag}
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              "text-xs text-muted-foreground leading-relaxed transition-all",
              isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
            )}
          >
            {item.a}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 text-muted-foreground transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </div>
    </button>
  );
}

export default function AboutTab() {
  const faqs: Faq[] = useMemo(
    () => [
      {
        q: "What is this simulator for?",
        a: "It estimates rice yield risk per hectare over a 120-day crop cycle using season rules, ENSO state, irrigation type, region exposure, and typhoon probability. Use it to compare scenarios and quantify uncertainty, not to predict exact harvest outcomes.",
        tag: "purpose",
      },
      {
        q: "How is this different from a forecast?",
        a: "This is a stochastic risk simulation based on historical-style probabilities and controlled parameters. It does not pull live weather data and it does not claim to forecast specific storms or rainfall amounts.",
        tag: "scope",
      },
      {
        q: "Does Region affect results?",
        a: "Yes. Region shifts typhoon exposure and seasonal weather mix. Luzon tends to have higher typhoon influence, Visayas moderate, and Mindanao lower. Region is designed to reflect relative exposure patterns for comparisons.",
        tag: "inputs",
      },
      {
        q: "When do parameter changes apply?",
        a: "Live parameters such as typhoon probability and speed can apply immediately. Structural parameters like month, irrigation, ENSO, and region are queued while a run is active and applied at the next cycle rollover to keep each cycle internally consistent.",
        tag: "rules",
      },
      {
        q: "What does Instant do?",
        a: "Instant completes cycles quickly without day-by-day visuals. It still produces the same yield distribution and summary stats, just faster, so you can test more cycles and stabilize confidence intervals sooner.",
        tag: "speed",
      },
      {
        q: "What does confidence mean here?",
        a: "Confidence increases as sample size increases. More cycles reduce random fluctuation in the mean and tighten the confidence interval. This is statistical stability, not certainty about real world events.",
        tag: "stats",
      },
      {
        q: "What if I see high low-yield risk?",
        a: "Try irrigated settings if realistic, improve drainage for typhoon-heavy scenarios, increase the number of cycles for a stable estimate, and consider shifting planting away from peak storm months based on your region profile.",
        tag: "action",
      },
    ],
    []
  );

  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(faqs[0]?.q ?? null);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        (f.tag ?? "").toLowerCase().includes(q)
    );
  }, [faqs, query]);

  return (
    <div className="space-y-6">
      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/15 via-background to-card px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  About Us
                </div>

                <h2
                  className="text-2xl font-bold text-foreground"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Philippine Rice Yield Weather Simulator
                </h2>

                <p
                  className="text-sm text-muted-foreground max-w-2xl"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  We built this simulator to support academic research and practical planning by translating climate variability
                  into understandable yield risk. It simulates a 120-day crop cycle per hectare and streams realtime results
                  across tabs so Simulation, Results, and Analysis always reflect the same run.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <StatChip label="Model" value="stochastic risk simulation" />
                  <StatChip label="Entity" value="1 ha per crop cycle" />
                  <StatChip label="Cycle" value="120 days" />
                  <StatChip label="Realtime" value="persistent across tabs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-[280px]">
                <Pill icon={GraduationCap} label="Use Case" value="thesis grade analysis" />
                <Pill icon={Activity} label="Mode" value="realtime + Monte Carlo" />
                <Pill icon={MapPin} label="Coverage" value="Luzon / Visayas / Mindanao" />
                <Pill icon={Gauge} label="Outputs" value="yield + risk metrics" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle
            className="text-base"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            What We Stand For
          </CardTitle>
        </CardHeader>
        <CardContent
          className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Database className="h-4 w-4 text-primary" />
              Transparent assumptions
            </div>
            <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
              We show what is modeled and what is not. The simulator uses probability rules, not live forecasts, so comparisons are fair and reproducible.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Scenario-first design
            </div>
            <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Designed for side-by-side experiments across ENSO, irrigation, region, planting month, and typhoon exposure to reveal risk drivers.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <BookOpen className="h-4 w-4 text-primary" />
              Thesis-ready reporting
            </div>
            <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Live charts, stable statistics, and exportable outputs support documentation, reproducible runs, and defense presentation narratives.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle
              className="text-base"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              FAQs And What-Ifs
            </CardTitle>

            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search FAQs..."
                className={cn(
                  "h-9 w-full md:w-[260px] rounded-lg border border-border bg-background px-3 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/30"
                )}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {filteredFaqs.map((item) => {
            const isOpen = openKey === item.q;
            return (
              <AccordionItem
                key={item.q}
                item={item}
                isOpen={isOpen}
                onToggle={() => setOpenKey(isOpen ? null : item.q)}
              />
            );
          })}

          {filteredFaqs.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No matches found. Try searching for month, ENSO, typhoon, export, or confidence.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-base"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent
            className="space-y-3 text-xs text-muted-foreground"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <div className="flex items-start gap-2">
              <CloudRain className="w-4 h-4 text-primary mt-0.5" />
              <div>Weather is sampled from probabilities, not pulled from live forecast APIs.</div>
            </div>
            <div className="flex items-start gap-2">
              <Leaf className="w-4 h-4 text-primary mt-0.5" />
              <div>Yield model is simplified for clarity and consistent scenario comparison.</div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
              <div>Use for planning and academic discussion, not guaranteed outcomes.</div>
            </div>

            <div className="pt-2">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <FileDown className="h-4 w-4 text-primary" />
                  Reporting tip
                </div>
                <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Export CSV after a stable run and cite the number of cycles, seed state, and parameters used for reproducibility.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-base"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Thesis Title
            </CardTitle>
          </CardHeader>
          <CardContent style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-card p-4">
              <div className="text-sm font-semibold text-foreground">
                Stochastic Discrete-Event Simulation of Climate-Driven Rice Yield Risk in the Philippines
              </div>
              <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Recommended subtitle for the paper: realtime dashboard and Monte Carlo risk mapping across planting month and typhoon probability.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatChip label="Method" value="Monte Carlo + streaming stats" />
                <StatChip label="Outputs" value="CI, percentiles, heatmap" />
                <StatChip label="Scope" value="regional exposure profiles" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
