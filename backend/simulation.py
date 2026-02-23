import math
import random
from typing import Dict, Literal, Tuple

WeatherType = Literal["Dry", "Normal", "Wet", "Typhoon"]
TyphoonSeverity = Literal["Moderate", "Severe"]
Season = Literal["Dry Season", "Wet Season", "Transition Season"]
IrrigationType = Literal["Irrigated", "Rainfed"]
ENSOState = Literal["El Niño", "Neutral", "La Niña"]
DEFAULT_PROFILE: Dict = {
    "wetStart": 6,
    "wetEnd": 10,
    "typhoonMultiplier": 1.2,
    "severity": {"Moderate": 0.6, "Severe": 0.4},
}


def _wrap_month(month: int) -> int:
    if month < 1:
        return month + 12
    if month > 12:
        return month - 12
    return month


def get_season_blend(month: int) -> Tuple[float, float, Season]:
    profile = DEFAULT_PROFILE
    in_wet = profile["wetStart"] <= month <= profile["wetEnd"]
    if in_wet:
        return 0.0, 1.0, "Wet Season"

    transitions = {
        _wrap_month(profile["wetStart"] - 1): 0.5,
        _wrap_month(profile["wetStart"] - 2): 0.25,
        _wrap_month(profile["wetEnd"] + 1): 0.5,
        _wrap_month(profile["wetEnd"] + 2): 0.25,
    }
    wet_weight = transitions.get(month, 0)
    dry_weight = 1 - wet_weight
    if wet_weight >= 0.6:
        label: Season = "Wet Season"
    elif wet_weight <= 0.4:
        label = "Dry Season"
    else:
        label = "Transition Season"
    return dry_weight, wet_weight, label


def get_season(month: int) -> Season:
    return get_season_blend(month)[2]


def get_weather_weights(month: int, typhoon_prob: float) -> Dict[WeatherType, float]:
    profile = DEFAULT_PROFILE
    dry_weight, wet_weight, _ = get_season_blend(month)
    t_prob = max(0.0, min(0.6, typhoon_prob * profile["typhoonMultiplier"]))
    dry_weights = {"Dry": 0.5, "Normal": 0.4, "Wet": 0.1, "Typhoon": 0.05}
    wet_weights = {"Dry": 0.1, "Normal": 0.4, "Wet": 0.35, "Typhoon": t_prob}

    weights = {
        "Dry": dry_weights["Dry"] * dry_weight + wet_weights["Dry"] * wet_weight,
        "Normal": dry_weights["Normal"] * dry_weight + wet_weights["Normal"] * wet_weight,
        "Wet": dry_weights["Wet"] * dry_weight + wet_weights["Wet"] * wet_weight,
        "Typhoon": dry_weights["Typhoon"] * dry_weight + wet_weights["Typhoon"] * wet_weight,
    }
    total = weights["Dry"] + weights["Normal"] + weights["Wet"] + weights["Typhoon"]
    return {k: v / total for k, v in weights.items()}  # type: ignore[return-value]


def get_weather(month: int, typhoon_prob: float) -> WeatherType:
    weights = get_weather_weights(month, typhoon_prob)
    r = random.random()
    acc = weights["Dry"]
    if r < acc:
        return "Dry"
    acc += weights["Normal"]
    if r < acc:
        return "Normal"
    acc += weights["Wet"]
    if r < acc:
        return "Wet"
    return "Typhoon"


def get_typhoon_severity() -> TyphoonSeverity:
    weights = DEFAULT_PROFILE["severity"]
    r = random.random()
    return "Severe" if r < weights["Severe"] else "Moderate"


def get_typhoon_severity_weights() -> Dict[TyphoonSeverity, float]:
    return DEFAULT_PROFILE["severity"]


BASE_YIELDS: Dict[WeatherType, float] = {
    "Dry": 2.0,
    "Normal": 3.0,
    "Wet": 3.3,
    "Typhoon": 1.2,
}

TYPHOON_YIELDS: Dict[TyphoonSeverity, float] = {
    "Moderate": 1.4,
    "Severe": 0.8,
}

IRRIGATION_ADJ: Dict[IrrigationType, float] = {"Irrigated": 0.3, "Rainfed": 0.0}
ENSO_ADJ: Dict[ENSOState, float] = {"El Niño": -0.4, "Neutral": 0.0, "La Niña": 0.3}


def gaussian_noise(mean: float = 0.0, sd: float = 0.2) -> float:
    return random.gauss(mean, sd)


def compute_yield(weather: WeatherType, params: Dict, typhoon_severity: TyphoonSeverity | None):
    base = TYPHOON_YIELDS[typhoon_severity] if weather == "Typhoon" and typhoon_severity else BASE_YIELDS[weather]
    adj = IRRIGATION_ADJ[params["irrigationType"]] + ENSO_ADJ[params["ensoState"]]
    deterministic = base + adj
    noise = gaussian_noise()
    final = max(0.0, deterministic + noise)
    return {"final": final, "deterministic": deterministic, "noise": noise, "base": base}
