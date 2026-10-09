export type RainIndicator = {
  precipMm: number | null;
  conditionText: string | null;
  /** Short status for the chip value. */
  status: "Raining" | "Wet" | "Dry" | "Unavailable";
  summary: string;
};

function nested(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const child = value?.[key];
  return child && typeof child === "object"
    ? (child as Record<string, unknown>)
    : undefined;
}

function readNumber(
  object: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const current = object?.[key];
    if (typeof current === "number" && Number.isFinite(current)) return current;
    if (typeof current === "string") {
      const parsed = Number(current.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readConditionText(
  current: Record<string, unknown> | undefined,
): string | null {
  const condition = current?.condition;
  if (condition && typeof condition === "object") {
    const text = (condition as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  if (
    typeof current?.condition_text === "string" &&
    current.condition_text.trim()
  ) {
    return current.condition_text.trim();
  }
  const weather = current?.weather;
  if (Array.isArray(weather) && weather[0] && typeof weather[0] === "object") {
    const description = (weather[0] as Record<string, unknown>).description;
    if (typeof description === "string" && description.trim()) {
      return description.trim();
    }
  }
  return null;
}

function looksWet(conditionText: string | null): boolean {
  if (!conditionText) return false;
  return /\b(rain|drizzle|shower|thunder|storm|precip)/i.test(conditionText);
}

/**
 * Derive a place-based rain indicator from a WeatherAPI/OpenWeather-style
 * current weather payload already returned by `/api/weather/current`.
 */
export function extractRainIndicator(
  weatherPayload?: Record<string, unknown> | null,
): RainIndicator {
  if (!weatherPayload) {
    return {
      precipMm: null,
      conditionText: null,
      status: "Unavailable",
      summary: "Rain reading unavailable for this place",
    };
  }

  const current =
    nested(weatherPayload, "current") ??
    nested(weatherPayload, "main") ??
    weatherPayload;

  const precipMm = readNumber(
    current,
    "precip_mm",
    "precipMm",
    "precipitation",
    "rain_1h",
  );
  // OpenWeather sometimes nests rain: { "1h": n }
  const rainObject = nested(current, "rain") ?? nested(weatherPayload, "rain");
  const precipFromNested =
    precipMm ??
    readNumber(rainObject, "1h", "3h") ??
    readNumber(weatherPayload, "precip_mm");

  const conditionText =
    readConditionText(current) ?? readConditionText(weatherPayload);
  const mm = precipFromNested;

  if (mm != null && mm > 0.2) {
    return {
      precipMm: mm,
      conditionText,
      status: "Raining",
      summary: `${mm.toFixed(1)} mm right now`,
    };
  }

  if (mm != null && mm > 0) {
    return {
      precipMm: mm,
      conditionText,
      status: "Wet",
      summary: `${mm.toFixed(1)} mm · light`,
    };
  }

  if (looksWet(conditionText)) {
    return {
      precipMm: mm,
      conditionText,
      status: "Wet",
      summary: conditionText || "Wet conditions reported",
    };
  }

  if (mm === 0 || conditionText) {
    return {
      precipMm: mm ?? 0,
      conditionText,
      status: "Dry",
      summary: conditionText || "No measurable rain right now",
    };
  }

  return {
    precipMm: null,
    conditionText: null,
    status: "Unavailable",
    summary: "Rain reading unavailable for this place",
  };
}
