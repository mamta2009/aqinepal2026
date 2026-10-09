export interface CityInfo {
  name: string;
  population: number;
  hospitals: number;
  elevation: number;
  province: string;
  status: string;
  /** Present on the web dashboard config; API may omit (defaults to Phase 1). */
  phase?: number;
}

/** `GET /api/cities` response (`main.py`). */
export interface CitiesResponse {
  mode: string;
  cities: CityInfo[];
  facility_presets_by_city: Record<string, unknown>;
  total_population: number;
  total_hospitals: number;
  facility_suggestions_note: string;
}
