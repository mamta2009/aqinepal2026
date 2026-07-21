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
