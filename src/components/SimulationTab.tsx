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
import { IrrigationType, ENSOState, WeatherType, TyphoonSeverity, getSeason, getWeatherWeights } from '@/lib/simulation';
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
          <Button onClick={onPrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </Button>
          <Button onClick={onExport} variant="outline" className="gap-2" disabled={!isFinished}>
            <Download className="w-4 h-4" /> Export CSV
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

function FarmerInterpretation({
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
}) {
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
  const lowYieldThreshold = useSacks ? '40 sacks' : '2.0 t/ha';

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

  const borderColor =
    riskLevel === 'low' ? 'hsl(var(--primary))' :
    riskLevel === 'moderate' ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))';

  return (
    <Card className={CARD_CLASS} style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Farmer Advisory
          </CardTitle>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              riskLevel === 'low'
                ? 'bg-primary/10 text-primary'
                : riskLevel === 'moderate'
                ? 'bg-warning/15 text-warning'
                : 'bg-destructive/15 text-destructive'
            }`}
          >
            {riskLevel === 'low'
              ? <ShieldCheck className="w-3 h-3" />
              : riskLevel === 'moderate'
              ? <AlertTriangle className="w-3 h-3" />
              : <Tornado className="w-3 h-3" />}
            {riskLevel} risk
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="rounded-xl bg-surface/80 ring-1 ring-border/60 p-3">
          <div className="font-semibold text-foreground mb-1">Current Situation</div>
          <p className="text-muted-foreground leading-relaxed">{situation}</p>
        </div>
        <div className="rounded-xl bg-surface/80 ring-1 ring-border/60 p-3">
          <div className="font-semibold text-foreground mb-1">What This Means</div>
          <p className="text-muted-foreground leading-relaxed">{meaning}</p>
        </div>
        <div className="rounded-xl bg-surface/80 ring-1 ring-border/60 p-3">
          <div className="font-semibold text-foreground mb-1">Suggested Action</div>
          <p className="text-muted-foreground leading-relaxed">{action}</p>
        </div>
      </CardContent>
    </Card>
  );
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
      lastSeverityRef.current = currentCycleTyphoonSeverityTimeline ?? [];
    }
  }, [currentCycleWeatherTimeline, currentCycleTyphoonSeverityTimeline]);

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

  const formatYieldValue = (value: number) =>
    isFarmer ? `${formatSacks(value)} sacks` : `${value.toFixed(2)} t/ha`;
  const formatYieldRange = (low: number, high: number) =>
    isFarmer
      ? `${formatSacks(low)} to ${formatSacks(high)} sacks`
      : `${low.toFixed(2)} to ${high.toFixed(2)} t/ha`;
  const yieldTooltipFormatter = (value: number) =>
    isFarmer ? `${formatSacks(Number(value))} sacks` : `${Number(value).toFixed(2)} t/ha`;

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

    const buildTable = (title: string, headers: string[], dataRows: (string | number)[][]) => {
      const width = Math.max(1, headers.length, ...dataRows.map((row) => row.length));
      const empty = (count: number) => Array.from({ length: count }, () => '');
      const block: string[][] = [];
      block.push([title, ...empty(width - 1)]);
      if (headers.length > 0) {
        block.push([...headers, ...empty(width - headers.length)]);
      }
      dataRows.forEach((row) => {
        const normalized = row.map((cell) => (cell == null ? '' : String(cell)));
        block.push([...normalized, ...empty(width - normalized.length)]);
      });
      return block;
    };

    const mergeTables = (tables: string[][][], gap = 1) => {
      const widths = tables.map((table) => table[0]?.length ?? 0);
      const maxRows = Math.max(...tables.map((table) => table.length));
      const gapCells = Array.from({ length: gap }, () => '');
      const merged: string[][] = [];
      for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
        const row: string[] = [];
        tables.forEach((table, tableIndex) => {
          const width = widths[tableIndex];
          const tableRow = table[rowIndex] ?? Array.from({ length: width }, () => '');
          row.push(...tableRow);
          if (tableIndex < tables.length - 1) {
            row.push(...gapCells);
          }
        });
        merged.push(row);
      }
      return merged;
    };

    const s = summary;
    const n = cycleRecords.length;
    const ciLow = s?.ciLow ?? (runningMean - 1.96 * runningSd / Math.sqrt(Math.max(1, n)));
    const ciHigh = s?.ciHigh ?? (runningMean + 1.96 * runningSd / Math.sqrt(Math.max(1, n)));

    const totalDays = Object.values(dailyWeatherCounts).reduce((a, b) => a + b, 0) || 1;
    const cycleTable = buildTable(
      'Cycle Records',
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
      ['Completed Cycles', n],
      ['Mean Yield (t/ha)', (s?.mean ?? runningMean).toFixed(4)],
      ['Std Deviation (t/ha)', (s?.std ?? runningSd).toFixed(4)],
      ['Min Yield (t/ha)', (s?.min ?? 0).toFixed(4)],
      ['Max Yield (t/ha)', (s?.max ?? 0).toFixed(4)],
      ['5th Percentile (t/ha)', (s?.percentile5 ?? 0).toFixed(4)],
      ['95th Percentile (t/ha)', (s?.percentile95 ?? 0).toFixed(4)],
      ['95% CI Lower (t/ha)', ciLow.toFixed(4)],
      ['95% CI Upper (t/ha)', ciHigh.toFixed(4)],
    ];
    if (s) {
      summaryRows.push(['CI Width (t/ha)', s.ciWidth.toFixed(4)]);
      summaryRows.push(['Weather Variability SD (t/ha)', s.deterministicSd.toFixed(4)]);
      summaryRows.push(['Random Noise SD (t/ha)', s.noiseSd.toFixed(4)]);
    }
    summaryRows.push(['Low Yield Probability (%)', (lowYieldProb * 100).toFixed(2)]);

    const summaryTable = buildTable('Summary', ['Metric', 'Value'], summaryRows);

    const weatherTable = buildTable(
      'Daily Weather Counts',
      ['Weather', 'Days', 'Percent'],
      (Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => {
        const count = dailyWeatherCounts[key];
        const pct = (count / totalDays) * 100;
        return [key, count, pct.toFixed(2)];
      })
    );

    const typhoonTable = buildTable(
      'Typhoon Severity Counts',
      ['Severity', 'Days'],
      [
        ['Moderate', dailyTyphoonSeverityCounts.Moderate],
        ['Severe', dailyTyphoonSeverityCounts.Severe],
      ]
    );

    const yieldSeriesTable = buildTable(
      'Yield Over Cycles',
      ['Cycle', 'Yield (t/ha)'],
      yieldSeries.map((p) => ([p.cycle, p.yield.toFixed(4)]))
    );

    const expectedRangeTable = buildTable(
      'Expected Range (P5-P95)',
      ['Cycle', 'Mean', 'P5', 'P95'],
      yieldBandSeries.map((p) => ([p.cycle, p.mean.toFixed(4), p.p5.toFixed(4), p.p95.toFixed(4)]))
    );

    const runningMeanTable = buildTable(
      'Running Mean',
      ['Cycle', 'Mean (t/ha)'],
      yieldHistoryOverTime.map((value, index) => ([index + 1, value.toFixed(4)]))
    );

    const histogramTable = buildTable(
      'Yield Distribution',
      ['Bin Start (t/ha)', 'Count'],
      histogramBins.map((bin) => ([bin.label, bin.count]))
    );

    const mergedRows = mergeTables(
      [
        cycleTable,
        summaryTable,
        weatherTable,
        typhoonTable,
        yieldSeriesTable,
        expectedRangeTable,
        runningMeanTable,
        histogramTable,
      ],
      1
    );

    const csvContent = mergedRows
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

        {isFarmer && (
          <FarmerInterpretation
            meanYield={runningMean}
            lowYieldProb={lowYieldProb}
            currentYield={currentYield}
            irrigationType={params.irrigationType}
            typhoonFrequency={typhoonFrequency}
            useSacks
          />
        )}
      </div>
    </div>
  );
}


