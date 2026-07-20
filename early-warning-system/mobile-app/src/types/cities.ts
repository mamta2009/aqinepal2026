export interface CityInfo {
  name: string;
  population: number;
  hospitals: number;
  elevation: number;
  province: string;
  status: string;
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
