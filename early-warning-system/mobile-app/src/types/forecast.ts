/** `GET /api/models/predict/week/{city}` response (`main.py`). */
export interface WeekForecastTrend {
  model: string;
  next_day_estimate: number;
  week_total_estimate?: number;
  confidence?: string;
  r2_score?: number;
}

export interface WeekPredictResponse {
  city: string;
  input_days: number[];
  forecast: WeekForecastTrend;
}

/** One day cell as rendered by web `loadAIForecasts()`. */
export interface ForecastDay {
  day: number;
  pm25: number;
  cases: number;
}

/** Nested surge block from `GET /api/models/surge-forecast/{city}`. */
export interface SurgeForecastDetails {
  risk_score_0_100?: number;
  surge_probability?: number;
  surge_probability_3_5_days?: number;
  risk_level?: string;
  trend?: string;
  predicted_cases_by_horizon_day?: Record<string, number | null>;
  disclaimer?: string;
  [key: string]: unknown;
}

/** `GET /api/models/surge-forecast/{city}` response (`main.py`). */
export interface SurgeForecastResponse {
  city: string;
  generated_at?: string;
  input_meta?: {
    source?: string;
    generator_note?: string;
    series_length?: number;
  };
  surge_forecast?: SurgeForecastDetails;
  legacy_week_trend?: WeekForecastTrend;
  verification?: unknown;
}
