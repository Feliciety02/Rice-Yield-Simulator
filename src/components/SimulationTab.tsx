import { useCallback, useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Zap,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sun,
  Cloud,
  CloudRain,
  Tornado,
  CalendarDays,
  Gauge,
  Leaf,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Timer,
  Wind,
  Settings2,
  BadgeCheck,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import WeatherScene from './WeatherScene';
import ChartLegend from './ChartLegend';
import { useSimulationStore } from '@/store/simulationStore';
import { LOW_YIELD_THRESHOLD, IrrigationType, ENSOState, WeatherType, TyphoonSeverity, getSeason, getWeatherWeights } from '@/lib/simulation';
import { buildDecisionSupport, rankScenarios, type ScenarioRank } from '@/lib/decisionSupport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Area, ComposedChart,
} from 'recharts';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: 'hsl(var(--weather-dry))',
  Normal: 'hsl(var(--weather-normal))',
  Wet: 'hsl(var(--weather-wet))',
  Typhoon: 'hsl(var(--weather-typhoon))',
};

const WEATHER_BG: Record<WeatherType, string> = {
  Dry: 'hsl(var(--weather-dry) / 0.18)',
  Normal: 'hsl(var(--weather-normal) / 0.18)',
  Wet: 'hsl(var(--weather-wet) / 0.18)',
  Typhoon: 'hsl(var(--weather-typhoon) / 0.18)',
};

const TYPHOON_SEVERITY_COLORS: Record<TyphoonSeverity, string> = {
  Moderate: 'hsl(var(--warning))',
  Severe: 'hsl(var(--destructive))',
};

const YIELD_COLOR = 'hsl(var(--primary))';
const BAND_FILL = 'hsl(var(--chart-2) / 0.2)';
const BAND_LEGEND = 'hsl(var(--chart-2) / 0.55)';
const MEAN_COLOR = 'hsl(var(--chart-3))';

const CARD_CLASS = 'rounded-2xl border-0 ring-1 ring-border/70 shadow-[0_20px_45px_-30px_hsl(var(--primary)/0.45)] bg-card/95';
const CARD_SOFT_CLASS = 'rounded-2xl border-0 ring-1 ring-border/60 bg-surface/70';

const SPEED_LABELS: Record<number, string> = {
  0.5: '0.5x', 1: '1x', 2: '2x', 5: '5x', 10: '10x', 20: '20x',
};

const TONS_TO_SACKS = 20;
const SCENARIO_SAMPLE_SIZE = 120;

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const SIMULATION_OVERVIEW = [
  {
    title: 'Inputs and presets',
    description:
      'Set planting month, irrigation type, ENSO state, typhoon probability, and target cycles. Presets apply common scenarios. While a run is active, changes are queued for the next cycle.',
  },
  {
    title: 'Run controls and speed',
    description:
      'Start runs day-by-day, or use Instant to sweep cycles quickly. Pause, resume, and reset are available at any time. Speed controls how fast days advance in live mode.',
  },
  {
    title: 'Live model state',
    description:
      'Track the current cycle and day, the live weather, current yield estimate, running mean, and low-yield risk. Confidence increases as more cycles complete.',
  },
  {
    title: 'Weather timeline',
    description:
      'The calendar row shows daily weather across the cycle as months shift. The active cycle uses the actual simulated timeline; other days use a seeded preview based on month and typhoon probability.',
  },
  {
    title: 'Analysis outputs',
    description:
      'Charts summarize yields over cycles with an expected range band (P5 to P95), weather frequency, yield distribution, and the running mean trend over time.',
  },
  {
    title: 'Reporting',
    description:
      'Print a formatted report and export CSV with cycle records, summary statistics, and chart data for external analysis.',
  },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--ring-soft))',
  borderRadius: 12,
  fontFamily: 'Poppins, sans-serif',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

type MetricItem = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  helper?: string;
};

type InsightTone = 'default' | 'up' | 'down' | 'steady';

type ControlParams = {
  plantingMonth: number;
  irrigationType: IrrigationType;
  ensoState: ENSOState;
  typhoonProbability: number;
  cyclesTarget: number;
  daysPerCycle: number;
};

