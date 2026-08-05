import { browserApi } from "./browser";
import type {
  AirQualityResponse,
  AlertLatest,
  CitiesResponse,
  HeatResponse,
} from "./types";

export interface CaseDay {
  date: string;
  cases: number;
  severe?: number;
}

export interface CasesWeekResponse {
  city: string;
  total: number;
  days: number[];
  data?: CaseDay[];
  source?: string;
  note?: string;
  generated_at?: string;
}

export interface CasesAllCitiesResponse {
  region?: string;
  timestamp?: string;
  total_cases_week?: number;
  cities: Record<string, CasesWeekResponse>;
  deployment_mode?: string;
}

export interface SurgeForecastResponse {
  city: string;
  generated_at?: string;
  input_meta?: {
    source?: string;
    generator_note?: string;
    series_length?: number;
  };
  surge_forecast?: {
    risk_score_0_100?: number;
    surge_probability?: number;
    surge_probability_3_5_days?: number;
    risk_level?: string;
    trend?: string;
    predicted_cases_by_horizon_day?: Record<string, number | null>;
    disclaimer?: string;
    [key: string]: unknown;
  };
  legacy_week_trend?: {
    model?: string;
    next_day_estimate?: number;
    week_total_estimate?: number;
    confidence?: string;
    r2_score?: number;
    predicted_next_day?: number;
    trend?: string;
    risk_note?: string;
    [key: string]: unknown;
  };
}

export interface WeatherResponse {
  location_label?: string;
  source?: string;
  provenance?: Record<string, unknown>;
  weather?: Record<string, unknown>;
}

export interface DashboardData {
  city: string;
  cities: CitiesResponse;
  air: AirQualityResponse | null;
  heat: HeatResponse | null;
  weather: WeatherResponse | null;
  cases: CasesWeekResponse | null;
  allCases: CasesAllCitiesResponse | null;
  forecast: SurgeForecastResponse | null;
  latestAlert: AlertLatest | null;
  failures: string[];
  refreshedAt: string;
}

async function optional<T>(
  label: string,
  promise: Promise<T>,
): Promise<{ label: string; value: T | null; failed: boolean }> {
  try {
    return { label, value: await promise, failed: false };
  } catch {
    return { label, value: null, failed: true };
  }
}

export async function getDashboardData(city: string): Promise<DashboardData> {
  const encoded = encodeURIComponent(city);
  const [cities, air, heat, weather, cases, allCases, forecast, latestAlert] =
    await Promise.all([
      browserApi<CitiesResponse>("api/cities"),
      optional(
        "air quality",
        browserApi<AirQualityResponse>(
          `api/air-quality/current?city=${encoded}`,
        ),
      ),
      optional(
        "heat",
        browserApi<HeatResponse>(`api/heat/current?city=${encoded}`),
      ),
      optional(
        "weather",
        browserApi<WeatherResponse>(`api/weather/current?city=${encoded}`),
      ),
      optional(
        "case history",
        browserApi<CasesWeekResponse>(`api/cases/week/${encoded}`),
      ),
      optional(
        "city comparison",
        browserApi<CasesAllCitiesResponse>("api/cases/all-cities"),
      ),
      optional(
        "forecast",
        browserApi<SurgeForecastResponse>(
          `api/models/surge-forecast/${encoded}`,
        ),
      ),
      optional(
        "latest alert",
        browserApi<AlertLatest>(`api/alerts/latest?city=${encoded}`),
      ),
    ]);

  const optionalResults = [
    air,
    heat,
    weather,
    cases,
    allCases,
    forecast,
    latestAlert,
  ];

  return {
    city,
    cities,
    air: air.value,
    heat: heat.value,
    weather: weather.value,
    cases: cases.value,
    allCases: allCases.value,
    forecast: forecast.value,
    latestAlert: latestAlert.value,
    failures: optionalResults
      .filter((item) => item.failed)
      .map((item) => item.label),
    refreshedAt: new Date().toISOString(),
  };
}

export function cityNames(response?: CitiesResponse): string[] {
  if (!response) return [];
  return Array.isArray(response.cities)
    ? response.cities.map((city) => city.name)
    : Object.keys(response.cities);
}
