import { useCallback, useMemo, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, Zap, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sun, Cloud, CloudRain, Tornado, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import WeatherScene from './WeatherScene';
import ChartLegend from './ChartLegend';
import { useSimulationStore } from '@/store/simulationStore';
import { IrrigationType, ENSOState, WeatherType, getWeatherWeights, Region } from '@/lib/simulation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Area, ComposedChart,
} from 'recharts';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const WEATHER_COLORS: Record<WeatherType, string> = {
  Dry: 'hsl(45, 95%, 55%)',
  Normal: 'hsl(200, 60%, 55%)',
  Wet: 'hsl(210, 60%, 50%)',
  Typhoon: 'hsl(0, 72%, 50%)',
};

const WEATHER_BG: Record<WeatherType, string> = {
  Dry: 'hsla(45, 95%, 55%, 0.2)',
  Normal: 'hsla(200, 60%, 55%, 0.2)',
  Wet: 'hsla(210, 60%, 50%, 0.2)',
  Typhoon: 'hsla(0, 72%, 50%, 0.2)',
};

const YIELD_COLOR = 'hsl(var(--primary))';
const BAND_FILL = 'hsl(var(--primary) / 0.2)';
const BAND_LEGEND = 'hsl(var(--primary) / 0.45)';
const MEAN_COLOR = 'hsl(var(--accent))';

const SPEED_LABELS: Record<number, string> = {
  0.5: '0.5x', 1: '1x', 2: '2x', 5: '5x', 10: '10x', 20: '20x',
};

const TONS_TO_SACKS = 20;

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

function seededWeather(day: number, month: number, year: number, region: Region, typhoonProb: number) {
  const seed = Math.abs(Math.sin(day * 13 + month * 17 + year * 19) * 10000);
  const r = seed - Math.floor(seed);
  const weights = getWeatherWeights(month, typhoonProb, region);
  let acc = weights.Dry;
  if (r < acc) return 'Dry' as WeatherType;
  acc += weights.Normal;
  if (r < acc) return 'Normal' as WeatherType;
  acc += weights.Wet;
  if (r < acc) return 'Wet' as WeatherType;
  return 'Typhoon' as WeatherType;
}