function StatusChip({ tone, label }: { tone: 'queued' | 'live' | 'info'; label: string }) {
  const cls =
    tone === 'queued'
      ? 'bg-warning/15 text-warning'
      : tone === 'live'
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function ControlGroup({
  title,
  subtitle,
  icon,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </div>
            {badge}
          </div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="rounded-2xl border-0 ring-1 ring-border/60 bg-surface/80 shadow-none">
          <CardContent className="pt-4 pb-3 h-24 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>{item.label}</span>
              <span className="text-primary/60">{item.icon}</span>
            </div>
            <div
              className="mt-2 text-base md:text-lg font-semibold text-foreground leading-tight max-h-10 overflow-hidden"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {item.value}
            </div>
            {item.helper && (
              <div className="text-[10px] text-muted-foreground mt-1">{item.helper}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InsightLine({ tone, children }: { tone: InsightTone; children: ReactNode }) {
  const toneClass =
    tone === 'up'
      ? 'text-primary'
      : tone === 'down'
      ? 'text-destructive'
      : tone === 'steady'
      ? 'text-warning'
      : 'text-muted-foreground';
  return (
    <div className={`text-xs ${toneClass} flex items-center gap-2`}>
      {children}
    </div>
  );
}

function ChartCard({
  title,
  caption,
  insight,
  children,
}: {
  title: string;
  caption?: string;
  insight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {title}
          </CardTitle>
          {caption && <div className="text-[11px] text-muted-foreground">{caption}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {insight}
      </CardContent>
    </Card>
  );
}

function ReportActions({
  isFinished,
  onPrint,
  onExport,
}: {
  isFinished: boolean;
  onPrint: () => void;
  onExport: () => void;
}) {
  return (
    <Card className={CARD_SOFT_CLASS}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Report Actions
          </CardTitle>
          <FileText className="w-4 h-4 text-primary/70" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onExport} variant="outline" className="gap-2" disabled={!isFinished}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={onPrint} variant="outline" className="gap-2" disabled={!isFinished}>
            <Printer className="w-4 h-4" /> Print Report
          </Button>
        </div>
        {!isFinished && (
          <div className="text-[11px] text-muted-foreground">
            Export unlocks after the run finishes so the full dataset is available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatSacks(tons: number) {
  return Math.round(tons * TONS_TO_SACKS);
}

function scheduleIdle(work: () => void) {
  if (typeof window === 'undefined') {
    work();
    return () => {};
  }
  const anyWindow = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (anyWindow.requestIdleCallback) {
    const id = anyWindow.requestIdleCallback(work, { timeout: 350 });
    return () => anyWindow.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, 0);
  return () => window.clearTimeout(id);
}

function WeatherIcon({ weather, className }: { weather: WeatherType; className?: string }) {
  const cls = className ?? 'w-3 h-3';
  if (weather === 'Dry') return <Sun className={cls} style={{ color: WEATHER_COLORS.Dry }} />;
  if (weather === 'Wet') return <CloudRain className={cls} style={{ color: WEATHER_COLORS.Wet }} />;
  if (weather === 'Typhoon') return <Tornado className={cls} style={{ color: WEATHER_COLORS.Typhoon }} />;
  return <Cloud className={cls} style={{ color: WEATHER_COLORS.Normal }} />;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function firstWeekday(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).getDay();
}

function parseDateOnly(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function dateToUtcMs(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function seededWeather(day: number, month: number, year: number, typhoonProb: number) {
  const seed = Math.abs(Math.sin(day * 13 + month * 17 + year * 19) * 10000);
  const r = seed - Math.floor(seed);
  const weights = getWeatherWeights(month, typhoonProb);
  let acc = weights.Dry;
  if (r < acc) return 'Dry' as WeatherType;
  acc += weights.Normal;
  if (r < acc) return 'Normal' as WeatherType;
  acc += weights.Wet;
  if (r < acc) return 'Wet' as WeatherType;
  return 'Typhoon' as WeatherType;
}

function WeatherCalendar({
  timeline,
  typhoonSeverityTimeline,
  daysPerCycle,
  cycleStartDate,
  firstCycleStartDate,
  lastCompletedCycleStartDate,
  isFinished,
  currentCycleLabel,
  typhoonProbability,
}: {
  timeline: WeatherType[];
  typhoonSeverityTimeline: (TyphoonSeverity | null)[];
  daysPerCycle: number;
  cycleStartDate: string;
  firstCycleStartDate: string;
  lastCompletedCycleStartDate: string | null;
  isFinished: boolean;
  currentCycleLabel: 'P1' | 'P2';
  typhoonProbability: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const startDate = useMemo(() => parseDateOnly(cycleStartDate), [cycleStartDate]);
  const firstDate = useMemo(() => parseDateOnly(firstCycleStartDate), [firstCycleStartDate]);
  const lastStartDate = useMemo(
    () => (lastCompletedCycleStartDate ? parseDateOnly(lastCompletedCycleStartDate) : null),
    [lastCompletedCycleStartDate]
  );
  const maxDate = useMemo(
    () => (isFinished && lastStartDate ? addDays(lastStartDate, daysPerCycle - 1) : null),
    [daysPerCycle, isFinished, lastStartDate]
  );
  const anchorDate = useMemo(() => {
    if (isFinished && lastStartDate) {
      return lastStartDate;
    }
    return startDate;
  }, [isFinished, lastStartDate, startDate]);
  const anchorYear = anchorDate.getFullYear();
  const anchorMonthIndex = anchorDate.getMonth();
  const [calendarYear, setCalendarYear] = useState(() => anchorYear);
  const [calendarMonth, setCalendarMonth] = useState(() => anchorMonthIndex);

  useEffect(() => {
    setCalendarYear(anchorYear);
    setCalendarMonth(anchorMonthIndex);
  }, [anchorMonthIndex, anchorYear]);

  const minDate = isFinished ? firstDate : startDate;
  const minYear = minDate.getFullYear();
  const minMonth = minDate.getMonth();
  const maxYear = maxDate ? maxDate.getFullYear() : null;
  const maxMonth = maxDate ? maxDate.getMonth() : null;

  const monthName = MONTH_NAMES[calendarMonth];
  const daysInSelectedMonth = daysInMonth(calendarYear, calendarMonth);
  const startDay = anchorDate.getDate();
  const actualCycleStart = anchorDate;
  const actualCycleEnd = addDays(actualCycleStart, daysPerCycle - 1);

  const gapDays = 30;
  const plantingStart = new Date(calendarYear, anchorMonthIndex, startDay);
  const plantingEnd = new Date(plantingStart);
  plantingEnd.setDate(plantingStart.getDate() + daysPerCycle - 1);
  const plantingSecond = new Date(plantingStart);
  plantingSecond.setDate(plantingStart.getDate() + daysPerCycle + gapDays);
  const plantingSecondEnd = new Date(plantingSecond);
  plantingSecondEnd.setDate(plantingSecond.getDate() + daysPerCycle - 1);

  const plantingMarkers: Record<number, string> = {};
  const nextCycleLabel = currentCycleLabel === 'P1' ? 'P2' : 'P1';
  if (plantingStart.getFullYear() === calendarYear && plantingStart.getMonth() === calendarMonth) {
    plantingMarkers[plantingStart.getDate()] = currentCycleLabel;
  }
  if (plantingSecond.getFullYear() === calendarYear && plantingSecond.getMonth() === calendarMonth) {
    plantingMarkers[plantingSecond.getDate()] = nextCycleLabel;
  }

  const cells = Array.from({ length: daysInSelectedMonth }, (_, i) => {
    const day = i + 1;
    const currentDate = new Date(calendarYear, calendarMonth, day);
    const inActualCycle = currentDate >= actualCycleStart && currentDate <= actualCycleEnd;
    const inPreviewCycle1 = currentDate >= plantingStart && currentDate <= plantingEnd;
    const inPreviewCycle2 = currentDate >= plantingSecond && currentDate <= plantingSecondEnd;
    const inCycle = inActualCycle || inPreviewCycle1 || inPreviewCycle2;

    if (!inCycle) {
      return { day, weather: null as WeatherType | null, severity: null as TyphoonSeverity | null };
    }

    if (inActualCycle && timeline.length > 0) {
      const dayIndex = Math.floor((dateToUtcMs(currentDate) - dateToUtcMs(actualCycleStart)) / 86400000);
      const actual = timeline[dayIndex];
      if (actual) {
        const severity = actual === 'Typhoon' ? (typhoonSeverityTimeline[dayIndex] ?? null) : null;
        return { day, weather: actual, severity };
      }
    }

    const weather = seededWeather(day, calendarMonth + 1, calendarYear, typhoonProbability / 100);
    return { day, weather, severity: null as TyphoonSeverity | null };
  });

  const canGoPrev = (() => {
    const targetMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const targetYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    const targetEnd = new Date(targetYear, targetMonth + 1, 0);
    return targetEnd >= minDate;
  })();
  const canGoNext = (() => {
    if (maxDate == null) return true;
    const targetMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const targetYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const targetStart = new Date(targetYear, targetMonth, 1);
    return targetStart <= maxDate;
  })();

  const handlePrev = () => {
    if (!canGoPrev) return;
    const targetMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const targetYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    setCalendarYear(targetYear);
    setCalendarMonth(targetMonth);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const weekStart = firstWeekday(calendarYear, calendarMonth);
  const gridCells = [
    ...Array.from({ length: weekStart }, () => null),
    ...cells,
  ];

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Weather Calendar
            </CardTitle>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {monthName} {calendarYear} aligns to the current cycle start month. Two crop cycles are separated by a 30-day rest gap.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full hover:bg-primary/10"
            title={expanded ? 'Collapse calendar' : 'Expand calendar'}
            aria-label={expanded ? 'Collapse calendar' : 'Expand calendar'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {cells.map((cell) => (
            <div
              key={cell.day}
              className="w-9 h-9 rounded-lg ring-1 ring-border/60 flex items-center justify-center relative shrink-0 transition hover:shadow-sm"
              style={{ backgroundColor: cell.weather ? `${WEATHER_BG[cell.weather]}` : 'transparent' }}
              title={
                cell.weather
                  ? `Day ${cell.day}: ${cell.weather}${cell.weather === 'Typhoon' && cell.severity ? ` (${cell.severity})` : ''}`
                  : `Day ${cell.day}: Rest / land prep`
              }
            >
              <span className="absolute top-0.5 left-0.5 text-[8px] text-muted-foreground">{cell.day}</span>
              {cell.weather ? <WeatherIcon weather={cell.weather} className="w-3.5 h-3.5" /> : null}
              {cell.weather === 'Typhoon' && cell.severity && (
                <span
                  className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full ring-1 ring-white/70 shadow-sm"
                  style={{ backgroundColor: TYPHOON_SEVERITY_COLORS[cell.severity] }}
                  title={`Typhoon severity: ${cell.severity}`}
                />
              )}
              {plantingMarkers[cell.day] && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] font-semibold text-primary bg-primary/10 rounded-full px-1">
                  {plantingMarkers[cell.day]}
                </span>
              )}
            </div>
          ))}
        </div>

        {expanded && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-[36px_minmax(14ch,1fr)_36px] items-center gap-2">
                <Button size="icon" variant="outline" onClick={handlePrev} disabled={!canGoPrev} className="rounded-full">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div
                  className="text-sm font-semibold text-center"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {monthName} {calendarYear}
                </div>
                <Button size="icon" variant="outline" onClick={handleNext} disabled={!canGoNext} className="rounded-full">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <span className="text-muted-foreground">Year</span>
                <Input
                  type="number"
                  min={minYear}
                  max={maxYear ?? undefined}
                  value={calendarYear}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isNaN(val)) return;
                    const nextYear = maxYear == null ? Math.max(minYear, val) : Math.min(maxYear, Math.max(minYear, val));
                    setCalendarYear(nextYear);
                    if (nextYear === minYear) {
                      setCalendarMonth((prev) => (prev < minMonth ? minMonth : prev));
                    }
                    if (maxYear != null && maxMonth != null && nextYear === maxYear) {
                      setCalendarMonth((prev) => (prev > maxMonth ? maxMonth : prev));
                    }
                  }}
                  className="w-20 h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {gridCells.map((cell, idx) => (
                <div
                  key={`cell-${idx}`}
                  className="rounded-lg ring-1 ring-border/60 p-1 h-12 flex flex-col justify-between"
                  style={{ backgroundColor: cell && cell.weather ? `${WEATHER_BG[cell.weather]}` : 'transparent' }}
                >
                  {cell ? (
                    <>
                      <div className="text-[9px] text-muted-foreground">{cell.day}</div>
                      <div className="flex items-center justify-between">
                        {cell.weather ? <WeatherIcon weather={cell.weather} className="w-4 h-4" /> : null}
                        {cell.weather === 'Typhoon' && cell.severity && (
                          <span
                            className="text-[9px] font-semibold text-white rounded-sm px-1 leading-[1.1]"
                            style={{ backgroundColor: TYPHOON_SEVERITY_COLORS[cell.severity] }}
                            title={`Typhoon severity: ${cell.severity}`}
                          >
                            {cell.severity === 'Severe' ? 'S' : 'M'}
                          </span>
                        )}
                        {plantingMarkers[cell.day] && (
                          <span className="text-[9px] font-semibold text-primary bg-primary/10 rounded-full px-1">
                            {plantingMarkers[cell.day]}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(WEATHER_COLORS) as WeatherType[]).map((key) => (
            <span key={`legend-${key}`} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WEATHER_COLORS[key] }} />
              {key}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: TYPHOON_SEVERITY_COLORS.Moderate }} />
            Moderate (M)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: TYPHOON_SEVERITY_COLORS.Severe }} />
            Severe (S)
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">P1</span>
            Primary planting
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">P2</span>
            Second planting
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ControlRail({
  isActive,
  isRunning,
  isPaused,
  isFinished,
  mode,
  params,
  pendingParams,
  displayParams,
  speedMultiplier,
  presets,
  activePresetLabel,
  setActivePresetLabel,
  updateParams,
  setSpeed,
  start,
  startInstant,
  pause,
  resume,
  reset,
}: {
  isActive: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  mode: 'day' | 'cycle';
  params: ControlParams;
  pendingParams: Partial<Pick<ControlParams, 'plantingMonth' | 'irrigationType' | 'ensoState' | 'cyclesTarget'>>;
  displayParams: Pick<ControlParams, 'plantingMonth' | 'irrigationType' | 'ensoState' | 'typhoonProbability' | 'cyclesTarget'>;
  speedMultiplier: number;
  presets: { label: string; icon: ReactNode; params: Partial<ControlParams> }[];
  activePresetLabel: string | null;
  setActivePresetLabel: (value: string | null) => void;
  updateParams: (partial: Partial<ControlParams>) => void;
  setSpeed: (multiplier: number) => void;
  start: () => void;
  startInstant: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}) {
  const runLabel = isRunning
    ? `Running · ${mode === 'cycle' ? 'Instant sweep' : 'Day-by-day'}`
    : isPaused
    ? 'Paused'
    : isFinished
    ? 'Finished'
    : 'Idle';
  const isQueueing = isRunning || isPaused;

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Control Rail
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1">Configure the scenario and run the model.</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
            {runLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ControlGroup
          title="Planting Setup"
          subtitle="Set crop context and climate regime."
          icon={<Leaf className="w-4 h-4" />}
          badge={isQueueing && <StatusChip tone="queued" label="Applies next cycle" />}
        >
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              Planting Month
              {isQueueing && pendingParams.plantingMonth !== undefined && <StatusChip tone="queued" label="Queued" />}
            </Label>
            <Select value={String(displayParams.plantingMonth)} onValueChange={(v) => updateParams({ plantingMonth: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              Irrigation Type
              {isQueueing && pendingParams.irrigationType !== undefined && <StatusChip tone="queued" label="Queued" />}
            </Label>
            <Select value={displayParams.irrigationType} onValueChange={(v) => updateParams({ irrigationType: v as IrrigationType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Irrigated">Irrigated (+0.3 t/ha)</SelectItem>
                <SelectItem value="Rainfed">Rainfed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              ENSO State
              {isQueueing && pendingParams.ensoState !== undefined && <StatusChip tone="queued" label="Queued" />}
            </Label>
            <Select value={displayParams.ensoState} onValueChange={(v) => updateParams({ ensoState: v as ENSOState })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="El Niño">El Niño (-0.4 t/ha)</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="La Niña">La Niña (+0.3 t/ha)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Scenario Presets</Label>
              {isQueueing && <StatusChip tone="queued" label="Applies next cycle" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setActivePresetLabel(preset.label);
                    updateParams(preset.params);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    activePresetLabel === preset.label
                      ? 'bg-primary text-primary-foreground ring-primary'
                      : 'bg-card text-muted-foreground ring-border/70 hover:text-foreground hover:ring-primary/50'
                  }`}
                >
                  <span className="text-primary/70">{preset.icon}</span>
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setActivePresetLabel(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ring-1 ring-border/70 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                title="Clear preset selection"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Presets apply to the next cycle when a run is active.
            </div>
          </div>
        </ControlGroup>

        <ControlGroup
          title="Storm Risk"
          subtitle="Adjust typhoon probability live."
          icon={<Wind className="w-4 h-4" />}
          badge={<StatusChip tone="live" label="Live" />}
        >
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              Typhoon Probability: {params.typhoonProbability}%
            </Label>
            <Slider value={[params.typhoonProbability]} onValueChange={([v]) => updateParams({ typhoonProbability: v })} min={0} max={40} step={1} />
          </div>
        </ControlGroup>

        <ControlGroup
          title="Run Setup"
          subtitle="Set cycles and simulation speed."
          icon={<Settings2 className="w-4 h-4" />}
          badge={isQueueing && pendingParams.cyclesTarget !== undefined && <StatusChip tone="queued" label="Queued" />}
        >
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              Crop Cycles
              {isQueueing && pendingParams.cyclesTarget !== undefined && <StatusChip tone="queued" label="Queued" />}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={500}
                step={1}
                value={displayParams.cyclesTarget}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') return;
                  const value = Number(raw);
                  if (Number.isNaN(value)) return;
                  const clamped = Math.min(500, Math.max(1, Math.round(value)));
                  updateParams({ cyclesTarget: clamped });
                }}
                className="w-24"
              />
              <span className="text-[11px] text-muted-foreground">1-500 cycles</span>
            </div>
            <Slider
              value={[displayParams.cyclesTarget]}
              onValueChange={([v]) => updateParams({ cyclesTarget: v })}
              min={1}
              max={500}
              step={1}
            />
          </div>

          <div className="space-y-2 rounded-2xl ring-1 ring-border/60 bg-surface/90 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Speed</Label>
              <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{speedMultiplier}x</div>
            </div>
            <Slider value={[speedMultiplier]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={20} step={0.5} />
            <div className="grid grid-cols-3 gap-2">
              {[0.5, 1, 2, 5, 10, 20].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`text-xs px-2 py-1 rounded-lg ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    speedMultiplier === s
                      ? 'bg-primary text-primary-foreground ring-primary'
                      : 'ring-border/70 text-muted-foreground hover:ring-primary/50'
                  }`}
                >
                  {SPEED_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </ControlGroup>

        <ControlGroup
          title="Actions"
          subtitle="Start, pause, or reset the run."
          icon={<Timer className="w-4 h-4" />}
        >
          <div className="flex gap-2 flex-wrap">
            {isFinished || !isActive ? (
              <>
                <Button onClick={start} className="flex-1 gap-2">
                  <Play className="w-4 h-4" /> Start
                </Button>
                <Button onClick={startInstant} variant="secondary" className="flex-1 gap-2">
                  <Zap className="w-4 h-4" /> Instant
                </Button>
              </>
            ) : isRunning ? (
              <Button onClick={pause} variant="outline" className="flex-1 gap-2">
                <Pause className="w-4 h-4" /> Pause
              </Button>
            ) : (
              <Button onClick={resume} className="flex-1 gap-2">
                <Play className="w-4 h-4" /> Resume
              </Button>
            )}
            <Button onClick={reset} variant="outline" className="gap-2" size="icon" aria-label="Reset simulation">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </ControlGroup>
      </CardContent>
    </Card>
  );
}

type FarmerAdvisory = {
  riskLevel: 'low' | 'moderate' | 'high';
  situation: string;
  meaning: string;
  action: string;
};

function buildFarmerAdvisory({
  meanYield,
  lowYieldProb,
  currentYield,
  irrigationType,
  typhoonFrequency,
  useSacks,
}: {
  meanYield: number;
  lowYieldProb: number;
  currentYield: number | null;
  irrigationType: IrrigationType;
  typhoonFrequency: number;
  useSacks: boolean;
}): FarmerAdvisory {
  const meanSacks = formatSacks(meanYield);
  const currentSacks = currentYield != null ? formatSacks(currentYield) : null;
  const riskPct = (lowYieldProb * 100).toFixed(1);
  const riskLevel = lowYieldProb > 0.30 ? 'high' : lowYieldProb > 0.15 ? 'moderate' : 'low';

  const meanText = useSacks
    ? `${meanSacks} sacks of 50 kg rice`
    : `${meanYield.toFixed(2)} t/ha (${meanSacks} sacks)`;
  const currentText = currentYield != null
    ? useSacks
      ? `${currentSacks} sacks`
      : `${currentYield.toFixed(2)} t/ha (${currentSacks} sacks)`
    : null;
  const lowYieldThreshold = useSacks
    ? `${formatSacks(LOW_YIELD_THRESHOLD)} sacks`
    : `${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha`;

  const situation =
    `Average harvest is ${meanText}. ` +
    (currentText ? `Current cycle estimate is ${currentText}. ` : '') +
    `Low-yield risk is ${riskPct} percent under current conditions.`;

  const meaning =
    riskLevel === 'low'
      ? `Only about ${riskPct} out of 100 seasons fall below ${lowYieldThreshold}. Yields are relatively stable.`
      : riskLevel === 'moderate'
      ? `Roughly ${riskPct} out of 100 seasons may dip below ${lowYieldThreshold}. This is a manageable but noticeable risk.`
      : `High risk detected. About ${riskPct} out of 100 seasons may fall below ${lowYieldThreshold}.`;

  let action = 'Keep monitoring forecasts and maintain soil health for steady yields.';
  if (typhoonFrequency > 0.2) {
    action = 'Typhoon activity is frequent. Strengthen drainage, secure field edges, and plan for storm readiness.';
  } else if (irrigationType === 'Rainfed') {
    action = useSacks
      ? 'Rainfed systems are more exposed. If possible, invest in irrigation to gain about 6 extra sacks per hectare.'
      : 'Rainfed systems are more exposed. If possible, invest in irrigation to add about 0.3 t/ha.';
  } else if (riskLevel === 'high') {
    action = 'Consider shifting planting to avoid peak storm months and consult local extension officers.';
  } else if (irrigationType === 'Irrigated') {
    action = 'Irrigation is adding a yield advantage. Maintain water access to keep this benefit.';
  }

  return { riskLevel, situation, meaning, action };
}

export default function SimulationTab() {
  const { snap, start, startInstant, pause, resume, reset, setSpeed, updateParams, viewMode } = useSimulationStore();
  const {
    status, mode, params, pendingParams, speedMultiplier,
    currentCycleIndex, currentDay, dayProgress,
    currentWeather, currentYield, runningMean, runningSd, lowYieldProb,
    histogramBins, dailyWeatherCounts, dailyTyphoonSeverityCounts, yieldSeries, yieldBandSeries, yieldHistoryOverTime,
    currentCycleWeatherTimeline, currentCycleTyphoonSeverityTimeline,
    lastCompletedCycleWeatherTimeline = [], lastCompletedCycleTyphoonSeverityTimeline = [],
    cycleRecords, summary, cycleStartDate, firstCycleStartDate, lastCompletedCycleStartDate,
  } = snap;

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused || status === 'finished';
  const isIdle = status === 'idle';
  const isFinished = status === 'finished';
  const isFarmer = viewMode === 'farmer';
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(null);
  const [scenarioRanks, setScenarioRanks] = useState<ScenarioRank[] | null>(null);
  const [scenarioStatus, setScenarioStatus] = useState<'idle' | 'running' | 'done'>('idle');

  const overviewCard = (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Simulation Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <p className="text-muted-foreground leading-relaxed">
          Configure inputs on the left, run the model, and watch the analytics update in real time below.
        </p>
        <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4">
          <div className="font-semibold text-foreground mb-2">How the simulation works</div>
          <ol className="text-muted-foreground leading-relaxed list-decimal pl-5 space-y-1">
            <li>Create a new crop cycle with a start date and initialize the 120-day timeline.</li>
            <li>Assign crop parameters: planting month, irrigation type, ENSO state, and typhoon probability.</li>
            <li>Blend the season (dry, wet, or transition) based on the start month.</li>
            <li>Advance day-by-day and sample daily weather as months shift through the cycle.</li>
            <li>If a typhoon day occurs, tag a severity level (moderate or severe).</li>
            <li>Accumulate the daily weather mix and compute the base yield.</li>
            <li>Apply irrigation and ENSO adjustments, then add a small random noise term.</li>
            <li>Record the final yield (clamped at zero) and decide if it is low yield (&lt; 2.0 t/ha).</li>
            <li>Advance the calendar by the 30-day rest gap, then update totals, distributions, confidence bands, and risk metrics.</li>
          </ol>
        </div>
        <div className="grid gap-3">
          {SIMULATION_OVERVIEW.map((item) => (
            <div key={item.title} className="rounded-xl bg-surface/70 ring-1 ring-border/50 p-3">
              <div className="font-semibold text-foreground">{item.title}</div>
              <div className="text-muted-foreground leading-relaxed">{item.description}</div>
            </div>
          ))}
          {isFarmer && (
            <div className="rounded-xl bg-surface/70 ring-1 ring-border/50 p-3">
              <div className="font-semibold text-foreground">Farmer interpretation</div>
              <div className="text-muted-foreground leading-relaxed">
                In Farmer view, the interpretation card translates model metrics into plain language with
                risk context and suggested actions.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const displayParams = { ...params, ...pendingParams };
  const displayCycle = Math.min(currentCycleIndex + (isRunning || isPaused ? 1 : 0), params.cyclesTarget);
  const cyclePhase = displayCycle <= 0 ? 'P1' : (displayCycle % 2 === 1 ? 'P1' : 'P2');
  const cycleLabel = `${displayCycle} / ${params.cyclesTarget} (${cyclePhase})`;
  const displayDay = isFinished ? params.daysPerCycle : currentDay;
  const lastTimelineRef = useRef<WeatherType[]>([]);
  const lastSeverityRef = useRef<(TyphoonSeverity | null)[]>([]);

  useEffect(() => {
    if (currentCycleWeatherTimeline.length > 0) {
      lastTimelineRef.current = currentCycleWeatherTimeline;
    }
    if (currentCycleTyphoonSeverityTimeline && currentCycleTyphoonSeverityTimeline.length > 0) {
      lastSeverityRef.current = currentCycleTyphoonSeverityTimeline;
    }
  }, [currentCycleWeatherTimeline, currentCycleTyphoonSeverityTimeline]);

  useEffect(() => {
    if (lastCompletedCycleWeatherTimeline.length > 0) {
      lastTimelineRef.current = lastCompletedCycleWeatherTimeline;
    }
    if (lastCompletedCycleTyphoonSeverityTimeline.length > 0) {
      lastSeverityRef.current = lastCompletedCycleTyphoonSeverityTimeline;
    }
  }, [lastCompletedCycleWeatherTimeline, lastCompletedCycleTyphoonSeverityTimeline]);

  const completedWeatherTimeline =
    lastCompletedCycleWeatherTimeline.length > 0
      ? lastCompletedCycleWeatherTimeline
      : lastTimelineRef.current;
  const completedTyphoonTimeline =
    lastCompletedCycleTyphoonSeverityTimeline.length > 0
      ? lastCompletedCycleTyphoonSeverityTimeline
      : lastSeverityRef.current;

  const calendarWeatherTimeline = isFinished ? completedWeatherTimeline : currentCycleWeatherTimeline;
  const calendarTyphoonSeverityTimeline = isFinished
    ? completedTyphoonTimeline
    : (currentCycleTyphoonSeverityTimeline ?? []);
  const cycleStart = useMemo(() => parseDateOnly(cycleStartDate), [cycleStartDate]);
  const cycleStartMonth = cycleStart.getMonth() + 1;
  const currentSeason = useMemo(() => getSeason(cycleStartMonth), [cycleStartMonth]);

  const weatherData = useMemo(() => (
    (Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => ({
      weather: key,
      count: dailyWeatherCounts[key],
    }))
  ), [dailyWeatherCounts]);

  const yieldChartData = useMemo(() => {
    const bandMap = new Map(yieldBandSeries.map((p) => [p.cycle, p]));
    return yieldSeries.map((p) => {
      const band = bandMap.get(p.cycle);
      const p5 = band?.p5 ?? 0;
      const p95 = band?.p95 ?? p5;
      return {
        cycle: p.cycle,
        yield: Number(p.yield.toFixed(3)),
        p5: Number(p5.toFixed(3)),
        band: Number(Math.max(0, p95 - p5).toFixed(3)),
      };
    });
  }, [yieldSeries, yieldBandSeries]);

  const meanHistory = useMemo(() => (
    yieldHistoryOverTime.map((v, i) => ({ cycle: i + 1, mean: Number(v.toFixed(3)) }))
  ), [yieldHistoryOverTime]);

  const downsampledMean = meanHistory.length > 200
    ? meanHistory.filter((_, i) => i % Math.ceil(meanHistory.length / 200) === 0)
    : meanHistory;

  const totalWeather = Object.values(dailyWeatherCounts).reduce((a, b) => a + b, 0);
  const typhoonFrequency = totalWeather > 0 ? dailyWeatherCounts.Typhoon / totalWeather : 0;
  const latestYield = yieldSeries.length > 0 ? yieldSeries[yieldSeries.length - 1].yield : null;
  const latestMean = yieldHistoryOverTime.length > 0 ? yieldHistoryOverTime[yieldHistoryOverTime.length - 1] : null;
  const summaryNumbers = summary ?? null;
  const noiseSdValue = summaryNumbers?.noiseSd ?? 0.2;
  const weatherPercents = totalWeather > 0
    ? (Object.keys(dailyWeatherCounts) as WeatherType[]).reduce((acc, key) => {
      acc[key] = (dailyWeatherCounts[key] / totalWeather) * 100;
      return acc;
    }, {} as Record<WeatherType, number>)
    : null;

  const formatYieldValue = useCallback((value: number) => (
    isFarmer ? `${formatSacks(value)} sacks` : `${value.toFixed(2)} t/ha`
  ), [isFarmer]);
  const formatYieldRange = useCallback((low: number, high: number) => (
    isFarmer
      ? `${formatSacks(low)} to ${formatSacks(high)} sacks`
      : `${low.toFixed(2)} to ${high.toFixed(2)} t/ha`
  ), [isFarmer]);
  const yieldTooltipFormatter = useCallback((value: number) => (
    isFarmer ? `${formatSacks(Number(value))} sacks` : `${Number(value).toFixed(2)} t/ha`
  ), [isFarmer]);

  const confidence = useMemo(() => {
    const n = cycleRecords.length;
    if (n >= 50) return { label: 'High', tone: 'bg-primary/10 text-primary', icon: <BadgeCheck className="w-3 h-3" />, sizeClass: 'text-[11px]' };
    if (n >= 20) return { label: 'Medium', tone: 'bg-warning/15 text-warning', icon: <AlertTriangle className="w-3 h-3" />, sizeClass: 'text-[10px]' };
    return { label: 'Low', tone: 'bg-muted text-muted-foreground', icon: <Activity className="w-3 h-3" />, sizeClass: 'text-[11px]' };
  }, [cycleRecords.length]);

  const weatherStory = useMemo(() => {
    if (totalWeather === 0) return 'No weather data yet.';
    const entries = (Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => ({
      key,
      count: dailyWeatherCounts[key],
      pct: (dailyWeatherCounts[key] / totalWeather) * 100,
    })).sort((a, b) => b.count - a.count);
    const main = entries[0];
    const second = entries[1];
    const descriptor = (pct: number) =>
      pct >= 60 ? 'Mostly' :
      pct >= 35 ? 'Many' :
      pct >= 20 ? 'Some' :
      'Few';
    const parts = [
      `${descriptor(main.pct)} ${main.key} days`,
    ];
    if (second && second.pct >= 15) {
      parts.push(`${descriptor(second.pct)} ${second.key} days`);
    }
    const typhoon = entries.find((e) => e.key === 'Typhoon');
    if (typhoon && typhoon.count > 0) {
      if (dailyTyphoonSeverityCounts.Severe > 0) {
        parts.push('Severe typhoon days can reduce harvest the most.');
      } else {
        parts.push('A few typhoon days may lower harvest.');
      }
    }
    return parts.join('; ') + '.';
  }, [dailyWeatherCounts, dailyTyphoonSeverityCounts, totalWeather]);

  const metricItems = useMemo(() => {
    const cyclePill = (
      <span className="inline-flex items-center gap-2">
        <span>{displayCycle} / {params.cyclesTarget}</span>
        <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">
          {cyclePhase}
        </span>
      </span>
    );
    const confidencePill = (
      <span
        className={`inline-flex items-center justify-center gap-2 rounded-full h-7 min-w-[120px] px-3 font-semibold whitespace-nowrap ${confidence.sizeClass ?? 'text-[11px]'} ${confidence.tone}`}
      >
        {confidence.icon}
        {confidence.label}
      </span>
    );

    const base: MetricItem[] = [
      { label: 'Cycle', value: cyclePill, icon: <Layers className="w-4 h-4" /> },
      { label: 'Day', value: `${displayDay} / ${params.daysPerCycle}`, icon: <CalendarDays className="w-4 h-4" /> },
      { label: 'Season', value: currentSeason, icon: <Leaf className="w-4 h-4" /> },
    ];

    const farmerMetrics: MetricItem[] = [
      { label: 'Current Yield', value: currentYield != null ? formatYieldValue(currentYield) : '---', icon: <Gauge className="w-4 h-4" /> },
      { label: 'Running Mean', value: runningMean > 0 ? formatYieldValue(runningMean) : '---', icon: <Activity className="w-4 h-4" /> },
      { label: 'Natural Variability', value: `${formatSacks(noiseSdValue)} sacks SD`, icon: <Sparkles className="w-4 h-4" /> },
      { label: 'Low Yield Risk', value: `${(lowYieldProb * 100).toFixed(1)}%`, icon: <ShieldCheck className="w-4 h-4" /> },
    ];

    const analyticsMetrics: MetricItem[] = [
      { label: 'Current Yield', value: currentYield != null ? `${currentYield.toFixed(2)} t/ha` : '---', icon: <Gauge className="w-4 h-4" /> },
      { label: 'Running Mean', value: runningMean > 0 ? `${runningMean.toFixed(2)} t/ha` : '---', icon: <Activity className="w-4 h-4" /> },
      { label: 'Random Noise SD', value: `${noiseSdValue.toFixed(2)} t/ha`, icon: <Sparkles className="w-4 h-4" /> },
      { label: 'Low Yield Risk', value: `${(lowYieldProb * 100).toFixed(1)}%`, icon: <ShieldCheck className="w-4 h-4" /> },
    ];

    return [
      ...base,
      ...(isFarmer ? farmerMetrics : analyticsMetrics),
      { label: 'Confidence', value: confidencePill, icon: <ShieldCheck className="w-4 h-4" /> },
    ];
  }, [
    confidence, currentSeason, currentYield, cyclePhase, displayCycle, displayDay, formatYieldValue,
    isFarmer, lowYieldProb, noiseSdValue, params.cyclesTarget, params.daysPerCycle, runningMean,
  ]);

  const yieldTrendInsight = useMemo(() => {
    if (yieldHistoryOverTime.length < 3) {
      return { tone: 'default' as InsightTone, icon: <Activity className="w-3 h-3" />, text: 'Run more cycles to reveal a yield trend.' };
    }
    const window = yieldHistoryOverTime.slice(-5);
    const delta = window[window.length - 1] - window[0];
    const abs = Math.abs(delta);
    const deltaText = isFarmer ? `${Math.round(abs * 20)} sacks` : `${abs.toFixed(2)} t/ha`;
    if (abs < 0.03) {
      return { tone: 'steady' as InsightTone, icon: <Activity className="w-3 h-3" />, text: `Mean is steady over the last ${window.length} cycles.` };
    }
    return {
      tone: delta > 0 ? 'up' as InsightTone : 'down' as InsightTone,
      icon: delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />,
      text: `Mean is ${delta > 0 ? 'up' : 'down'} by ${deltaText} over the last ${window.length} cycles.`,
    };
  }, [isFarmer, yieldHistoryOverTime]);

  const weatherInsight = useMemo(() => {
    if (!weatherPercents) {
      return { tone: 'default' as InsightTone, icon: <Cloud className="w-3 h-3" />, text: 'Weather mix appears after the first cycle.' };
    }
    const entries = Object.entries(weatherPercents).sort((a, b) => b[1] - a[1]);
    const [dominant, pct] = entries[0] as [WeatherType, number];
    return {
      tone: 'default' as InsightTone,
      icon: <WeatherIcon weather={dominant} className="w-3 h-3" />,
      text: `Dominant weather is ${dominant} at ${pct.toFixed(1)}%.`,
    };
  }, [weatherPercents]);

  const distributionInsight = useMemo(() => {
    if (histogramBins.length === 0) {
      return { tone: 'default' as InsightTone, icon: <Layers className="w-3 h-3" />, text: 'Distribution appears after the first few cycles.' };
    }
    const top = histogramBins.reduce((acc, b) => (b.count > acc.count ? b : acc), histogramBins[0]);
    if (!top || top.count === 0) {
      return { tone: 'default' as InsightTone, icon: <Layers className="w-3 h-3" />, text: 'Distribution appears after the first few cycles.' };
    }
    const start = Number(top.label);
    const end = start + 0.5;
    const label = isFarmer
      ? `${formatSacks(start)}-${formatSacks(end)} sacks`
      : `${start.toFixed(1)}-${end.toFixed(1)} t/ha`;
    return { tone: 'default' as InsightTone, icon: <Layers className="w-3 h-3" />, text: `Most common bin: ${label}.` };
  }, [histogramBins, isFarmer]);

  const meanInsight = useMemo(() => {
    if (yieldHistoryOverTime.length < 6) {
      return { tone: 'default' as InsightTone, icon: <Activity className="w-3 h-3" />, text: 'Running mean stabilizes as more cycles complete.' };
    }
    const window = yieldHistoryOverTime.slice(-6);
    const spread = Math.max(...window) - Math.min(...window);
    const spreadText = isFarmer ? `${Math.round(spread * 20)} sacks` : `${spread.toFixed(2)} t/ha`;
    if (spread < 0.04) {
      return { tone: 'steady' as InsightTone, icon: <BadgeCheck className="w-3 h-3" />, text: `Stabilizing over the last ${window.length} cycles (${spreadText} spread).` };
    }
    return { tone: 'default' as InsightTone, icon: <Activity className="w-3 h-3" />, text: `Still shifting over the last ${window.length} cycles (${spreadText} spread).` };
  }, [isFarmer, yieldHistoryOverTime]);

  const decisionSupport = useMemo(() => buildDecisionSupport({
    lowYieldProb,
    typhoonFrequency,
    expectedRange: summaryNumbers ? { p5: summaryNumbers.percentile5, p95: summaryNumbers.percentile95 } : null,
    cycles: cycleRecords.length,
    irrigationType: params.irrigationType,
  }), [cycleRecords.length, lowYieldProb, params.irrigationType, summaryNumbers, typhoonFrequency]);

  useEffect(() => {
    let cancelled = false;
    setScenarioStatus('running');
    const cancel = scheduleIdle(() => {
      const ranks = rankScenarios({
        months: Array.from({ length: 12 }, (_, index) => index + 1),
        irrigationTypes: ['Irrigated', 'Rainfed'],
        ensoStates: ['El Niño', 'Neutral', 'La Niña'],
        typhoonProbability: params.typhoonProbability,
        daysPerCycle: params.daysPerCycle,
        numCycles: SCENARIO_SAMPLE_SIZE,
      });
      if (cancelled) return;
      setScenarioRanks(ranks);
      setScenarioStatus('done');
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [params.daysPerCycle, params.typhoonProbability]);

  const recommendedScenario = scenarioRanks?.[0] ?? null;
  const currentScenario = useMemo(() => {
    if (!scenarioRanks) return null;
    return scenarioRanks.find((scenario) =>
      scenario.plantingMonth === params.plantingMonth &&
      scenario.irrigationType === params.irrigationType &&
      scenario.ensoState === params.ensoState
    ) ?? null;
  }, [params.ensoState, params.irrigationType, params.plantingMonth, scenarioRanks]);

  const formatScenarioYield = useCallback((value: number) => (
    isFarmer ? `${formatSacks(value)} sacks` : `${value.toFixed(2)} t/ha`
  ), [isFarmer]);

  const formatScenarioDelta = useCallback((value: number) => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return isFarmer
      ? `${sign}${formatSacks(abs)} sacks`
      : `${sign}${abs.toFixed(2)} t/ha`;
  }, [isFarmer]);

  const decisionToneClass =
    decisionSupport.tone === 'safe'
      ? 'bg-primary/10 text-primary'
      : decisionSupport.tone === 'caution'
      ? 'bg-warning/15 text-warning'
      : 'bg-destructive/15 text-destructive';

  const comparisonSummary = useMemo(() => {
    if (!recommendedScenario || !currentScenario) return null;
    const isSame =
      recommendedScenario.plantingMonth === currentScenario.plantingMonth &&
      recommendedScenario.irrigationType === currentScenario.irrigationType &&
      recommendedScenario.ensoState === currentScenario.ensoState;
    if (isSame) {
      return 'Your current setup is already the top-ranked option under the current typhoon setting.';
    }
    const meanGain = recommendedScenario.meanYield - currentScenario.meanYield;
    const riskDrop = (currentScenario.lowYieldProb - recommendedScenario.lowYieldProb) * 100;
    return `${MONTH_NAMES[recommendedScenario.plantingMonth - 1]} with ${recommendedScenario.irrigationType.toLowerCase()} and ${recommendedScenario.ensoState} performs better by ${formatScenarioDelta(meanGain)} on average and lowers low-yield risk by ${riskDrop.toFixed(1)} points.`;
  }, [currentScenario, formatScenarioDelta, recommendedScenario]);

  const decisionBreakdown = useMemo(() => decisionSupport.reasons.map((reason) => {
    const toneClass =
      reason.tone === 'safe'
        ? 'bg-primary/10 text-primary ring-primary/20'
        : reason.tone === 'caution'
        ? 'bg-warning/10 text-warning ring-warning/20'
        : reason.tone === 'risk'
        ? 'bg-destructive/10 text-destructive ring-destructive/20'
        : 'bg-muted text-muted-foreground ring-border/60';
    return { ...reason, toneClass };
  }), [decisionSupport.reasons]);

  const farmerAdvisory = useMemo(() => buildFarmerAdvisory({
    meanYield: runningMean,
    lowYieldProb,
    currentYield,
    irrigationType: params.irrigationType,
    typhoonFrequency,
    useSacks: true,
  }), [currentYield, lowYieldProb, params.irrigationType, runningMean, typhoonFrequency]);
  const farmerToneClass =
    farmerAdvisory.riskLevel === 'low'
      ? 'bg-primary/10 text-primary'
      : farmerAdvisory.riskLevel === 'moderate'
      ? 'bg-warning/15 text-warning'
      : 'bg-destructive/15 text-destructive';

  const presets = [
    { label: 'Dry Season Rainfed', icon: <Sun className="w-3 h-3" />, params: { plantingMonth: 2, irrigationType: 'Rainfed' as IrrigationType, ensoState: 'Neutral' as ENSOState, typhoonProbability: 5 } },
    { label: 'Wet Season Irrigated', icon: <CloudRain className="w-3 h-3" />, params: { plantingMonth: 7, irrigationType: 'Irrigated' as IrrigationType, ensoState: 'Neutral' as ENSOState, typhoonProbability: 15 } },
    { label: 'High Typhoon', icon: <Tornado className="w-3 h-3" />, params: { typhoonProbability: 35 } },
    { label: 'La Niña Boost', icon: <Sparkles className="w-3 h-3" />, params: { ensoState: 'La Niña' as ENSOState, irrigationType: 'Irrigated' as IrrigationType } },
    { label: 'El Niño Stress', icon: <AlertTriangle className="w-3 h-3" />, params: { ensoState: 'El Niño' as ENSOState, irrigationType: 'Rainfed' as IrrigationType } },
  ];

  const handleExport = useCallback(() => {
    if (cycleRecords.length === 0) return;

    const csvEscape = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const empty = (count: number) => Array.from({ length: count }, () => '');
    const normalizeRow = (cells: (string | number)[], width: number) => {
      const normalized = cells.map((cell) => (cell == null ? '' : String(cell)));
      return [...normalized, ...empty(width - normalized.length)];
    };
    const formatValueText = (value: number) =>
      isFarmer ? `${formatSacks(value)} sacks` : `${value.toFixed(2)} t/ha`;
    const formatRangeText = (low: number, high: number) =>
      isFarmer
        ? `${formatSacks(low)} to ${formatSacks(high)} sacks`
        : `${low.toFixed(2)} to ${high.toFixed(2)} t/ha`;
    type SectionBlock = { width: number; rows: string[][] };
    const sections: SectionBlock[] = [];
    const appendSection = (
      title: string,
      interpretationText: string,
      conclusionText: string,
      recommendationText: string,
      headers: string[],
      dataRows: (string | number)[][]
    ) => {
      const width = Math.max(
        1,
        headers.length,
        ...dataRows.map((row) => row.length),
        interpretationText ? 2 : 1,
        conclusionText ? 2 : 1,
        recommendationText ? 2 : 1
      );
      const sectionRows: string[][] = [];
      sectionRows.push([`=== ${title} ===`, ...empty(width - 1)]);
      if (interpretationText) {
        sectionRows.push(normalizeRow(['Interpretation', interpretationText], width));
      }
      if (headers.length > 0) {
        sectionRows.push(normalizeRow(headers, width));
      }
      dataRows.forEach((row) => sectionRows.push(normalizeRow(row, width)));
      if (conclusionText) {
        sectionRows.push(normalizeRow(['Conclusion', conclusionText], width));
      }
      if (recommendationText) {
        sectionRows.push(normalizeRow(['Recommendation', recommendationText], width));
      }
      sectionRows.push(empty(width));
      sections.push({ width, rows: sectionRows });
    };

    const s = summary;
    const n = cycleRecords.length;
    const ciLow = s?.ciLow ?? (runningMean - 1.96 * runningSd / Math.sqrt(Math.max(1, n)));
    const ciHigh = s?.ciHigh ?? (runningMean + 1.96 * runningSd / Math.sqrt(Math.max(1, n)));

    const totalDays = Object.values(dailyWeatherCounts).reduce((a, b) => a + b, 0) || 1;
    const totalTyphoonDays = dailyTyphoonSeverityCounts.Moderate + dailyTyphoonSeverityCounts.Severe;
    const meanValue = s?.mean ?? runningMean;
    const stdValue = s?.std ?? runningSd;
    const minValue = s?.min ?? 0;
    const maxValue = s?.max ?? 0;
    const p5Value = s?.percentile5 ?? 0;
    const p95Value = s?.percentile95 ?? 0;
    const ciWidth = Math.max(0, ciHigh - ciLow);
    const lowYieldPct = lowYieldProb * 100;
    const lowThresholdLabel = `${LOW_YIELD_THRESHOLD.toFixed(1)} t/ha (${formatSacks(LOW_YIELD_THRESHOLD)} sacks)`;
    const dominantWeatherEntry = (Object.entries(dailyWeatherCounts) as [WeatherType, number][])
      .sort((a, b) => b[1] - a[1])[0];
    const dominantWeather = dominantWeatherEntry?.[0] ?? 'Normal';
    const dominantWeatherPct = dominantWeatherEntry ? (dominantWeatherEntry[1] / totalDays) * 100 : 0;
    const typhoonDayPct = (dailyWeatherCounts.Typhoon / totalDays) * 100;
    const severeTyphoonPct = totalTyphoonDays > 0
      ? (dailyTyphoonSeverityCounts.Severe / totalTyphoonDays) * 100
      : 0;
    const lowestCycle = cycleRecords.reduce(
      (lowest, cycle) => (cycle.yieldTons < lowest.yieldTons ? cycle : lowest),
      cycleRecords[0]
    );
    const highestCycle = cycleRecords.reduce(
      (highest, cycle) => (cycle.yieldTons > highest.yieldTons ? cycle : highest),
      cycleRecords[0]
    );
    const currentVsMean = latestYield != null ? latestYield - meanValue : null;
    const mostCommonBin = histogramBins.length > 0
      ? histogramBins.reduce((best, bin) => (bin.count > best.count ? bin : best), histogramBins[0])
      : null;
    const mostCommonBinStart = mostCommonBin ? Number(mostCommonBin.label) : 0;
    const mostCommonBinLabel = mostCommonBin
      ? `${mostCommonBin.label}-${(mostCommonBinStart + 0.5).toFixed(1)} t/ha`
      : 'n/a';
    const riskBand = lowYieldProb >= 0.30 ? 'high' : lowYieldProb >= 0.15 ? 'moderate' : 'low';
    const variabilityBand = stdValue >= 0.60 ? 'high' : stdValue >= 0.30 ? 'moderate' : 'low';

    const cycleInterpretation =
      `Each row represents one completed crop cycle with final yield, season, dominant weather, storm severity, irrigation, ENSO, and typhoon probability. ` +
      `Across ${n} completed cycles, the lowest yield was ${formatValueText(lowestCycle.yieldTons)} in cycle ${lowestCycle.cycleIndex}, while the highest yield was ${formatValueText(highestCycle.yieldTons)} in cycle ${highestCycle.cycleIndex}. ` +
      `Use these records to trace which combinations of weather and management repeatedly align with weak or strong harvests.`;
    const cycleConclusion =
      `The run spans from ${formatValueText(lowestCycle.yieldTons)} to ${formatValueText(highestCycle.yieldTons)}, which confirms that seasonal conditions can move outcomes substantially from one cycle to the next. ` +
      `The weakest cycle should be treated as the clearest stress-case example for this scenario.`;
    const cycleRecommendation =
      `Review cycles at or below ${lowThresholdLabel} first, then compare their planting month, irrigation, ENSO, and storm exposure against the highest-yield cycles to identify which setup changes are most defensible for the next run.`;

    const summaryInterpretation =
      `This section condenses overall performance into average yield, spread, and uncertainty. The current mean is ${formatValueText(meanValue)}, the likely range is ${formatRangeText(p5Value, p95Value)}, and low-yield risk is ${lowYieldPct.toFixed(1)}% for the threshold ${lowThresholdLabel}. ` +
      `The 95% confidence interval runs from ${formatValueText(ciLow)} to ${formatValueText(ciHigh)}, a width of ${formatValueText(ciWidth)}, so confidence is currently ${confidence.label.toLowerCase()}.`;
    const summaryConclusion =
      riskBand === 'high'
        ? `Downside exposure is high and variability is ${variabilityBand}, so planning around the mean alone would be too optimistic.`
        : riskBand === 'moderate'
        ? `Downside exposure is moderate; use the lower tail, not just the mean, when deciding inputs and targets.`
        : `Downside exposure is relatively contained, although variability remains ${variabilityBand} and should still be monitored.`;
    const summaryRecommendation =
      confidence.label === 'Low'
        ? 'Run more cycles before locking planning assumptions; the confidence interval is still based on a limited sample.'
        : confidence.label === 'Medium'
        ? 'Use the mean for baseline planning, but keep budgets and yield targets anchored closer to P5 until more cycles narrow the interval.'
        : 'Use the mean as the central planning case and P5 as the contingency case for budgeting, storage, and sales commitments.';

    const weatherInterpretation =
      `This table counts every simulated day by weather type. ${dominantWeather} was the dominant condition at ${dominantWeatherPct.toFixed(1)}% of all days, while typhoon days accounted for ${typhoonDayPct.toFixed(1)}%. ` +
      `${weatherStory} The daily mix matters because persistent dry or storm-heavy patterns can drag down the final cycle average even when a few days are favorable.`;
    const weatherConclusion =
      dominantWeather === 'Dry' || dominantWeather === 'Typhoon'
        ? `The run is weather-stressed overall because ${dominantWeather.toLowerCase()} conditions dominated the calendar.`
        : `The weather mix is comparatively supportive because ${dominantWeather.toLowerCase()} conditions dominated the calendar rather than extreme stress days.`;
    const weatherRecommendation =
      dominantWeather === 'Dry'
        ? 'Prioritize irrigation timing, water retention, and conservative yield targets when the daily mix is dry-heavy.'
        : dominantWeather === 'Typhoon'
        ? 'Prioritize drainage, wind protection, and recovery planning when typhoon days consume a meaningful share of the calendar.'
        : 'Preserve the current scenario assumptions as a baseline, but keep watching whether dry or typhoon shares rise in later runs.';

    const typhoonInterpretation = totalTyphoonDays > 0
      ? `Typhoon days made up ${typhoonDayPct.toFixed(1)}% of all simulated days. Within storm days, ${dailyTyphoonSeverityCounts.Severe} of ${totalTyphoonDays} were severe (${severeTyphoonPct.toFixed(1)}%), which helps separate mild disruption from major yield damage. ` +
        `A higher severe share usually means deeper harvest losses and slower recovery after storm events.`
      : 'No typhoon days were recorded in the completed cycles, so storm severity did not contribute to yield loss in this run. This makes the current output more reflective of non-storm weather stress than cyclone damage.';
    const typhoonConclusion = totalTyphoonDays === 0
      ? 'Storm risk is currently latent rather than observed in the completed data, so the run should not be interpreted as proof of storm resilience.'
      : severeTyphoonPct >= 50
      ? 'Storm pressure is materially severe in this run because at least half of typhoon days fall in the severe category.'
      : 'Storm pressure is present but not dominated by severe events, which suggests moderate disruption is more common than catastrophic loss in this sample.';
    const typhoonRecommendation = totalTyphoonDays === 0
      ? 'Keep running additional cycles if you need storm-sensitive conclusions; the present sample is too light on typhoon events to support strong field recommendations.'
      : severeTyphoonPct >= 50
      ? 'Plan around severe-event readiness first: drainage, bund integrity, lodging control, and post-storm recovery logistics.'
      : 'Maintain storm-readiness measures, but focus equally on reducing chronic seasonal stress because moderate storms currently outnumber severe ones.';

    const yieldSeriesInterpretation =
      `This table lists yield in cycle order so you can see drift, shocks, and recovery over time. ${yieldTrendInsight.text} ` +
      (latestYield != null
        ? `The latest completed cycle finished at ${formatValueText(latestYield)}, which is ${currentVsMean != null && currentVsMean >= 0 ? `${formatValueText(Math.abs(currentVsMean))} above` : `${formatValueText(Math.abs(currentVsMean ?? 0))} below`} the current mean.`
        : '');
    const yieldSeriesConclusion =
      currentVsMean == null
        ? 'The series is available, but no latest-versus-mean comparison could be derived from the current data.'
        : currentVsMean < 0
        ? 'Recent performance is running below the average, which is a warning sign if that pattern persists in additional cycles.'
        : 'Recent performance is at or above the average, which suggests the current scenario is not deteriorating in the latest cycle.';
    const yieldSeriesRecommendation =
      currentVsMean != null && currentVsMean < 0
        ? 'Inspect the most recent below-average cycles for recurring stress signals before assuming the long-run mean will hold.'
        : 'Continue monitoring cycle-to-cycle movement, but use the full sequence rather than any single strong cycle when setting expectations.';

    const expectedRangeInterpretation =
      `P5-P95 defines the band where most completed cycles are expected to land. The current range spans ${formatRangeText(p5Value, p95Value)} with a total width of ${formatValueText(Math.max(0, p95Value - p5Value))}. ` +
      `Narrower bands imply more stable performance, while wider bands imply greater uncertainty around what a single season may produce.`;
    const expectedRangeConclusion =
      p95Value - p5Value >= 1
        ? 'The expected range is wide, so a single-season outcome can deviate materially from the mean.'
        : p95Value - p5Value >= 0.5
        ? 'The expected range is moderately wide, which supports cautious planning rather than aggressive yield targets.'
        : 'The expected range is comparatively tight, which indicates this scenario is behaving more consistently across completed cycles.';
    const expectedRangeRecommendation =
      p95Value - p5Value >= 1
        ? 'Use P5 for worst-case budgeting and avoid committing inputs or sales volumes to the upper tail of the range.'
        : 'Use the mean for the base plan and keep contingency plans tied to P5 if later cycles widen the band.';

    const runningMeanInterpretation =
      `This table tracks the cumulative average as more cycles complete. ${meanInsight.text} ` +
      `The latest running mean is ${formatValueText(latestMean ?? meanValue)}, and its value becomes more useful as the sample size grows.`;
    const runningMeanConclusion =
      confidence.label === 'Low'
        ? 'The running mean is still an early estimate and may move noticeably as more cycles are added.'
        : confidence.label === 'Medium'
        ? 'The running mean is becoming usable for planning, but it still needs more cycles before it should be treated as fully settled.'
        : 'The running mean is mature enough to function as the best single long-run estimate in this scenario.';
    const runningMeanRecommendation =
      confidence.label === 'High'
        ? 'Use the running mean in discussions about typical production, but keep the lower-tail metrics available for risk planning.'
        : 'Continue the simulation until the running mean changes only marginally across additional cycles before finalizing assumptions.';

    const histogramInterpretation =
      `This table groups cycle yields into bins to show the most common harvest zone instead of only the average. ${distributionInsight.text} ` +
      `The densest bin in this run is ${mostCommonBinLabel}, which indicates where results cluster most often.`;
    const histogramConclusion =
      mostCommonBinStart < LOW_YIELD_THRESHOLD
        ? 'The distribution centers below the low-yield threshold, so downside outcomes are not just possible but structurally common in this scenario.'
        : mostCommonBinStart <= HIGH_YIELD_THRESHOLD
        ? 'The distribution centers in the middle range, which suggests moderate harvest outcomes are more typical than exceptional ones.'
        : 'The distribution centers in the higher bins, which suggests stronger harvest outcomes occur more often than weak ones in this scenario.';
    const histogramRecommendation =
      mostCommonBinStart < LOW_YIELD_THRESHOLD
        ? 'Set plans around the low-to-mid bins and treat higher bins as upside rather than the base case.'
        : 'Anchor storage, labor, and sales plans around the most common bin instead of the maximum observed yield.';

    appendSection(
      'Cycle Records',
      cycleInterpretation,
      cycleConclusion,
      cycleRecommendation,
      [
        'Cycle',
        'Final Yield (t/ha)',
        'Final Yield (sacks)',
        'Season',
        'Dominant Weather',
        'Dominant Typhoon Severity',
        'Typhoon Days',
        'Severe Typhoon Days',
        'ENSO State',
        'Irrigation Type',
        'Cycle Start Month',
        'Typhoon Probability (%)',
      ],
      cycleRecords.map((r) => ([
        r.cycleIndex,
        r.yieldTons.toFixed(4),
        r.yieldSacks.toFixed(2),
        r.season,
        r.weather,
        r.dominantTyphoonSeverity ?? '',
        r.typhoonDays,
        r.severeTyphoonDays,
        r.ensoState,
        r.irrigationType,
        r.plantingMonth,
        r.typhoonProbability.toFixed(1),
      ]))
    );

    const summaryRows: (string | number)[][] = [
      ['Completed Cycles', n, ''],
      ['Mean Yield (t/ha)', meanValue.toFixed(4), formatSacks(meanValue)],
      ['Std Deviation (t/ha)', stdValue.toFixed(4), formatSacks(stdValue)],
      ['Min Yield (t/ha)', minValue.toFixed(4), formatSacks(minValue)],
      ['Max Yield (t/ha)', maxValue.toFixed(4), formatSacks(maxValue)],
      ['5th Percentile (t/ha)', p5Value.toFixed(4), formatSacks(p5Value)],
      ['95th Percentile (t/ha)', p95Value.toFixed(4), formatSacks(p95Value)],
      ['95% CI Lower (t/ha)', ciLow.toFixed(4), formatSacks(ciLow)],
      ['95% CI Upper (t/ha)', ciHigh.toFixed(4), formatSacks(ciHigh)],
    ];
    if (s) {
      summaryRows.push(['CI Width (t/ha)', s.ciWidth.toFixed(4), formatSacks(s.ciWidth)]);
      summaryRows.push(['Weather Variability SD (t/ha)', s.deterministicSd.toFixed(4), formatSacks(s.deterministicSd)]);
      summaryRows.push(['Random Noise SD (t/ha)', s.noiseSd.toFixed(4), formatSacks(s.noiseSd)]);
    }
    summaryRows.push(['Low Yield Probability (%)', (lowYieldProb * 100).toFixed(2), '']);

    appendSection(
      'Summary',
      summaryInterpretation,
      summaryConclusion,
      summaryRecommendation,
      ['Metric', 'Value (t/ha)', 'Value (sacks)'],
      summaryRows
    );

    appendSection(
      'Daily Weather Counts',
      weatherInterpretation,
      weatherConclusion,
      weatherRecommendation,
      ['Weather', 'Days', 'Percent'],
      (Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => {
        const count = dailyWeatherCounts[key];
        const pct = (count / totalDays) * 100;
        return [key, count, pct.toFixed(2)];
      })
    );

    appendSection(
      'Typhoon Severity Counts',
      typhoonInterpretation,
      typhoonConclusion,
      typhoonRecommendation,
      ['Severity', 'Days', 'Percent of Typhoon Days'],
      [
        ['Moderate', dailyTyphoonSeverityCounts.Moderate, totalTyphoonDays ? ((dailyTyphoonSeverityCounts.Moderate / totalTyphoonDays) * 100).toFixed(2) : '0.00'],
        ['Severe', dailyTyphoonSeverityCounts.Severe, totalTyphoonDays ? ((dailyTyphoonSeverityCounts.Severe / totalTyphoonDays) * 100).toFixed(2) : '0.00'],
      ]
    );

    appendSection(
      'Yield Over Cycles',
      yieldSeriesInterpretation,
      yieldSeriesConclusion,
      yieldSeriesRecommendation,
      ['Cycle', 'Yield (t/ha)', 'Yield (sacks)'],
      yieldSeries.map((p) => ([p.cycle, p.yield.toFixed(4), formatSacks(p.yield)]))
    );

    appendSection(
      'Expected Range (P5-P95)',
      expectedRangeInterpretation,
      expectedRangeConclusion,
      expectedRangeRecommendation,
      ['Cycle', 'Mean (t/ha)', 'P5 (t/ha)', 'P95 (t/ha)', 'Mean (sacks)', 'P5 (sacks)', 'P95 (sacks)'],
      yieldBandSeries.map((p) => ([
        p.cycle,
        p.mean.toFixed(4),
        p.p5.toFixed(4),
        p.p95.toFixed(4),
        formatSacks(p.mean),
        formatSacks(p.p5),
        formatSacks(p.p95),
      ]))
    );

    appendSection(
      'Running Mean',
      runningMeanInterpretation,
      runningMeanConclusion,
      runningMeanRecommendation,
      ['Cycle', 'Mean (t/ha)', 'Mean (sacks)'],
      yieldHistoryOverTime.map((value, index) => ([index + 1, value.toFixed(4), formatSacks(value)]))
    );

    appendSection(
      'Yield Distribution',
      histogramInterpretation,
      histogramConclusion,
      histogramRecommendation,
      ['Bin Start (t/ha)', 'Bin Range (sacks)', 'Count'],
      histogramBins.map((bin) => {
        const start = Number(bin.label);
        const end = start + 0.5;
        return [bin.label, `${formatSacks(start)}-${formatSacks(end)} sacks`, bin.count];
      })
    );

    const sectionsPerFrame = 3;
    const sectionGapColumns = 1;
    const frames: SectionBlock[][] = [];
    for (let i = 0; i < sections.length; i += sectionsPerFrame) {
      frames.push(sections.slice(i, i + sectionsPerFrame));
    }

    const rows: string[][] = [];
    frames.forEach((frame, frameIndex) => {
      const maxRows = Math.max(0, ...frame.map((section) => section.rows.length));
      const frameWidth = frame.reduce(
        (acc, section, index) => acc + section.width + (index > 0 ? sectionGapColumns : 0),
        0
      );

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        const combined: string[] = [];
        frame.forEach((section, sectionIndex) => {
          const sectionRow = section.rows[rowIndex] ?? empty(section.width);
          combined.push(...sectionRow);
          if (sectionIndex < frame.length - 1) {
            combined.push(...empty(sectionGapColumns));
          }
        });
        rows.push(combined);
      }

      if (frameIndex < frames.length - 1) {
        rows.push(empty(frameWidth));
      }
    });

    const csvContent = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href = url;
    a.download = `rice_yield_simulation_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    cycleRecords, lowYieldProb, runningMean, runningSd, summary,
    dailyWeatherCounts, dailyTyphoonSeverityCounts, yieldSeries, yieldBandSeries, yieldHistoryOverTime, histogramBins,
    yieldTrendInsight, distributionInsight, meanInsight, isFarmer, weatherStory, latestYield, latestMean, confidence,
  ]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const controlRail = (
    <ControlRail
      isActive={isActive}
      isRunning={isRunning}
      isPaused={isPaused}
      isFinished={isFinished}
      mode={mode}
      params={params}
      pendingParams={pendingParams}
      displayParams={displayParams}
      speedMultiplier={speedMultiplier}
      presets={presets}
      activePresetLabel={activePresetLabel}
      setActivePresetLabel={setActivePresetLabel}
      updateParams={updateParams}
      setSpeed={setSpeed}
      start={start}
      startInstant={startInstant}
      pause={pause}
      resume={resume}
      reset={reset}
    />
  );

  if (isIdle) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="max-w-md w-full">{controlRail}</div>
        <div className="max-w-3xl w-full">{overviewCard}</div>
        <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Press Start to begin a day-by-day run, or Instant for quick cycle sweeps. The engine keeps running when you switch tabs.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
      <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-1">
        {controlRail}
      </div>

      <div className="space-y-6">
        <WeatherScene weather={currentWeather} growthProgress={dayProgress} />

        <MetricGrid items={metricItems} />

        <Card className={`${CARD_CLASS} overflow-hidden`}>
          <CardContent className="p-0 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div
              className="relative overflow-hidden border-b border-border/60 px-5 py-5"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 12% 18%, hsl(var(--primary) / 0.18), transparent 48%), radial-gradient(circle at 88% 12%, hsl(var(--chart-2) / 0.18), transparent 42%), linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--surface) / 0.96) 100%)',
              }}
            >
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Decision Support & Farmer Advisory
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    One panel for the recommendation, the reason behind it, and the next action to take.
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${decisionToneClass}`}>
                    {decisionSupport.tone === 'safe'
                      ? <ShieldCheck className="w-3 h-3" />
                      : decisionSupport.tone === 'caution'
                      ? <AlertTriangle className="w-3 h-3" />
                      : <Tornado className="w-3 h-3" />}
                    {decisionSupport.label}
                  </span>
                  {isFarmer && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${farmerToneClass}`}>
                      {farmerAdvisory.riskLevel === 'low'
                        ? <ShieldCheck className="w-3 h-3" />
                        : farmerAdvisory.riskLevel === 'moderate'
                        ? <AlertTriangle className="w-3 h-3" />
                        : <Tornado className="w-3 h-3" />}
                      Farmer view
                    </span>
                  )}
                </div>
              </div>

              <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl bg-background/80 backdrop-blur ring-1 ring-border/50 p-4 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Decision Snapshot
                  </div>
                  <div className="text-sm font-semibold text-foreground leading-relaxed">
                    {comparisonSummary ?? 'Ranking scenarios to compare your current setup with the best option.'}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {scenarioStatus === 'done'
                      ? `Scenario ranking uses ${SCENARIO_SAMPLE_SIZE} simulated cycles per option with the current typhoon setting.`
                      : 'Ranking planting month, irrigation, and ENSO combinations...'}
                  </div>
                </div>

                {isFarmer && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-background/80 backdrop-blur ring-1 ring-border/50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current Situation</div>
                      <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{farmerAdvisory.situation}</div>
                    </div>
                    <div className="rounded-2xl bg-background/80 backdrop-blur ring-1 ring-border/50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">What It Means</div>
                      <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{farmerAdvisory.meaning}</div>
                    </div>
                    <div className="rounded-2xl bg-background/80 backdrop-blur ring-1 ring-border/50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best Next Step</div>
                      <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{farmerAdvisory.action}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4 space-y-3">
                <div className="font-semibold text-foreground">Current vs Recommended</div>
                {scenarioStatus !== 'done' && (
                  <div className="text-muted-foreground">Ranking planting month, irrigation, and ENSO combinations...</div>
                )}
                {scenarioStatus === 'done' && currentScenario && recommendedScenario && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-background/70 ring-1 ring-border/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Current setup</div>
                      <div className="font-semibold text-foreground mt-1">
                        {MONTH_NAMES[currentScenario.plantingMonth - 1]} • {currentScenario.irrigationType} • {currentScenario.ensoState}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Average: {formatScenarioYield(currentScenario.meanYield)}</div>
                        <div>Low-yield risk: {(currentScenario.lowYieldProb * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-primary/[0.06] ring-1 ring-primary/20 p-4 shadow-[0_12px_30px_-24px_hsl(var(--primary)/0.7)]">
                      <div className="text-xs uppercase tracking-wide text-primary/70">Recommended setup</div>
                      <div className="font-semibold text-foreground mt-1">
                        {MONTH_NAMES[recommendedScenario.plantingMonth - 1]} • {recommendedScenario.irrigationType} • {recommendedScenario.ensoState}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Average: {formatScenarioYield(recommendedScenario.meanYield)}</div>
                        <div>Low-yield risk: {(recommendedScenario.lowYieldProb * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4 space-y-3">
                <div className="font-semibold text-foreground">Why this recommendation</div>
                <div className="grid md:grid-cols-2 gap-3">
                  {decisionBreakdown.map((reason) => (
                    <div key={reason.title} className="rounded-xl bg-background/70 ring-1 ring-border/50 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">{reason.title}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${reason.toneClass}`}>
                          {reason.value}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{reason.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-3">
                <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4 space-y-3">
                  <div className="font-semibold text-foreground">Suggested actions</div>
                  <div className="space-y-2">
                    {decisionSupport.actions.map((action) => (
                      <div key={action} className="rounded-lg bg-background/70 ring-1 ring-border/50 px-3 py-2 text-sm text-muted-foreground leading-relaxed">
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-surface/80 ring-1 ring-border/60 p-4 space-y-3">
                  <div className="font-semibold text-foreground">Alerts</div>
                  {decisionSupport.alerts.length === 0 && (
                    <div className="rounded-lg bg-background/70 ring-1 ring-border/50 px-3 py-2 text-sm text-muted-foreground">
                      No active alerts for the current run.
                    </div>
                  )}
                  {decisionSupport.alerts.map((alert) => (
                    <div
                      key={alert.text}
                      className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        alert.level === 'high'
                          ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                          : alert.level === 'warning'
                          ? 'bg-warning/10 text-warning ring-1 ring-warning/20'
                          : 'bg-muted text-muted-foreground ring-1 ring-border/60'
                      }`}
                    >
                      {alert.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <WeatherCalendar
          timeline={calendarWeatherTimeline}
          typhoonSeverityTimeline={calendarTyphoonSeverityTimeline}
          daysPerCycle={params.daysPerCycle}
          cycleStartDate={cycleStartDate}
          firstCycleStartDate={firstCycleStartDate}
          lastCompletedCycleStartDate={lastCompletedCycleStartDate}
          isFinished={isFinished}
          currentCycleLabel={cyclePhase}
          typhoonProbability={params.typhoonProbability}
        />
        <ReportActions isFinished={isFinished} onPrint={handlePrint} onExport={handleExport} />

        <div className="print-only">
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Philippine Rice Yield Weather Simulator</h1>
          <p style={{ fontFamily: "'Poppins', sans-serif" }}>
            Report generated on {new Date().toLocaleString()}
          </p>

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Parameters</h2>
          <table>
            <tbody>
              <tr><td>Cycle Start Month</td><td>{cycleStartMonth}</td></tr>
              <tr><td>Irrigation</td><td>{params.irrigationType}</td></tr>
              <tr><td>ENSO</td><td>{params.ensoState}</td></tr>
              <tr><td>Typhoon Probability</td><td>{params.typhoonProbability}%</td></tr>
              <tr><td>Cycles Target</td><td>{params.cyclesTarget}</td></tr>
              <tr><td>Completed Cycles</td><td>{cycleRecords.length}</td></tr>
              <tr><td>Confidence</td><td>{confidence.label}</td></tr>
            </tbody>
          </table>

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Results</h2>
          <table>
            <tbody>
              <tr><td>Latest Yield</td><td>{latestYield != null ? formatYieldValue(latestYield) : '---'}</td></tr>
              <tr><td>Running Mean</td><td>{runningMean > 0 ? formatYieldValue(runningMean) : '---'}</td></tr>
              <tr><td>Low Yield Risk</td><td>{(lowYieldProb * 100).toFixed(1)}%</td></tr>
              <tr><td>Expected Range (P5-P95)</td><td>{summaryNumbers ? formatYieldRange(summaryNumbers.percentile5, summaryNumbers.percentile95) : '---'}</td></tr>
              <tr><td>Weather Variability SD</td><td>{summaryNumbers ? formatYieldValue(summaryNumbers.deterministicSd) : '---'}</td></tr>
              <tr><td>Random Noise SD</td><td>{summaryNumbers ? formatYieldValue(summaryNumbers.noiseSd) : '---'}</td></tr>
            </tbody>
          </table>

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Weather Mix (Daily)</h2>
          <table>
            <tbody>
              {(Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => (
                <tr key={`print-${key}`}>
                  <td>{key}</td>
                  <td>{dailyWeatherCounts[key]} days{weatherPercents ? ` (${weatherPercents[key].toFixed(1)}%)` : ''}</td>
                </tr>
              ))}
              <tr>
                <td>Severe Typhoon Days</td>
                <td>{dailyTyphoonSeverityCounts.Severe} days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Yield Over Cycles"
            caption={`Cycles: ${cycleRecords.length}`}
            insight={(
              <InsightLine tone={yieldTrendInsight.tone}>
                {yieldTrendInsight.icon}
                <span>{yieldTrendInsight.text}</span>
              </InsightLine>
            )}
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={yieldChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ring-soft))" />
                <XAxis dataKey="cycle" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => yieldTooltipFormatter(value)} />
                <Area dataKey="p5" stackId="range" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area dataKey="band" stackId="range" stroke="none" fill={BAND_FILL} isAnimationActive={false} />
                <Line type="monotone" dataKey="yield" stroke={YIELD_COLOR} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                { label: 'Actual Yield', color: YIELD_COLOR, variant: 'line' },
                { label: 'Expected Range (P5-P95)', color: BAND_LEGEND, variant: 'fill' },
              ]}
            />
            {isFarmer && (
              <div className="text-xs text-muted-foreground">
                Farmer note: This line shows the harvest per cycle. The shaded band is the most likely range based on completed cycles.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Latest yield: {latestYield != null ? formatYieldValue(latestYield) : '---'}</div>
              <div>Average so far: {runningMean > 0 ? formatYieldValue(runningMean) : '---'}</div>
              <div>Expected range: {summaryNumbers ? formatYieldRange(summaryNumbers.percentile5, summaryNumbers.percentile95) : '---'}</div>
              <div>Completed cycles: {cycleRecords.length}</div>
            </div>
          </ChartCard>

          <ChartCard
            title="Daily Weather Frequency"
            caption="Across all simulated days"
            insight={(
              <InsightLine tone={weatherInsight.tone}>
                {weatherInsight.icon}
                <span>{weatherInsight.text}</span>
              </InsightLine>
            )}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weatherData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ring-soft))" />
                <XAxis dataKey="weather" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {weatherData.map((entry) => (
                    <Cell key={entry.weather} fill={WEATHER_COLORS[entry.weather as WeatherType]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend
              items={(Object.keys(WEATHER_COLORS) as WeatherType[]).map((key) => ({
                label: key,
                color: WEATHER_COLORS[key],
                variant: 'fill',
              }))}
            />
            {isFarmer && (
              <div className="text-xs text-muted-foreground">
                Farmer note: Bigger bars mean more days with that weather across all cycles.
              </div>
            )}
            {isFarmer && (
              <div className="text-xs text-muted-foreground">
                Weather storyline: {weatherStory}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {(Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => (
                <div key={key}>
                  {key}: {dailyWeatherCounts[key]} days{weatherPercents ? ` (${weatherPercents[key].toFixed(1)}%)` : ''}
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Yield Distribution"
            caption="Histogram of cycle yields"
            insight={(
              <InsightLine tone={distributionInsight.tone}>
                {distributionInsight.icon}
                <span>{distributionInsight.text}</span>
              </InsightLine>
            )}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={histogramBins}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ring-soft))" />
                <XAxis dataKey="label" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={YIELD_COLOR} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend items={[{ label: 'Yield Count', color: YIELD_COLOR, variant: 'fill' }]} />
            {isFarmer && (
              <div className="text-xs text-muted-foreground">
                Farmer note: Taller bars mean that yield happens more often.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Min: {summaryNumbers ? formatYieldValue(summaryNumbers.min) : '---'}</div>
              <div>Max: {summaryNumbers ? formatYieldValue(summaryNumbers.max) : '---'}</div>
              <div>Mean: {summaryNumbers ? formatYieldValue(summaryNumbers.mean) : '---'}</div>
              <div>Std dev: {summaryNumbers ? formatYieldValue(summaryNumbers.std) : '---'}</div>
              <div>P5: {summaryNumbers ? formatYieldValue(summaryNumbers.percentile5) : '---'}</div>
              <div>P95: {summaryNumbers ? formatYieldValue(summaryNumbers.percentile95) : '---'}</div>
            </div>
          </ChartCard>

          {downsampledMean.length > 1 && (
            <ChartCard
              title="Running Mean"
              caption={`${yieldHistoryOverTime.length} cycles`}
              insight={(
                <InsightLine tone={meanInsight.tone}>
                  {meanInsight.icon}
                  <span>{meanInsight.text}</span>
                </InsightLine>
              )}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={downsampledMean}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ring-soft))" />
                  <XAxis dataKey="cycle" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => yieldTooltipFormatter(value)} />
                  <Line type="monotone" dataKey="mean" stroke={MEAN_COLOR} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <ChartLegend items={[{ label: 'Running Mean', color: MEAN_COLOR, variant: 'line' }]} />
              {isFarmer && (
                <div className="text-xs text-muted-foreground">
                  Farmer note: The line smooths the averages as more cycles complete, showing your long-term trend.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Latest mean: {latestMean != null ? formatYieldValue(latestMean) : '---'}</div>
                <div>Cycles averaged: {yieldHistoryOverTime.length}</div>
              </div>
            </ChartCard>
          )}
        </div>

      </div>
    </div>
  );
}
