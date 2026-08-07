/**
 * US EPA PM2.5 (µg/m³, 24h) → AQI breakpoints.
 * https://www.airnow.gov/aqi/aqi-basics/
 */
const PM25_AQI_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50, category: "Good" },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: "Moderate" },
  {
    cLow: 35.5,
    cHigh: 55.4,
    iLow: 101,
    iHigh: 150,
    category: "Unhealthy for Sensitive Groups",
  },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200, category: "Unhealthy" },
  {
    cLow: 150.5,
    cHigh: 250.4,
    iLow: 201,
    iHigh: 300,
    category: "Very Unhealthy",
  },
  { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400, category: "Hazardous" },
  { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500, category: "Hazardous" },
] as const;

export type Pm25AqiEstimate = {
  aqi: number;
  category: string;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Convert PM2.5 concentration to an approximate US EPA AQI integer. */
export function pm25ToUsAqi(pm25: number): Pm25AqiEstimate | null {
  if (!finite(pm25) || pm25 < 0) return null;
  const capped = Math.min(pm25, 500.4);
  const row =
    PM25_AQI_BREAKPOINTS.find((b) => capped >= b.cLow && capped <= b.cHigh) ??
    PM25_AQI_BREAKPOINTS[PM25_AQI_BREAKPOINTS.length - 1];
  const span = row.cHigh - row.cLow;
  const aqi =
    span <= 0
      ? row.iHigh
      : ((row.iHigh - row.iLow) / span) * (capped - row.cLow) + row.iLow;
  return { aqi: Math.round(aqi), category: row.category };
}

export function formatPm25UgM3(pm25: number): string {
  if (!finite(pm25)) return "—";
  const rounded = Math.round(pm25 * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Short line for the dashboard air chip.
 * Prefer PM2.5 plus approximate EPA AQI; else reported continuous AQI.
 */
export function briefAirMeasurement(input: {
  pm25?: number | null;
  aqiScore?: number | null;
}): string | null {
  if (finite(input.pm25)) {
    const amount = formatPm25UgM3(input.pm25);
    const estimate = pm25ToUsAqi(input.pm25);
    if (!estimate) return `PM2.5 ${amount} µg/m³`;
    return `PM2.5 ${amount} µg/m³ · ~AQI ${estimate.aqi}`;
  }
  if (finite(input.aqiScore)) {
    return `Air score (AQI) ${Math.round(input.aqiScore)}`;
  }
  return null;
}

/**
 * Longer plain-language explanation for the air help tip.
 */
export function explainAirMeasurement(input: {
  pm25?: number | null;
  aqiScore?: number | null;
}): string | null {
  if (finite(input.pm25)) {
    const amount = formatPm25UgM3(input.pm25);
    const estimate = pm25ToUsAqi(input.pm25);
    const base = `Right now PM2.5 is ${amount} µg/m³. That means each cubic meter of air holds about ${amount} micrograms of tiny dust-like particles.`;
    if (!estimate) return base;
    return `${base} On a common U.S. air score (about 0 to 500), that is roughly AQI ${estimate.aqi} (${estimate.category}).`;
  }
  if (finite(input.aqiScore)) {
    return `The air score shown is ${Math.round(input.aqiScore)}. On the usual 0 to 500 scale, lower numbers mean cleaner air.`;
  }
  return null;
}
