/** One synthetic day row from `HealthDataGenerator.week()`. */
export interface DayCaseRow {
  date: string;
  cases: number;
  severe: number;
  under5: number;
  recovered: number;
  referred: number;
  deceased: number;
  oxygen: number;
}

/** `GET /api/cases/week/{city}` response (`main.py`). */
export interface CasesWeekResponse {
  city: string;
  total: number;
  days: number[];
  data: DayCaseRow[];
  source: string;
  note: string;
  generated_at: string;
  verification?: unknown;
}

/** `GET /api/cases/all-cities` response (`main.py`). */
export interface CasesAllCitiesResponse {
  region?: string;
  timestamp?: string;
  total_cases_week?: number;
  cities: Record<string, CasesWeekResponse>;
  deployment_mode?: string;
  status?: string;
  verification?: unknown;
}
