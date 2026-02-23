import math
import threading
import time
from typing import Dict, List, Optional

from .simulation import (
    WeatherType,
    TyphoonSeverity,
    IrrigationType,
    ENSOState,
    Season,
    Region,
    get_season,
    get_weather,
    get_typhoon_severity,
    compute_yield,
)


class SimulationEngine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)

        # live state
        self.status = "idle"
        self.mode = "day"
        self.speed_multiplier = 1.0

        self.params = {
            "plantingMonth": 6,
            "region": "Luzon",
            "irrigationType": "Irrigated",
            "ensoState": "Neutral",
            "typhoonProbability": 15,
            "cyclesTarget": 100,
            "daysPerCycle": 120,
        }
        self.pending_params: Dict = {}

        # runtime
        self.currentCycleIndex = 0
        self.currentDay = 0
        self.currentWeather: Optional[WeatherType] = None
        self.currentYield: Optional[float] = None
        self.currentCycleWeatherTimeline: List[WeatherType] = []
        self.cycleWeatherSequence: List[WeatherType] = []

        # welford
        self.welfordCount = 0
        self.welfordMean = 0.0
        self.welfordM2 = 0.0
        self.deterministicMean = 0.0
        self.deterministicM2 = 0.0
        self.noiseMean = 0.0
        self.noiseM2 = 0.0
        self.lowYieldCount = 0
        self.minYield = float("inf")
        self.maxYield = float("-inf")

        # history
        self.yieldHistoryOverTime: List[float] = []
        self.recentYields: List[float] = []
        self.allYields: List[float] = []
        self.yieldSeries: List[Dict] = []
        self.yieldBandSeries: List[Dict] = []
        self.cycleRecords: List[Dict] = []

        # weather counts
        self.weatherCounts: Dict[WeatherType, int] = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.dailyWeatherCounts: Dict[WeatherType, int] = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.dailyTyphoonSeverityCounts: Dict[TyphoonSeverity, int] = {"Moderate": 0, "Severe": 0}

        # histogram
        self.histogramBins = self._init_bins()

        # summary
        self.summaryCache = None

        # per-cycle
        self.cycleWeatherAccum: Dict[WeatherType, int] = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.cycleTyphoonSeverityCounts: Dict[TyphoonSeverity, int] = {"Moderate": 0, "Severe": 0}

        # timing
        self._accumulated_s = 0.0
        self._cycle_elapsed_s = 0.0

        self._thread.start()

    # ----------------------------

    def get_snapshot(self):
        with self._lock:
            return self._snapshot()

    def start(self):
        with self._lock:
            self.mode = "day"
            self._reset_internals()
            self.status = "running"

    def start_instant(self):
        with self._lock:
            self.mode = "cycle"
            self._reset_internals()
            self.status = "running"
            self._prepare_cycle()

    def pause(self):
        with self._lock:
            if self.status == "running":
                self.status = "paused"

    def resume(self):
        with self._lock:
            if self.status == "paused":
                self.status = "running"

    def reset(self):
        with self._lock:
            self.status = "idle"
            self._reset_internals()

    def set_speed(self, multiplier: float):
        with self._lock:
            self.speed_multiplier = max(0.5, float(multiplier))

    def update_params(self, partial: Dict):
        with self._lock:
            typhoon_prob = partial.pop("typhoonProbability", None)
            if typhoon_prob is not None:
                self.params["typhoonProbability"] = typhoon_prob

            is_active = self.status in ("running", "paused")
            if not is_active:
                self.params.update(partial)
                self.pending_params = {}
            elif partial:
                self.pending_params.update(partial)

    # ----------------------------

    def _reset_internals(self):
        self.currentCycleIndex = 0
        self.currentDay = 0
        self.currentWeather = None
        self.currentYield = None
        self.currentCycleWeatherTimeline = []
        self.cycleWeatherSequence = []

        self.welfordCount = 0
        self.welfordMean = 0.0
        self.welfordM2 = 0.0
        self.deterministicMean = 0.0
        self.deterministicM2 = 0.0
        self.noiseMean = 0.0
        self.noiseM2 = 0.0
        self.lowYieldCount = 0
        self.minYield = float("inf")
        self.maxYield = float("-inf")

        self.yieldHistoryOverTime = []
        self.recentYields = []
        self.allYields = []
        self.yieldSeries = []
        self.yieldBandSeries = []
        self.cycleRecords = []
        self.summaryCache = None

        self.weatherCounts = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.dailyWeatherCounts = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.dailyTyphoonSeverityCounts = {"Moderate": 0, "Severe": 0}
        self.histogramBins = self._init_bins()

        self.cycleWeatherAccum = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.cycleTyphoonSeverityCounts = {"Moderate": 0, "Severe": 0}

        self._accumulated_s = 0.0
        self._cycle_elapsed_s = 0.0

        self.params.update(self.pending_params)
        self.pending_params = {}

    # ----------------------------

    def _loop(self):
        last_time = time.perf_counter()
        while not self._stop.is_set():
            time.sleep(0.01)
            with self._lock:
                if self.status != "running":
                    last_time = time.perf_counter()
                    continue

                now = time.perf_counter()
                delta = now - last_time
                last_time = now

                if self.mode == "day":
                    sec_per_day = 1.0 / max(0.1, self.speed_multiplier)
                    self._accumulated_s += delta
                    while self._accumulated_s >= sec_per_day and self.status == "running":
                        self._accumulated_s -= sec_per_day
                        self._tick_day()
                else:
                    self._tick_cycle(delta)

    def _tick_day(self):
        if self.currentCycleIndex >= self.params["cyclesTarget"]:
            self._finish()
            return

        season = get_season(self.params["plantingMonth"], self.params["region"])
        weather = get_weather(self.params["plantingMonth"], self.params["typhoonProbability"] / 100, self.params["region"])
        typhoon_severity = None
        if weather == "Typhoon":
            typhoon_severity = get_typhoon_severity(self.params["region"])
            self.cycleTyphoonSeverityCounts[typhoon_severity] += 1
            self.dailyTyphoonSeverityCounts[typhoon_severity] += 1

        self.currentDay += 1
        self.currentWeather = weather
        self.cycleWeatherAccum[weather] += 1
        self.dailyWeatherCounts[weather] += 1
        self.currentCycleWeatherTimeline.append(weather)
        if len(self.currentCycleWeatherTimeline) > self.params["daysPerCycle"]:
            self.currentCycleWeatherTimeline.pop(0)

        if self.currentDay >= self.params["daysPerCycle"]:
            dominant = self._get_dominant_weather()
            self._finalize_cycle(season, dominant)

    def _tick_cycle(self, delta_s: float):
        if self.currentCycleIndex >= self.params["cyclesTarget"]:
            self._finish()
            return

        if not self.cycleWeatherSequence:
            self._prepare_cycle()

        cycle_s = self._cycle_duration_s()
        self._cycle_elapsed_s += delta_s

        while self._cycle_elapsed_s >= cycle_s and self.status == "running":
            self.currentDay = self.params["daysPerCycle"]
            self.currentCycleWeatherTimeline = list(self.cycleWeatherSequence)
            dominant = self._get_dominant_weather()
            season = get_season(self.params["plantingMonth"], self.params["region"])
            self._finalize_cycle(season, dominant)

            if self.currentCycleIndex >= self.params["cyclesTarget"]:
                self._finish()
                return

            self._cycle_elapsed_s -= cycle_s
            self._prepare_cycle()

        progress = min(1.0, self._cycle_elapsed_s / cycle_s)
        day_index = min(self.params["daysPerCycle"], int(progress * self.params["daysPerCycle"]))
        if day_index != self.currentDay:
            self.currentDay = day_index
            idx = max(0, day_index - 1)
            if idx < len(self.cycleWeatherSequence):
                self.currentWeather = self.cycleWeatherSequence[idx]
            self.currentCycleWeatherTimeline = self.cycleWeatherSequence[:day_index]

    def _cycle_duration_s(self) -> float:
        base = 0.3
        adjusted = base / max(0.1, self.speed_multiplier)
        return min(0.5, max(0.2, adjusted))

    def _prepare_cycle(self):
        t_prob = self.params["typhoonProbability"] / 100
        self.cycleWeatherSequence = []
        self.cycleWeatherAccum = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.cycleTyphoonSeverityCounts = {"Moderate": 0, "Severe": 0}
        for _ in range(self.params["daysPerCycle"]):
            w = get_weather(self.params["plantingMonth"], t_prob, self.params["region"])
            self.cycleWeatherSequence.append(w)
            self.cycleWeatherAccum[w] += 1
            if w == "Typhoon":
                severity = get_typhoon_severity(self.params["region"])
                self.cycleTyphoonSeverityCounts[severity] += 1
        self.currentDay = 0
        self.currentWeather = self.cycleWeatherSequence[0] if self.cycleWeatherSequence else None
        self.currentCycleWeatherTimeline = []

    def _get_dominant_weather(self) -> WeatherType:
        counts = self.cycleWeatherAccum
        return max(counts.keys(), key=lambda k: counts[k])  # type: ignore[return-value]

    def _finalize_cycle(self, season: Season, dominant_weather: WeatherType):
        typhoon_days = self.cycleTyphoonSeverityCounts["Moderate"] + self.cycleTyphoonSeverityCounts["Severe"]
        dominant_severity = None
        if dominant_weather == "Typhoon" and typhoon_days > 0:
            dominant_severity = "Severe" if self.cycleTyphoonSeverityCounts["Severe"] >= self.cycleTyphoonSeverityCounts["Moderate"] else "Moderate"

        result = compute_yield(dominant_weather, self.params, dominant_severity)
        yld = result["final"]
        deterministic = result["deterministic"]
        noise = result["noise"]
        self.currentYield = yld

        self.weatherCounts[dominant_weather] += 1
        if self.mode == "cycle":
            for key in self.cycleWeatherAccum:
                self.dailyWeatherCounts[key] += self.cycleWeatherAccum[key]
            for key in self.cycleTyphoonSeverityCounts:
                self.dailyTyphoonSeverityCounts[key] += self.cycleTyphoonSeverityCounts[key]

        self.welfordCount += 1
        delta = yld - self.welfordMean
        self.welfordMean += delta / self.welfordCount
        delta2 = yld - self.welfordMean
        self.welfordM2 += delta * delta2

        d_delta = deterministic - self.deterministicMean
        self.deterministicMean += d_delta / self.welfordCount
        d_delta2 = deterministic - self.deterministicMean
        self.deterministicM2 += d_delta * d_delta2

        n_delta = noise - self.noiseMean
        self.noiseMean += n_delta / self.welfordCount
        n_delta2 = noise - self.noiseMean
        self.noiseM2 += n_delta * n_delta2

        if yld < 2.0:
            self.lowYieldCount += 1
        self.minYield = min(self.minYield, yld)
        self.maxYield = max(self.maxYield, yld)

        self.allYields.append(yld)
        self._add_to_bin(yld)

        self.yieldHistoryOverTime = (self.yieldHistoryOverTime + [self.welfordMean])[-400:]
        self.yieldSeries = (self.yieldSeries + [{"cycle": self.currentCycleIndex + 1, "yield": yld}])[-400:]
        self.recentYields = (self.recentYields + [yld])[-60:]

        cycle_record = {
            "cycleIndex": self.currentCycleIndex + 1,
            "yieldTons": yld,
            "yieldSacks": yld * 20,
            "season": season,
            "weather": dominant_weather,
            "dominantTyphoonSeverity": dominant_severity,
            "typhoonDays": typhoon_days,
            "severeTyphoonDays": self.cycleTyphoonSeverityCounts["Severe"],
            "ensoState": self.params["ensoState"],
            "irrigationType": self.params["irrigationType"],
            "region": self.params["region"],
            "plantingMonth": self.params["plantingMonth"],
            "typhoonProbability": self.params["typhoonProbability"],
        }
        self.cycleRecords.append(cycle_record)

        self.summaryCache = self._compute_summary()
        if self.summaryCache:
            self.yieldBandSeries = (self.yieldBandSeries + [{
                "cycle": self.currentCycleIndex + 1,
                "mean": self.summaryCache["mean"],
                "p5": self.summaryCache["percentile5"],
                "p95": self.summaryCache["percentile95"],
            }])[-400:]

        self.params.update(self.pending_params)
        self.pending_params = {}

        self.currentCycleIndex += 1
        self.currentDay = 0
        self.cycleWeatherAccum = {"Dry": 0, "Normal": 0, "Wet": 0, "Typhoon": 0}
        self.cycleTyphoonSeverityCounts = {"Moderate": 0, "Severe": 0}
        self.currentCycleWeatherTimeline = []
        self.cycleWeatherSequence = []

    def _finish(self):
        self.status = "finished"
        self.summaryCache = self._compute_summary()

    # ----------------------------

    def _welford_sd(self) -> float:
        if self.welfordCount < 2:
            return 0.0
        return math.sqrt(self.welfordM2 / self.welfordCount)

    def _deterministic_sd(self) -> float:
        if self.welfordCount < 2:
            return 0.0
        return math.sqrt(self.deterministicM2 / self.welfordCount)

    def _noise_sd(self) -> float:
        if self.welfordCount < 2:
            return 0.0
        return math.sqrt(self.noiseM2 / self.welfordCount)

    def _compute_summary(self):
        if not self.allYields:
            return None
        sorted_y = sorted(self.allYields)
        n = len(sorted_y)
        mean = self.welfordMean
        sd = self._welford_sd()
        se = sd / math.sqrt(n) if n > 0 else 0.0
        ci_low = mean - 1.96 * se
        ci_high = mean + 1.96 * se
        return {
            "mean": mean,
            "std": sd,
            "min": 0 if self.minYield == float("inf") else self.minYield,
            "max": 0 if self.maxYield == float("-inf") else self.maxYield,
            "percentile5": sorted_y[int(n * 0.05)] if n > 0 else 0,
            "percentile95": sorted_y[int(n * 0.95)] if n > 0 else 0,
            "ciLow": ci_low,
            "ciHigh": ci_high,
            "ciWidth": ci_high - ci_low,
            "deterministicSd": self._deterministic_sd(),
            "noiseSd": self._noise_sd(),
        }

    # ----------------------------

    def _snapshot(self):
        n = self.welfordCount
        return {
            "status": self.status,
            "mode": self.mode,
            "speedMultiplier": self.speed_multiplier,
            "params": dict(self.params),
            "pendingParams": dict(self.pending_params),
            "currentCycleIndex": self.currentCycleIndex,
            "currentDay": self.currentDay,
            "dayProgress": self.currentDay / self.params["daysPerCycle"] if self.params["daysPerCycle"] else 0,
            "runProgress": self.currentCycleIndex / self.params["cyclesTarget"] if self.params["cyclesTarget"] else 0,
            "currentWeather": self.currentWeather,
            "currentYield": self.currentYield,
            "currentCycleWeatherTimeline": list(self.currentCycleWeatherTimeline),
            "runningMean": self.welfordMean,
            "runningSd": self._welford_sd(),
            "lowYieldProb": (self.lowYieldCount / n) if n > 0 else 0,
            "yieldHistoryOverTime": list(self.yieldHistoryOverTime),
            "recentYields": list(self.recentYields),
            "yieldSeries": list(self.yieldSeries),
            "yieldBandSeries": list(self.yieldBandSeries),
            "cycleRecords": list(self.cycleRecords),
            "weatherCounts": dict(self.weatherCounts),
            "dailyWeatherCounts": dict(self.dailyWeatherCounts),
            "dailyTyphoonSeverityCounts": dict(self.dailyTyphoonSeverityCounts),
            "histogramBins": list(self.histogramBins),
            "summary": self.summaryCache,
        }

    # ----------------------------

    def _init_bins(self):
        bins = []
        v = 0.0
        while v < 5.5:
            bins.append({"label": f"{v:.1f}", "count": 0})
            v += 0.5
        return bins

    def _add_to_bin(self, y: float):
        idx = min(int(y / 0.5), len(self.histogramBins) - 1)
        if idx >= 0:
            self.histogramBins[idx]["count"] += 1