function WeatherTimeline({
  timeline,
  daysPerCycle,
  plantingMonth,
  region,
  typhoonProbability,
}: {
  timeline: WeatherType[];
  daysPerCycle: number;
  plantingMonth: number;
  region: Region;
  typhoonProbability: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    setCalendarMonth(Math.max(0, Math.min(11, plantingMonth - 1)));
  }, [plantingMonth]);

  const minYear = new Date().getFullYear();
  const minMonth = Math.max(0, Math.min(11, plantingMonth - 1));

  const monthName = MONTH_NAMES[calendarMonth];
  const daysInSelectedMonth = daysInMonth(calendarYear, calendarMonth);
  const useActual = calendarMonth === plantingMonth - 1;

  const gapDays = 30;
  const plantingStart = new Date(calendarYear, plantingMonth - 1, 1);
  const plantingEnd = new Date(plantingStart);
  plantingEnd.setDate(plantingStart.getDate() + daysPerCycle - 1);
  const plantingSecond = new Date(plantingStart);
  plantingSecond.setDate(plantingStart.getDate() + daysPerCycle + gapDays);
  const plantingSecondEnd = new Date(plantingSecond);
  plantingSecondEnd.setDate(plantingSecond.getDate() + daysPerCycle - 1);

  const plantingMarkers: Record<number, string> = {};
  if (plantingStart.getFullYear() === calendarYear && plantingStart.getMonth() === calendarMonth) {
    plantingMarkers[plantingStart.getDate()] = 'P1';
  }
  if (plantingSecond.getFullYear() === calendarYear && plantingSecond.getMonth() === calendarMonth) {
    plantingMarkers[plantingSecond.getDate()] = 'P2';
  }

  const cells = Array.from({ length: daysInSelectedMonth }, (_, i) => {
    const day = i + 1;
    const currentDate = new Date(calendarYear, calendarMonth, day);
    const inCycle1 = currentDate >= plantingStart && currentDate <= plantingEnd;
    const inCycle2 = currentDate >= plantingSecond && currentDate <= plantingSecondEnd;
    const inCycle = inCycle1 || inCycle2;

    if (!inCycle) {
      return { day, weather: null as WeatherType | null };
    }

    if (useActual && inCycle1) {
      const dayIndex = day - 1;
      const actual = timeline[dayIndex];
      if (actual) {
        return { day, weather: actual };
      }
    }

    const weather = seededWeather(day, calendarMonth + 1, calendarYear, region, typhoonProbability / 100);
    return { day, weather };
  });

  const canGoPrev = (() => {
    const targetMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const targetYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    return targetYear > minYear || (targetYear === minYear && targetMonth >= minMonth);
  })();

  const handlePrev = () => {
    if (!canGoPrev) return;
    const targetMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const targetYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    setCalendarYear(targetYear);
    setCalendarMonth(targetMonth);
  };

  const handleNext = () => {
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
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Daily Weather Calendar Row
          </CardTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse calendar' : 'Expand calendar'}
            aria-label={expanded ? 'Collapse calendar' : 'Expand calendar'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {monthName} {calendarYear} aligns to the selected planting month. Planting uses two crop cycles with a 30-day rest and land prep gap.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {cells.map((cell) => (
            <div
              key={cell.day}
              className="w-8 h-8 rounded-md border border-border flex items-center justify-center relative shrink-0"
              style={{ backgroundColor: cell.weather ? `${WEATHER_BG[cell.weather]}` : 'transparent' }}
              title={cell.weather ? `Day ${cell.day}: ${cell.weather}` : `Day ${cell.day}: Rest / land prep`}
            >
              <span className="absolute top-0.5 left-0.5 text-[8px] text-muted-foreground">{cell.day}</span>
              {cell.weather ? <WeatherIcon weather={cell.weather} className="w-3.5 h-3.5" /> : null}
              {plantingMarkers[cell.day] && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] font-semibold text-primary">
                  {plantingMarkers[cell.day]}
                </span>
              )}
            </div>
          ))}
        </div>

        {expanded && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-[32px_minmax(14ch,1fr)_32px] items-center gap-2">
                <Button size="icon" variant="outline" onClick={handlePrev} disabled={!canGoPrev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div
                  className="text-sm font-semibold text-center"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {monthName} {calendarYear}
                </div>
                <Button size="icon" variant="outline" onClick={handleNext}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <span className="text-muted-foreground">Year</span>
                <Input
                  type="number"
                  min={minYear}
                  value={calendarYear}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isNaN(val)) return;
                    const nextYear = Math.max(minYear, val);
                    setCalendarYear(nextYear);
                    if (nextYear === minYear) {
                      setCalendarMonth((prev) => (prev < minMonth ? minMonth : prev));
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
                  className="rounded-md border border-border p-1 h-12 flex flex-col justify-between"
                  style={{ backgroundColor: cell && cell.weather ? `${WEATHER_BG[cell.weather]}` : 'transparent' }}
                >
                  {cell ? (
                    <>
                      <div className="text-[9px] text-muted-foreground">{cell.day}</div>
                      <div className="flex items-center justify-between">
                        {cell.weather ? <WeatherIcon weather={cell.weather} className="w-4 h-4" /> : null}
                        {plantingMarkers[cell.day] && (
                          <span className="text-[9px] font-semibold text-primary">{plantingMarkers[cell.day]}</span>
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

        <ChartLegend
          items={[
            ...(Object.keys(WEATHER_COLORS) as WeatherType[]).map((k) => ({
              label: k,
              color: WEATHER_COLORS[k],
              variant: 'fill',
            })),
            { label: 'P1 Primary planting', color: 'hsl(var(--primary))', variant: 'fill' },
            { label: 'P2 Second planting', color: 'hsl(var(--primary))', variant: 'fill' },
          ]}
        />
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
    <Card className="border-border" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Farmer Interpretation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div>
          <div className="font-semibold text-foreground mb-1">Current Situation</div>
          <p className="text-muted-foreground leading-relaxed">{situation}</p>
        </div>
        <div>
          <div className="font-semibold text-foreground mb-1">What This Means</div>
          <p className="text-muted-foreground leading-relaxed">{meaning}</p>
        </div>
        <div>
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
    currentCycleWeatherTimeline, cycleRecords, summary,
  } = snap;

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused || status === 'finished';
  const isIdle = status === 'idle';
  const isFinished = status === 'finished';
  const isFarmer = viewMode === 'farmer';

  const displayParams = { ...params, ...pendingParams };
  const displayCycle = Math.min(currentCycleIndex + (isRunning || isPaused ? 1 : 0), params.cyclesTarget);
  const displayDay = isFinished ? params.daysPerCycle : currentDay;

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
    if (n >= 50) return { label: 'High confidence', tone: 'text-primary' };
    if (n >= 20) return { label: 'Medium confidence', tone: 'text-warning' };
    return { label: 'Low confidence', tone: 'text-muted-foreground' };
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

  const presets = [
    { label: 'Dry Season Rainfed', params: { plantingMonth: 2, irrigationType: 'Rainfed' as IrrigationType, ensoState: 'Neutral' as ENSOState, typhoonProbability: 5 } },
    { label: 'Wet Season Irrigated', params: { plantingMonth: 7, irrigationType: 'Irrigated' as IrrigationType, ensoState: 'Neutral' as ENSOState, typhoonProbability: 15 } },
    { label: 'High Typhoon', params: { typhoonProbability: 35 } },
    { label: 'La Niña Boost', params: { ensoState: 'La Niña' as ENSOState, irrigationType: 'Irrigated' as IrrigationType } },
    { label: 'El Niño Stress', params: { ensoState: 'El Niño' as ENSOState, irrigationType: 'Rainfed' as IrrigationType } },
  ];

  const handleExport = useCallback(() => {
    if (cycleRecords.length === 0) return;

    const rows: string[] = [];
    rows.push('Cycle,Final Yield (t/ha),Final Yield (sacks),Season,Weather,Dominant Typhoon Severity,Typhoon Days,Severe Typhoon Days,ENSO State,Irrigation Type,Region,Planting Month,Typhoon Probability (%)');
    cycleRecords.forEach((r) => {
      rows.push([
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
        r.region,
        r.plantingMonth,
        r.typhoonProbability.toFixed(1),
      ].join(','));
    });

    const s = summary;
    const n = cycleRecords.length;
    const ciLow = s?.ciLow ?? (runningMean - 1.96 * runningSd / Math.sqrt(Math.max(1, n)));
    const ciHigh = s?.ciHigh ?? (runningMean + 1.96 * runningSd / Math.sqrt(Math.max(1, n)));

    rows.push('');
    rows.push('SUMMARY');
    rows.push('Metric,Value');
    rows.push(`Completed Cycles,${n}`);
    rows.push(`Mean Yield (t/ha),${(s?.mean ?? runningMean).toFixed(4)}`);
    rows.push(`Std Deviation (t/ha),${(s?.std ?? runningSd).toFixed(4)}`);
    rows.push(`Min Yield (t/ha),${(s?.min ?? 0).toFixed(4)}`);
    rows.push(`Max Yield (t/ha),${(s?.max ?? 0).toFixed(4)}`);
    rows.push(`5th Percentile (t/ha),${(s?.percentile5 ?? 0).toFixed(4)}`);
    rows.push(`95th Percentile (t/ha),${(s?.percentile95 ?? 0).toFixed(4)}`);
    rows.push(`95% CI Lower (t/ha),${ciLow.toFixed(4)}`);
    rows.push(`95% CI Upper (t/ha),${ciHigh.toFixed(4)}`);
    if (s) {
      rows.push(`CI Width (t/ha),${s.ciWidth.toFixed(4)}`);
      rows.push(`Weather Variability SD (t/ha),${s.deterministicSd.toFixed(4)}`);
      rows.push(`Random Noise SD (t/ha),${s.noiseSd.toFixed(4)}`);
    }
    rows.push(`Low Yield Probability (%),${(lowYieldProb * 100).toFixed(2)}`);

    rows.push('');
    rows.push('CHART_DATA');

    rows.push('Daily Weather Counts');
    rows.push('Weather,Days,Percent');
    const totalDays = Object.values(dailyWeatherCounts).reduce((a, b) => a + b, 0) || 1;
    (Object.keys(dailyWeatherCounts) as WeatherType[]).forEach((key) => {
      const count = dailyWeatherCounts[key];
      const pct = (count / totalDays) * 100;
      rows.push(`${key},${count},${pct.toFixed(2)}`);
    });

    rows.push('');
    rows.push('Typhoon Severity Counts');
    rows.push('Severity,Days');
    rows.push(`Moderate,${dailyTyphoonSeverityCounts.Moderate}`);
    rows.push(`Severe,${dailyTyphoonSeverityCounts.Severe}`);

    rows.push('');
    rows.push('Yield Over Cycles');
    rows.push('Cycle,Yield (t/ha)');
    yieldSeries.forEach((p) => {
      rows.push(`${p.cycle},${p.yield.toFixed(4)}`);
    });

    if (yieldBandSeries.length > 0) {
      rows.push('');
      rows.push('Expected Range (P5-P95)');
      rows.push('Cycle,Mean,P5,P95');
      yieldBandSeries.forEach((p) => {
        rows.push(`${p.cycle},${p.mean.toFixed(4)},${p.p5.toFixed(4)},${p.p95.toFixed(4)}`);
      });
    }

    rows.push('');
    rows.push('Running Mean');
    rows.push('Cycle,Mean (t/ha)');
    yieldHistoryOverTime.forEach((v, i) => {
      rows.push(`${i + 1},${v.toFixed(4)}`);
    });

    rows.push('');
    rows.push('Yield Distribution');
    rows.push('Bin Start (t/ha),Count');
    histogramBins.forEach((b) => {
      rows.push(`${b.label},${b.count}`);
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

  const controlCard = (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Parameter Control</CardTitle>
        {isActive && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
            {isRunning ? `Running - ${mode === 'cycle' ? 'Instant sweep' : 'Day-by-day'}` : isPaused ? 'Paused' : 'Finished'}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            Planting Month
            {isActive && pendingParams.plantingMonth !== undefined && (
              <span className="ml-2 text-[10px] text-warning">(queued)</span>
            )}
          </Label>
          <Select value={String(displayParams.plantingMonth)} onValueChange={(v) => updateParams({ plantingMonth: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)} style={{ fontFamily: "'Poppins', sans-serif" }}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            Irrigation Type
            {isActive && pendingParams.irrigationType !== undefined && (
              <span className="ml-2 text-[10px] text-warning">(queued)</span>
            )}
          </Label>
          <Select value={displayParams.irrigationType} onValueChange={(v) => updateParams({ irrigationType: v as IrrigationType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Irrigated" style={{ fontFamily: "'Poppins', sans-serif" }}>Irrigated (+0.3 t/ha)</SelectItem>
              <SelectItem value="Rainfed" style={{ fontFamily: "'Poppins', sans-serif" }}>Rainfed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            ENSO State
            {isActive && pendingParams.ensoState !== undefined && (
              <span className="ml-2 text-[10px] text-warning">(queued)</span>
            )}
          </Label>
          <Select value={displayParams.ensoState} onValueChange={(v) => updateParams({ ensoState: v as ENSOState })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="El Niño" style={{ fontFamily: "'Poppins', sans-serif" }}>El Niño (-0.4 t/ha)</SelectItem>
              <SelectItem value="Neutral" style={{ fontFamily: "'Poppins', sans-serif" }}>Neutral</SelectItem>
              <SelectItem value="La Niña" style={{ fontFamily: "'Poppins', sans-serif" }}>La Niña (+0.3 t/ha)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            Typhoon Probability: {params.typhoonProbability}%
            <span className="ml-2 text-[10px] text-primary">(live)</span>
          </Label>
          <Slider value={[params.typhoonProbability]} onValueChange={([v]) => updateParams({ typhoonProbability: v })} min={0} max={40} step={1} />
        </div>

        <div className="space-y-2">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            Scenario Presets
            {isActive && (
              <span className="ml-2 text-[10px] text-warning">(queued)</span>
            )}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => updateParams(preset.params)}
                className="text-xs px-2 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Presets apply to the next cycle when a run is active.
          </div>
        </div>

        <div className="space-y-1.5">
          <Label style={{ fontFamily: "'Poppins', sans-serif" }}>
            Crop Cycles
            {isActive && pendingParams.cyclesTarget !== undefined && (
              <span className="ml-2 text-[10px] text-warning">(queued)</span>
            )}
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
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>1-500 cycles</span>
          </div>
          <Slider
            value={[displayParams.cyclesTarget]}
            onValueChange={([v]) => updateParams({ cyclesTarget: v })}
            min={1}
            max={500}
            step={1}
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ fontFamily: "'Poppins', sans-serif" }}>Speed</Label>
            <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{speedMultiplier}x</div>
          </div>
          <Slider value={[speedMultiplier]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={20} step={0.5} />
          <div className="grid grid-cols-3 gap-2">
            {[0.5, 1, 2, 5, 10, 20].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  speedMultiplier === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary'
                }`}
              >
                {SPEED_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1 flex-wrap">
          {isIdle || isFinished ? (
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
          <Button onClick={reset} variant="outline" className="gap-2" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isIdle) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="max-w-md w-full">{controlCard}</div>
        <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Press Start to begin a day-by-day run, or Instant for quick cycle sweeps. The engine keeps running when you switch tabs.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
      <div className="lg:sticky lg:top-24 h-fit">
        {controlCard}
      </div>

      <div className="space-y-6">
        <WeatherScene weather={currentWeather} growthProgress={dayProgress} />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(
            isFarmer
              ? [
                  { label: 'Cycle', value: `${displayCycle} / ${params.cyclesTarget}` },
                  { label: 'Day', value: `${displayDay} / ${params.daysPerCycle}` },
                  { label: 'Current Yield', value: currentYield != null ? formatYieldValue(currentYield) : '---' },
                  { label: 'Running Mean', value: runningMean > 0 ? formatYieldValue(runningMean) : '---' },
                  { label: 'Low Yield Risk', value: `${(lowYieldProb * 100).toFixed(1)}%` },
                ]
              : [
                  { label: 'Cycle', value: `${displayCycle} / ${params.cyclesTarget}` },
                  { label: 'Day', value: `${displayDay} / ${params.daysPerCycle}` },
                  { label: 'Current Yield', value: currentYield != null ? `${currentYield.toFixed(2)} t/ha` : '---' },
                  { label: 'Running Mean', value: runningMean > 0 ? `${runningMean.toFixed(2)} t/ha` : '---' },
                  { label: 'Running Mean Sacks', value: runningMean > 0 ? `${formatSacks(runningMean)} sacks` : '---' },
                ]
          ).concat([{ label: 'Confidence', value: confidence.label }]).map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>{stat.label}</div>
                <div
                  className={`text-lg font-bold ${stat.label === 'Confidence' ? confidence.tone : ''}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <WeatherTimeline
          timeline={currentCycleWeatherTimeline}
          daysPerCycle={params.daysPerCycle}
          plantingMonth={params.plantingMonth}
          region={params.region}
          typhoonProbability={params.typhoonProbability}
        />

        <div className="flex justify-end gap-2">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </Button>
          {isFinished && (
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          )}
        </div>

        <div className="print-only">
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Philippine Rice Yield Weather Simulator</h1>
          <p style={{ fontFamily: "'Poppins', sans-serif" }}>
            Report generated on {new Date().toLocaleString()}
          </p>

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Parameters</h2>
          <table>
            <tbody>
              <tr><td>Planting Month</td><td>{params.plantingMonth}</td></tr>
              <tr><td>Region</td><td>{params.region}</td></tr>
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
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Yield Over Cycles</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={yieldChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cycle" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'Poppins, sans-serif', fontSize: 12 }}
                    formatter={(value: number) => yieldTooltipFormatter(value)}
                  />
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
                <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Farmer note: This line shows the harvest per cycle. The shaded band is the most likely range based on all cycles completed so far.
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <div>Latest yield: {latestYield != null ? formatYieldValue(latestYield) : '---'}</div>
                <div>Average so far: {runningMean > 0 ? formatYieldValue(runningMean) : '---'}</div>
                <div>Expected range: {summaryNumbers ? formatYieldRange(summaryNumbers.percentile5, summaryNumbers.percentile95) : '---'}</div>
                <div>Completed cycles: {cycleRecords.length}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Daily Weather Frequency</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weatherData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="weather" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
                <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Farmer note: This counts every simulated day across all cycles. Bigger bars mean more days with that weather.
                </div>
              )}
              {isFarmer && (
                <div className="mt-2 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Weather storyline: {weatherStory}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {(Object.keys(dailyWeatherCounts) as WeatherType[]).map((key) => (
                  <div key={key}>
                    {key}: {dailyWeatherCounts[key]} days{weatherPercents ? ` (${weatherPercents[key].toFixed(1)}%)` : ''}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Yield Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={histogramBins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'Poppins, sans-serif', fontSize: 12 }} />
                  <Bar dataKey="count" fill={YIELD_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ChartLegend items={[{ label: 'Yield Count', color: YIELD_COLOR, variant: 'fill' }]} />
              {isFarmer && (
                <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Farmer note: This shows how often each yield range appears. Taller bars mean that yield happens more often.
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <div>Min: {summaryNumbers ? formatYieldValue(summaryNumbers.min) : '---'}</div>
                <div>Max: {summaryNumbers ? formatYieldValue(summaryNumbers.max) : '---'}</div>
                <div>Mean: {summaryNumbers ? formatYieldValue(summaryNumbers.mean) : '---'}</div>
                <div>Std dev: {summaryNumbers ? formatYieldValue(summaryNumbers.std) : '---'}</div>
                <div>P5: {summaryNumbers ? formatYieldValue(summaryNumbers.percentile5) : '---'}</div>
                <div>P95: {summaryNumbers ? formatYieldValue(summaryNumbers.percentile95) : '---'}</div>
              </div>
            </CardContent>
          </Card>

          {downsampledMean.length > 1 && (
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Running Mean</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={downsampledMean}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="cycle" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'Poppins, sans-serif', fontSize: 12 }}
                      formatter={(value: number) => yieldTooltipFormatter(value)}
                    />
                    <Line type="monotone" dataKey="mean" stroke={MEAN_COLOR} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <ChartLegend items={[{ label: 'Running Mean', color: MEAN_COLOR, variant: 'line' }]} />
                {isFarmer && (
                  <div className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Farmer note: The line smooths the averages as more cycles complete, showing your long-term trend.
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  <div>Latest mean: {latestMean != null ? formatYieldValue(latestMean) : '---'}</div>
                  <div>Cycles averaged: {yieldHistoryOverTime.length}</div>
                </div>
              </CardContent>
            </Card>
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
